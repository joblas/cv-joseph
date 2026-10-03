// ---------------------------------------------------------------------------
// Shared RAG pipeline — used by api/chat.js (text) and api/rag-search.js (voice)
// ---------------------------------------------------------------------------

import { getPersona } from './personas.js'
import { boundedFetch } from './bounded-fetch.js'
import { expandWorkQuery, FACT_CARDS_ID, FACT_CARD_GUIDE_PREFIXES } from './work.js'

// ---------------------------------------------------------------------------
// Cost tracking per span
// ---------------------------------------------------------------------------

export const MODEL_COSTS = {
  'claude-sonnet-4-6': { input: 3.0 / 1e6, output: 15.0 / 1e6 },
  'claude-haiku-4-5-20251001': { input: 0.25 / 1e6, output: 1.25 / 1e6 },
  'text-embedding-3-small': { input: 0.02 / 1e6 },
  // The site corpus's two paid Voyage calls. Without entries here calcCost
  // returns 0 for an unknown model, so both billed silently at $0 — and the
  // embedding line was priced at OpenAI's rate for a model nothing calls.
  // RATES ARE UNVERIFIED: transcribed from Voyage's published pricing on
  // 2026-09-20, not measured against an invoice. Re-check at voyageai.com
  // before quoting these to anyone.
  'voyage-3.5': { input: 0.06 / 1e6 },
  'rerank-2.5': { input: 0.05 / 1e6 },
}

// The site corpus embeds with Voyage. voyage-3.5 returns 1024-dimensional
// vectors, which is exactly what site_chunks.embedding is declared as — the
// column was built around this model. The cloudyjoe corpus is separate and uses
// voyage-3-lite at 512 dims (see embedQuery below); the two are not
// interchangeable, which is why this is its own function.
//
// Voyage embeddings are asymmetric: the indexer embeds chunks with
// input_type "document", so the query side must use "query" to land in the
// same space.
const SITE_EMBED_MODEL = 'voyage-3.5'
const SITE_RERANK_MODEL = 'rerank-2.5'
// site_chunks.embedding is declared vector(1024) and the RPC hard-casts to it,
// so a provider-side change to voyage-3.5's default width would 400 every
// hybrid call and silently drop the chat to zero context. Ask for the width.
const SITE_EMBED_DIMS = 1024

// PER-LEG NETWORK BUDGETS. Retrieval runs in the request path of every chat
// turn, and the voice path is stricter still (rag-search.js skips Claude
// reasoning once RAG passes 1500ms). Each leg carries its OWN AbortController,
// because the most common provider failure under load — a connection accepted
// and never answered — is neither a throw nor a rejection. Nothing but an
// explicit timeout bounds it, and an unbounded await here hangs the whole turn.
//
// The budgets are SEQUENTIAL, not shared. The first version of this change
// armed one 2500ms timer before the embed, which meant a slow-but-successful
// embed burned the retrieval budget and handed Supabase an already-aborted
// signal — surfaced as `retrieval_timeout` with zero chunks, blaming Supabase
// for Voyage's latency. Measured: a 2600ms embed produced chunks=null where
// the pre-change code would have returned keyword results.
// Exported so the suite can pin the VALUES, not merely that a bound exists.
// Review found that asserting "it is bounded" behaviourally left every budget
// free to drift: 800 -> 2400 and 2500 -> 60000 both passed, because each still
// finished inside the test's own guard. Pinning the numbers is deterministic
// and, unlike a tighter wall-clock guard, cannot flake on a loaded runner.
export const EMBED_TIMEOUT_MS = 800
export const RERANK_TIMEOUT_MS = 700
export const SITE_SEARCH_TIMEOUT_MS = 2500

async function embedSiteQuery(text, apiKey) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS)
  try {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: SITE_EMBED_MODEL,
        input: [text],
        input_type: 'query',
        output_dimension: SITE_EMBED_DIMS,
      }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Voyage embedding failed: ${res.status}`)
    const data = await res.json()
    return { embedding: data.data[0].embedding, tokens: data.usage?.total_tokens || 0 }
  } finally {
    clearTimeout(timer)
  }
}

// The reranker for both corpora. It reads the FULL chunk text, unlike the LLM
// rerank it replaced (removed 2026-10-02), which saw the first 200 characters
// of ten candidates and cost an entire thinking-model round trip: 1.5-2.5s on
// every cloudyjoe search, the single largest step before the answer's first
// word. Verified against the live API: asked for "examples of his work", it
// ranks Skate Workshop copy above Terms of Service, which is the exact
// confusion that produced the "I have no examples" answer.
//
// `toText` is what Voyage reads for a chunk (the chunk's content by default).
//
// Returns null when there is no key or too few candidates to matter, so the
// caller keeps the fused order — the same way the original degraded.
export async function voyageRerank(query, chunks, topK = 6, toText = (c) => c.content) {
  const key = process.env.VOYAGE_API_KEY
  if (!key || chunks.length <= topK) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RERANK_TIMEOUT_MS)
  try {
    const res = await fetch('https://api.voyageai.com/v1/rerank', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: SITE_RERANK_MODEL,
        query,
        // Site chunks: NOT `${c.metadata.title}\n${c.content}` —
        // siteChunkToDocument has already built content as `${title}\n${content}`.
        // Prefixing again sent every title twice, diluting the signal and paying
        // for the duplicate tokens. Document chunks are bare section text, so
        // their caller passes a `toText` that names the article (documentText).
        documents: chunks.map(toText),
        top_k: topK,
      }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`voyage rerank ${res.status}`)
    const data = await res.json()
    // A 200 whose index is out of range spreads `undefined` — which is `{}`,
    // not a throw — putting the literal string "undefined" in the model's
    // context and minting a badge with an undefined article_id. Drop any
    // result that does not resolve to a candidate we sent.
    const ranked = (data.data || [])
      .filter((d) => chunks[d.index])
      .map((d) => ({ ...chunks[d.index], similarity: d.relevance_score }))
    return ranked.length ? ranked : null
  } catch (err) {
    console.warn('[rag] voyage rerank failed, keeping fused order:', err.message)
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function calcCost(model, inputTokens, outputTokens = 0) {
  const r = MODEL_COSTS[model]
  return r ? (inputTokens * (r.input || 0)) + (outputTokens * (r.output || 0)) : 0
}

// ---------------------------------------------------------------------------
// RAG: tool definition for Agentic RAG
// ---------------------------------------------------------------------------

// Retrieval needs Supabase. With VOYAGE_API_KEY it is hybrid (vector +
// keyword); without it, keyword-only over the same corpus (keyword_search RPC).
export function isRagEnabled(persona = getPersona()) {
  return !!(persona.rag.supabaseUrl() && persona.rag.supabaseKey())
}

export function hasEmbeddings(persona = getPersona()) {
  // Gates the `hybrid` retrieval MODE in searchPortfolio, which is the cloudyjoe
  // path (voyage-3-lite, 512 dims, `documents`). It does NOT mean "this corpus
  // has vectors" — since 2026-09-20 the JTS site_chunks corpus is fully embedded
  // too (voyage-3.5, 1024 dims), but it runs in `site` mode and does its own
  // embedding inside siteChunkSearch. Reading this as "only cloudyjoe has
  // vectors" is how an audit concluded the JTS embeddings never shipped.
  return persona.rag.kind === 'documents' && !!process.env.VOYAGE_API_KEY
}

// JTS site index rows (search_site_chunks_public) → the chunk shape the rest of
// the pipeline expects. Page chunks become badge-able sources (page_path);
// curated FAQ rows keep their content but get no badge.
// site_chunks stores page text HTML-escaped; the model, the labels and the
// badge titles want plain text ("Joe's", not "Joe&#x27;s").
const HTML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
function decodeEntities(text) {
  return String(text || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      // Only real scalar values: fromCodePoint throws above 0x10FFFF, and NUL /
      // lone surrogates have no place in a prompt
      const valid = Number.isFinite(n) && n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff)
      return valid ? String.fromCodePoint(n) : m
    }
    return HTML_ENTITIES[code.toLowerCase()] ?? m
  })
}

function siteChunkToDocument(row) {
  const title = decodeEntities(row.title)
  const content = decodeEntities(row.content)
  let pagePath = ''
  let articleId = row.source === 'kb' ? `kb:${title || 'faq'}` : 'page'
  try {
    if (/^https?:/.test(row.url)) {
      const u = new URL(row.url)
      pagePath = u.pathname.replace(/\/$/, '') || '/'
      articleId = pagePath === '/' ? 'home' : pagePath.slice(1).replace(/\//g, '-')
    }
  } catch { /* keep defaults */ }
  return {
    id: row.id,
    content: title ? `${title}\n${content}` : content,
    metadata: {
      kind: 'site', // formatChunksForContext / extractSources: site corpus, not a cloudyjoe article
      article_id: articleId,
      section_id: row.source === 'kb' ? 'faq' : 'page',
      section_anchor: '',
      page_path: pagePath,
      article_slug: pagePath ? pagePath.slice(1) : '',
      title,
    },
    similarity: Number(row.score) || 0,
  }
}

// The site index is keyword-ranked with near-flat scores, so the page a query
// names ("what is the private ai setup?" → /private-ai-setup) can sit below
// its own sub-pages — and the reranker only sees the top 10. A page whose slug
// words or title head appear in the query is doubled; parents win ties.
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Whole-phrase match: "contact" must not fire on "subcontracting" */
function mentions(text, phrase) {
  return phrase.length >= 4 && new RegExp(`(^|[^a-z0-9])${escapeRegex(phrase)}(?![a-z0-9])`, 'i').test(text)
}

export function boostNamedPages(query, docs) {
  const q = String(query || '').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ')
  return docs
    .map((d, i) => {
      const meta = d.metadata || {}
      const path = meta.page_path || ''
      const slugWords = path.split('/').filter(Boolean).join(' ').replace(/-/g, ' ').toLowerCase()
      const titleHead = String(meta.title || '').split('|')[0].trim().toLowerCase()
      const named = (slugWords.length >= 6 && mentions(q, slugWords)) || (titleHead.length >= 8 && mentions(q, titleHead))
      const score = (Number(d.similarity) || 0) * (named ? 2 : 1)
      return { d, score, named, depth: path.split('/').filter(Boolean).length, i }
    })
    .sort((a, b) => b.score - a.score || a.depth - b.depth || a.i - b.i)
    // `named` is read back after the rerank (searchPortfolio pins those pages)
    .map(({ d, score, named }) => ({ ...d, similarity: score, metadata: named ? { ...d.metadata, named: true } : d.metadata }))
}

// ---------------------------------------------------------------------------
// Visitor vocabulary -> site vocabulary
//
// HISTORY, and why this still matters. Until 2026-09-20 the JTS corpus was
// retrieved lexically and every one of the then-229 site_chunks rows had a NULL
// embedding, so a page could only be found through a token it literally
// contains -- and no /portfolio chunk contains the word "example", the word
// visitors reach for. The corpus is now fully embedded (249/249, voyage-3.5)
// and retrieval is hybrid, but this bridge still earns its keep: the LEXICAL
// leg of the hybrid RPC has exactly the same blind spot.
// Measured against the live index on 2026-09-19, before embeddings:
//
//   'examples of his work'      -> 0 portfolio rows (Terms of Service, industry pages)
//   the same query, expanded    -> 6 portfolio rows across 3 case-study pages
//   'what else does Joe build'  -> 0 portfolio rows
//   the same query, expanded    -> 7 portfolio rows across 3 case-study pages
//
// chat.js sends whatever the MODEL typed into its tool call, so before this
// existed a correct answer depended on the model guessing the word "portfolio".
// Expansion is append-only: the visitor's own words stay in front and keep
// their ranking weight, and we only add terms the query does not already carry.
// ---------------------------------------------------------------------------

// The case studies joestechsolutions.com actually publishes (src/app/portfolio).
// Keep in step with that page: a name that drifts silently stops retrieving, and
// a name that was never there teaches the agent to cite work that does not exist.
export const JTS_CASE_STUDIES = ['The Skate Workshop', 'RenFaire Directory', 'Cbarrgs Music', 'FixBot', 'Turnover Agent', 'Archive Salon']

// What a visitor says when they want to SEE Joe's past output. Every alternative
// here needs a possessive, a retrospective, or an explicit "show me" — never a
// bare service verb.
//
// This was learned the hard way. A first version matched bare `build|built|made|
// project`, which are this site's core SERVICE vocabulary: "Custom Build" is one
// of the three offers and pricing is phrased "quoted per project". Measured on
// the live index, that version was actively harmful — expanding a query it should
// not have touched evicted the chunk that answered it:
//
//   'how much is it per project'  -> kb:Pricing and quotes fell from rank 1 to
//                                    off the list entirely
//   'what is a custom build'      -> kb:What a Custom Build looks like, gone
//   'can you build me a chatbot'  -> kb:The three ways to work with Joe, gone
//
// Deleting the pricing chunk is the worst case on this site: HARD GUARDRAIL 1
// forbids stating a price that is not in context. Shortening the appended text
// did not fix it — only a precise trigger does. A false positive here is NOT
// cheap, so the rule is: when in doubt, do not expand. The model can still
// search again, and the tool description now tells it to.
const WORK_INTENT = new RegExp([
  /\bexamples?\b/,                                                  // "examples of his work"
  /\bportfolios?\b/,
  /\bcase ?stud(?:y|ies)\b/,
  /\btrack record\b/,
  /\bsamples? of\b/,
  // possessive or retrospective: "his work", "past projects", "your apps"
  /\b(?:past|previous|prior|other|his|her|their|your|joe'?s)\s+(?:work|projects?|clients?|builds?|apps?|sites?|websites?)\b/,
  // "what else does Joe build", "what other things has he made"
  /\bwhat\s+(?:else|other)\b[^?]{0,40}?\b(?:build|built|make|made|do|does|done|ship|shipped)\b/,
  // "what has Joe done before", "has he ever built"
  /\bwhat\s+(?:has|have)\s+(?:he|joe|you|they)\b[^?]{0,30}?\b(?:built|made|done|shipped|worked)\b/,
  /\bhas\s+(?:he|joe|you)\s+(?:ever\s+)?(?:built|made|done|worked on)\b/,
  // "can I see some of his apps", "show me the work"
  /\b(?:see|show me|look at)\b[^?]{0,30}?\b(?:work|projects?|portfolio|apps?|sites?)\b/,
  /\b(?:see|show me|look at)\b[^?]{0,20}?\bwhat\b[^?]{0,20}?\b(?:he|joe|you|they)\b[^?]{0,15}?\b(?:built|made|done|shipped)\b/,
  /\bwho\s+(?:has|have)\s+(?:he|joe|you|they)\s+worked\s+(?:with|for)\b/,
].map((r) => r.source).join('|'), 'i')

export function expandSiteQuery(query) {
  const q = String(query ?? '').trim()
  if (!q || !WORK_INTENT.test(q.replace(/[\u2018\u2019]/g, "'"))) return q
  const lower = q.toLowerCase()
  const additions = ['portfolio', 'case studies', ...JTS_CASE_STUDIES]
    .filter((term) => !lower.includes(term.toLowerCase()))
  return additions.length ? `${q} ${additions.join(' ')}` : q
}

// The cloudyjoe corpus has the same blind spot from the other side: a visitor
// asks for "a store for a musician selling t-shirts" and the case study says
// "Cbarrgs" and "merch". The bridge lives with the facts it points at
// (api/_shared/work.js, each item's `expand`). Only the EMBEDDING gets the
// added words. hybrid_search's keyword leg gets the visitor's words unchanged:
// appended OR terms switch ts_rank to its OR formula, which cuts a full
// match's keyword score several-fold (see expandWorkQuery).
export function expandDocumentsQuery(query) {
  return expandWorkQuery(query)
}

// Keyword-only retrieval (no embedding provider): the visitor's words first.
// keyword_search already falls back from an AND match to any single word, so
// the bridge terms are tried only when no row shares even one word with the
// question; tried first, they would always find their own item's rows and the
// visitor's own any-word fallback would never run.
async function keywordSearchWithBridge(query, expanded) {
  const first = await searchDocumentsByKeyword(query)
  if (first.chunks.length || !expanded?.terms.length) return first
  const second = await searchDocumentsByKeyword(expanded.semantic)
  return { ...second, latencyMs: first.latencyMs + second.latencyMs, bridged: true }
}

// The RPC gets the EXPANDED query; boostNamedPages gets the ORIGINAL one.
// Feeding the expanded string to both would make every case-study page count as
// "named" for any work question, flattening the boost exactly when it fires.
// Returned as a pair so that invariant is testable rather than merely commented.
export function buildSiteSearchArgs(queryText) {
  return { rpcQuery: expandSiteQuery(queryText), boostQuery: queryText }
}

async function siteChunkSearch(queryText, persona) {
  const { rpcQuery, boostQuery } = buildSiteSearchArgs(queryText)
  const t0 = Date.now()

  // Semantic leg, on its own budget and resolved BEFORE the Supabase timer is
  // armed, so Voyage latency cannot be charged to the retrieval budget. The
  // database still carries the original hybrid function; only the caller had
  // stopped passing a vector. A failed OR SLOW embedding degrades to the
  // keyword RPC exactly as the pre-change code behaved.
  const voyageKey = process.env.VOYAGE_API_KEY
  let embedding = null
  let siteEmbedTokens = 0
  if (voyageKey) {
    try {
      const embedded = await embedSiteQuery(rpcQuery, voyageKey)
      embedding = embedded.embedding
      siteEmbedTokens = embedded.tokens
    } catch (err) {
      console.warn('[rag] site embed failed, keyword only:', err.message)
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SITE_SEARCH_TIMEOUT_MS)
  try {
    const key = persona.rag.supabaseKey()
    const rpc = embedding ? 'search_site_chunks_hybrid_public' : 'search_site_chunks_public'
    const body = embedding
      ? { query_text: rpcQuery, query_embedding: embedding, match_count: 16 }
      : { query_text: rpcQuery, match_count: 12 }
    const response = await fetch(`${persona.rag.supabaseUrl()}/rest/v1/rpc/${rpc}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!response.ok) throw new Error(`Supabase site search failed: ${response.status}`)
    const rows = await response.json()
    return {
      chunks: boostNamedPages(boostQuery, rows.map(siteChunkToDocument)),
      latencyMs: Date.now() - t0,
      embedTokens: siteEmbedTokens,
      embedModel: embedding ? SITE_EMBED_MODEL : null,
    }
  } catch (err) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') throw new Error(`Supabase search timeout (>${SITE_SEARCH_TIMEOUT_MS}ms)`)
    throw err
  }
}

// Tool definition per persona (same name everywhere; the description is the
// persona's — cloudyjoe speaks in Joe's first person, JTS searches a site).
export function portfolioTool(persona = getPersona()) {
  return { ...PORTFOLIO_TOOL, description: persona.searchTool.description }
}

export const PORTFOLIO_TOOL = {
  name: 'search_portfolio',
  description: getPersona().searchTool.description,
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to find relevant portfolio content',
      },
    },
    required: ['query'],
  },
}

// ---------------------------------------------------------------------------
// RAG: embed query via Voyage AI REST API (Edge-compatible)
// ---------------------------------------------------------------------------

// Bounded like the site corpus's embed (EMBED_TIMEOUT_MS). Until 2026-10-02
// this call had no limit: a Voyage connection accepted and never answered held
// a chat search until the 55s first-words ceiling, and a voice search until the
// widget's own 10s timeout. A slow or failed embed falls back to keyword mode
// (searchPortfolio's catch below).
export async function embedQuery(query) {
  const t0 = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS)
  try {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'voyage-3-lite',
        input: query,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Voyage AI embedding failed: ${response.status}`)
    }

    const data = await response.json()
    return {
      embedding: data.data[0].embedding,
      latencyMs: Date.now() - t0,
      totalTokens: data.usage?.total_tokens || 0,
    }
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(`Voyage AI embedding timeout (>${EMBED_TIMEOUT_MS}ms)`)
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// RAG: hybrid search via Supabase RPC (Edge-compatible)
// ---------------------------------------------------------------------------

export async function searchDocuments(queryText, queryEmbedding) {
  const t0 = Date.now()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2000) // 2s timeout (cold start can be slow)

  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rpc/hybrid_search`,
      {
        method: 'POST',
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query_text: queryText,
          query_embedding: queryEmbedding,
          match_count: 10,
          semantic_weight: 0.7,
          keyword_weight: 0.3,
        }),
        signal: controller.signal,
      },
    )

    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`Supabase search failed: ${response.status}`)
    }

    const chunks = await response.json()
    return {
      chunks,
      latencyMs: Date.now() - t0,
    }
  } catch (err) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') {
      throw new Error('Supabase search timeout (>2s)')
    }
    throw err
  }
}

// Keyword-only retrieval (no embedding provider configured)
export async function searchDocumentsByKeyword(queryText) {
  const t0 = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2000)
  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rpc/keyword_search`,
      {
        method: 'POST',
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query_text: queryText, match_count: 10 }),
        signal: controller.signal,
      },
    )
    clearTimeout(timeout)
    if (!response.ok) {
      throw new Error(`Supabase keyword search failed: ${response.status}`)
    }
    const chunks = await response.json()
    return { chunks, latencyMs: Date.now() - t0 }
  } catch (err) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') {
      throw new Error('Supabase search timeout (>2s)')
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// RAG: rerank helpers
// ---------------------------------------------------------------------------

// What Voyage reads for a cloudyjoe (documents) chunk. Those chunks are bare
// section text (scripts/export-chunks.ts), so without the article and section
// names a reranker cannot tell which project a paragraph is about.
export function documentText(chunk) {
  const meta = chunk?.metadata || {}
  const head = [meta.article_id, meta.section_id].filter(Boolean).join(' — ')
  return head ? `${head}\n${chunk.content}` : chunk.content
}

/** Pick up to 5 chunks ensuring every distinct article gets at least 1 slot */
export function diversifyByArticle(ranked) {
  const result = []
  const seenArticles = new Set()

  // Pass 1: first chunk from each distinct article (preserving rank order)
  for (const chunk of ranked) {
    const articleId = chunk.metadata?.article_id
    if (!seenArticles.has(articleId)) {
      seenArticles.add(articleId)
      result.push(chunk)
    }
  }

  // Pass 2: fill remaining slots with best remaining chunks (rank order)
  for (const chunk of ranked) {
    if (result.length >= 5) break
    if (!result.includes(chunk)) {
      result.push(chunk)
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// RAG: format chunks for tool_result + extract sources for badges
// ---------------------------------------------------------------------------

// `spoken`: the text goes to the voice model to be read out (the voice search's
// raw-chunk fallback), so a fact card loses its guide lines (retrieval phrasings,
// wording rule, provenance). Everywhere else the model sees the whole card.
const stripCardGuides = (content) => String(content ?? '')
  .split('\n')
  .filter((line) => !FACT_CARD_GUIDE_PREFIXES.some((p) => line.trimStart().startsWith(p)))
  .join('\n')

export function formatChunksForContext(chunks, { spoken = false } = {}) {
  return chunks.map((c, i) => {
    const meta = c.metadata || {}
    // Site personas label by corpus (`kind`), never by section id: cloudyjoe's
    // articles all carry a `faq` section that must keep its first-person label.
    const source = meta.kind === 'site'
      ? (meta.section_id === 'faq'
        ? `[Curated FAQ: ${meta.title || meta.article_id}]`
        : `[From the site page: ${meta.page_path || meta.article_id}]`)
      : meta.article_id === FACT_CARDS_ID
        ? `[Curated fact card: ${meta.section_id}]`
        : meta.article_id ? `[From Joe's article: ${meta.article_id}, section: ${meta.section_id}]` : ''
    const content = spoken && meta.article_id === FACT_CARDS_ID ? stripCardGuides(c.content) : c.content
    return `--- Your content ${i + 1} ${source} ---\n${content}`
  }).join('\n\n')
}

export function extractSources(chunks) {
  const seenArticles = new Set()
  const sources = []
  for (const c of chunks) {
    let meta = c.metadata || {}
    // A fact card (scripts/export-chunks.ts) badges as the cloudyjoe article it
    // belongs to; a card with no article has no page to link, so no badge.
    if (meta.article_id === FACT_CARDS_ID) {
      const route = ARTICLE_ROUTES[meta.badge_article_id]
      if (!route) continue
      meta = { article_id: meta.badge_article_id, section_id: 'main', section_anchor: '', page_path: route.page_path_en, article_slug: route.page_path_en.slice(1) }
    }
    // One badge per article — keep the highest-ranked section (first occurrence)
    if (seenArticles.has(meta.article_id)) continue
    seenArticles.add(meta.article_id)
    sources.push({
      article_id: meta.article_id,
      section_id: meta.section_id,
      section_anchor: meta.section_anchor || '',
      // The corpus (scripts/export-chunks.ts) writes page_path / article_slug;
      // older chunks may carry the *_en / *_es variants.
      page_path_en: meta.page_path_en || meta.page_path || '',
      page_path_es: meta.page_path_es || meta.page_path || '',
      article_slug_en: meta.article_slug_en || meta.article_slug || '',
      article_slug_es: meta.article_slug_es || meta.article_slug || '',
      ...(meta.kind === 'site' ? { title: meta.title || '' } : {}),
    })
  }
  return sources
}

/**
 * Site personas: keep a retrieved page only when the answer names its path,
 * its title or its slug words ("private ai setup"); otherwise fall back to
 * the top hit. Mirrors filterSourcesByResponse for the article corpus. Max 3.
 */
export function filterSiteSources(sources, responseText) {
  const pages = sources.filter(s => s.page_path_en)
  if (!responseText || pages.length === 0) return pages.slice(0, 3)
  const lower = responseText.toLowerCase()
  const matched = pages.filter(s => {
    const path = s.page_path_en.toLowerCase()
    if (path !== '/' && lower.includes(path)) return true
    // Multi-word slugs ("private ai setup") as a phrase; a single word only
    // for top-level pages ("contact", "services") — on a nested page such as
    // /private-ai-setup/industries/construction it is too common to prove use
    const parts = path.split('/').filter(Boolean)
    const slug = parts[parts.length - 1] || ''
    if (slug.includes('-') && mentions(lower, slug.replace(/-/g, ' '))) return true
    if (parts.length === 1 && slug && mentions(lower, slug)) return true
    const titleHead = (s.title || '').split('|')[0].trim().toLowerCase()
    return titleHead.length >= 8 && mentions(lower, titleHead)
  })
  return (matched.length > 0 ? matched : pages.slice(0, 1)).slice(0, 3)
}

// Two keyword tables (ids/paths mirror src/articles/registry.ts — keep in sync):
// ARTICLE_KEYWORDS — broad tokens used to KEEP a retrieved source when the
//   answer references its subject (paraphrases included).
// ARTICLE_DETECT_KEYWORDS — narrow tokens used to ADD a badge from the answer
//   text alone (no retrieval), so a passing mention of "Hermes" in an answer
//   about another project does not attach the Hermes badge.
export const ARTICLE_KEYWORDS = {
  'self-healing-chatbot': ['self-healing', 'this chat', 'closed-loop', 'langfuse', 'evals'],
  'career-ops':           ['career-ops', 'career ops'],
  'hermes':               ['hermes', 'openclaw', 'lurkr'],
  'turnover-agent':       ['turnover', 'nick', 'airbnb', 'vrbo', 'short-term rental', 'short-term-rental', 'property manager'],
  'archive-beta-loop':    ['archive', 'salon', 'van '],
  'cbarrgs-agent':        ['cbarrgs', 'musician', 'merch', 'shopify'],
  'skate-workshop-loop':  ['skate', 'willy'],
}

export const ARTICLE_DETECT_KEYWORDS = {
  'self-healing-chatbot': ['self-healing chatbot', 'this chat', 'langfuse trac', 'agentic rag', 'stack behind me'],
  'career-ops':           ['career-ops', 'career ops'],
  'hermes':               ['hermes migration', 'openclaw', 'lurkr', '22-agent', '22 agents'],
  'turnover-agent':       ['turnover agent', 'turnover-agent'],
  'archive-beta-loop':    ['archive beta', 'archive-beta', 'archive salon', 'archive loop'],
  'cbarrgs-agent':        ['cbarrgs'],
  'skate-workshop-loop':  ['skate workshop', 'skate-workshop', 'willy santos'],
}

/** Filter RAG sources to only articles actually mentioned in the response, max 3 */
export function filterSourcesByResponse(sources, responseText) {
  if (!responseText || sources.length === 0) return sources
  const lower = responseText.toLowerCase()
  const matched = sources.filter(s => {
    const keywords = ARTICLE_KEYWORDS[s.article_id]
    if (!keywords) return true // unknown article — keep it
    return keywords.some(kw => lower.includes(kw))
  })
  // Retrieval already ranked these; if the answer names none of them, keep
  // the top hit instead of collapsing to the home badge.
  return (matched.length > 0 ? matched : sources.slice(0, 1)).slice(0, 3)
}

// Static article routes — used to generate badges from keywords regardless of RAG
// (single-language site: the ES path is the same route)
export const ARTICLE_ROUTES = {
  'self-healing-chatbot': { page_path_es: '/self-healing-chatbot', page_path_en: '/self-healing-chatbot' },
  'career-ops':           { page_path_es: '/career-ops-system', page_path_en: '/career-ops-system' },
  'hermes':               { page_path_es: '/hermes', page_path_en: '/hermes' },
  'turnover-agent':       { page_path_es: '/turnover-agent', page_path_en: '/turnover-agent' },
  'archive-beta-loop':    { page_path_es: '/archive-beta-loop', page_path_en: '/archive-beta-loop' },
  'cbarrgs-agent':        { page_path_es: '/cbarrgs-agent', page_path_en: '/cbarrgs-agent' },
  'skate-workshop-loop':  { page_path_es: '/skate-workshop-loop', page_path_en: '/skate-workshop-loop' },
}

// Home fallback
export const HOME_SOURCE = {
  article_id: 'home',
  section_id: 'portfolio',
  section_anchor: '',
  page_path_en: '/en',
  page_path_es: '/',
  article_slug_en: 'en',
  article_slug_es: '',
}

/** Detect articles mentioned in response text and generate source badges */
export function detectMentionedArticles(responseText) {
  if (!responseText) return []
  const lower = responseText.toLowerCase()
  const found = []
  for (const [articleId, keywords] of Object.entries(ARTICLE_DETECT_KEYWORDS)) {
    const positions = keywords.map(kw => lower.indexOf(kw)).filter(i => i >= 0)
    if (positions.length === 0) continue
    const routes = ARTICLE_ROUTES[articleId]
    if (!routes) continue
    found.push({
      idx: Math.min(...positions),
      source: {
        article_id: articleId,
        section_id: 'main',
        section_anchor: '',
        page_path_es: routes.page_path_es,
        page_path_en: routes.page_path_en,
        article_slug_es: routes.page_path_es.slice(1),
        article_slug_en: routes.page_path_en.slice(1),
      },
    })
  }
  // Rank by first mention so the article the answer is about wins the 3 slots
  return found.sort((a, b) => a.idx - b.idx).slice(0, 3).map(f => f.source)
}

// ---------------------------------------------------------------------------
// RAG: full agentic search pipeline
// ---------------------------------------------------------------------------

export async function searchPortfolio(query, trace, anthropicClient, persona = getPersona()) {
  const result = {
    chunks: null,
    sources: [],
    degraded: false,
    degradedReason: null,
    metrics: { embeddingMs: 0, retrievalMs: 0, rerankMs: 0 },
    // embeddingModel/rerankModel travel WITH the token counts so the caller
    // prices what actually ran. The site path and the cloudyjoe path use
    // different Voyage models, and the fallback reranker is an LLM.
    usage: { embeddingTokens: 0, rerankInputTokens: 0, rerankOutputTokens: 0,
             embeddingModel: null, rerankModel: null },
    mode: persona.rag.kind === 'site_chunks' ? 'site' : hasEmbeddings(persona) ? 'hybrid' : 'keyword',
  }

  // The cloudyjoe corpus embeds with the work bridge applied (see
  // expandDocumentsQuery); the site corpus expands inside siteChunkSearch.
  const expanded = result.mode === 'site' ? null : expandDocumentsQuery(query)
  if (expanded?.matched.length) result.expandedFor = expanded.matched

  // 1. Embed (hybrid mode only)
  let embedding
  if (result.mode === 'hybrid') {
    const embeddingGen = trace?.generation({ name: 'embedding', model: 'voyage-3-lite', metadata: { query, expanded: expanded?.semantic } })
    try {
      const embResult = await embedQuery(expanded.semantic)
      embedding = embResult.embedding
      result.metrics.embeddingMs = embResult.latencyMs
      result.usage.embeddingTokens = embResult.totalTokens
      result.usage.embeddingModel = 'voyage-3-lite'
      embeddingGen?.end({
        usage: { input: embResult.totalTokens, output: 0 },
        metadata: { latencyMs: embResult.latencyMs },
      })
    } catch (err) {
      // Embedding provider down or key revoked: fall back to keyword retrieval
      // instead of taking RAG dark.
      embeddingGen?.end({ metadata: { error: err.message, fallback: 'keyword' } })
      result.mode = 'keyword'
      result.embeddingError = err.message
    }
  }

  // 2. Retrieve
  const retrievalSpan = trace?.span({ name: 'retrieval', metadata: { query, mode: result.mode } })
  try {
    const searchResult = result.mode === 'site'
      ? await siteChunkSearch(query, persona)
      : result.mode === 'hybrid'
        ? await searchDocuments(query, embedding)
        : await keywordSearchWithBridge(query, expanded)
    result.metrics.retrievalMs = searchResult.latencyMs
    // The site path embeds inside siteChunkSearch (its own budget), so its
    // usage surfaces here rather than in the `hybrid` block above.
    if (searchResult.embedModel) {
      result.usage.embeddingTokens = searchResult.embedTokens || 0
      result.usage.embeddingModel = searchResult.embedModel
    }
    retrievalSpan?.end({
      metadata: {
        chunksCount: searchResult.chunks.length,
        topSimilarity: searchResult.chunks[0]?.similarity || 0,
        latencyMs: searchResult.latencyMs,
      },
    })

    if (!searchResult.chunks.length) {
      result.degradedReason = 'no_match'
      return result
    }

    // Filter out low-similarity chunks before reranking. Keyword mode already
    // returns only matching rows and ts_rank is not on the cosine scale.
    const filteredChunks = result.mode === 'hybrid'
      ? searchResult.chunks.filter(c => (c.similarity || 0) >= 0.3)
      : searchResult.chunks.filter(c => (c.similarity || 0) > 0)
    if (!filteredChunks.length) {
      result.degradedReason = 'no_match'
      return result
    }

    // 3. Re-rank, with Voyage on both corpora (one ~100-400ms call that reads
    // the full chunk text; 700ms cap). Until 2026-10-02 the cloudyjoe corpus
    // always ranked with an LLM call on the thinking chat model (up to 2.5s,
    // 200-character previews), and on the voice path that pushed retrieval past
    // the reasoning step's start gate, so callers got raw chunks. Voyage
    // returns null with no key, too few candidates (6 or fewer) or a failure,
    // and the fused order stands.
    //
    // The documents corpus ranks with the bridged query (expandDocumentsQuery,
    // the same text it was embedded with): ranked on the visitor's words alone,
    // "a store for a musician selling t-shirts" could demote the Cbarrgs chunk
    // the bridge found.
    const t0Rerank = Date.now()
    const rankQuery = result.mode === 'site' ? query : (expanded?.semantic || query)
    const ranked = filteredChunks.length > 5
      ? await voyageRerank(rankQuery, filteredChunks, 6, result.mode === 'site' ? undefined : documentText)
      : null
    // diversifyByArticle is NOT optional. The old site path always ran it, so a
    // /portfolio answer was guaranteed one chunk per distinct page. Voyage ranks
    // purely by relevance and will happily return six chunks of a single case
    // study — a regression on exactly the "examples of his work" query this
    // exists to fix, and worst on voice, where rag-search.js speaks the chunks
    // verbatim.
    const rerankResult = { chunks: diversifyByArticle(ranked ?? filteredChunks.slice(0, 5)), latencyMs: Date.now() - t0Rerank }
    result.metrics.rerankMs = rerankResult.latencyMs
    result.usage.rerankModel = ranked ? SITE_RERANK_MODEL : null
    if (ranked) {
      trace?.generation({ name: 'reranking', model: SITE_RERANK_MODEL, metadata: { query: rankQuery } })
        ?.end({ metadata: { latencyMs: rerankResult.latencyMs } })
    }

    result.chunks = rerankResult.chunks

    // Site mode: a reranker can drop the very page the query named ("What is
    // the Private AI Setup?" → /private-ai-setup); pin those back in front.
    // Per page, one chunk, and only for pages the rerank did not keep, so the
    // rerank's own picks survive when the named page was already in them.
    if (result.mode === 'site') {
      const kept = new Set(result.chunks.map(c => c.metadata?.article_id))
      const pinned = []
      for (const c of filteredChunks) {
        if (!c.metadata?.named || kept.has(c.metadata.article_id)) continue
        kept.add(c.metadata.article_id)
        pinned.push(c)
      }
      if (pinned.length) result.chunks = [...pinned, ...result.chunks].slice(0, 5)
    }
    // Badges, evals and traces must describe what the model actually saw
    result.sources = extractSources(result.chunks)
  } catch (err) {
    retrievalSpan?.end({ metadata: { error: err.message } })
    result.degraded = true
    result.degradedReason = err.message.includes('timeout') ? 'retrieval_timeout' : 'retrieval_fail'
  }

  return result
}

// ---------------------------------------------------------------------------
// Intent classification (keyword-based, no extra LLM cost)
// ---------------------------------------------------------------------------

// Prompt-attack phrasing, matched on word boundaries (see classifyIntent).
const JAILBREAK_RES = [
  /\bignore (?:all |any )?(?:of )?(?:your |the |my |these |those )?(?:previous|prior|above|earlier|preceding)\b/,
  // "ignore the rules our old vendor set" is a visitor, not an attack: a bare
  // "the" never counts — only all/any/every/your.
  /\bignore (?:all |any |every |your )(?:of )?(?:your |the |these |those )?(?:instructions|rules|guidelines|restrictions)\b/,
  /\b(?:disregard|forget|override|bypass) (?:(?:all|any|every) (?:of )?(?:your |the |these |those )?|your |(?:the )?(?:previous|prior|above|earlier|system|original) )(?:(?:previous|prior|above|earlier|system|original) )?(?:instructions|rules|prompt|guidelines|restrictions|programming)\b/,
  // "forget all that, I just need a website" is a visitor too.
  /\bforget (?:everything|all) (?:you (?:were|have been|know)|(?:that )?(?:above|before this)|your )/,
  /\b(?:you are now|from now on you are)\b/,
  /\bpretend (?:you|to be|that you)\b/,
  /\brole-?play as\b/,
  /\blet'?s role-?play(?: as\b|:)/,
  /\bjailbr(?:ea|o)k/,
  /\b(?:do anything now|dan mode|you are dan|developer mode|god mode)\b/,
  /\b(?:enable|activate) dan\b/,
  /\bact as (?:an? )?(?:unrestricted|unfiltered|uncensored|jailbroken|evil|rogue)\b/,
  // "can you write a system prompt for our bot?" is a prospect.
  /\b(?:your|tu) (?:(?:complete|full|entire|original|hidden|exact|real) )?(?:system )?prompt\b/,
  /\b(?:reveal|show|print|repeat|output|dump) (?:me )?(?:the |your )?system prompt\b/,
  // Instructions and directives are the agent's own; "your rules about
  // refunds" is a customer question, so rules/orders/objective count only as
  // a pair ("your rules and instructions", "your objective and orders").
  /\byour (?:(?:hidden|secret|system|original|initial|internal|real|full|exact|complete|current) )?(?:instructions|directives)\b/,
  /\byour (?:rules|orders|objective|directives|instructions) and (?:your )?(?:rules|orders|objective|directives|instructions)\b/,
  /\btus (?:instrucciones|reglas|órdenes)\b/,
  /\b(?:reveal|show|print|output|dump|display) (?:me )?your (?:(?:hidden|secret|system|full|current|complete|internal) )?(?:configuration|config)\b/,
  /\b(?:rules|reglas) (?:configured|configuradas)\b/,
  /\b(?:reveal|show me|print|repeat|output|write|copy|dump) (?:all |me )?(?:everything|all) (?:above|before this|you were (?:told|given))\b/,
  /\b(?:repeat|print|output|copy) (?:everything|all)(?: of)? (?:the )?(?:above|text above|messages above)\b/,
  /\beverything above\b/,
  /\b(?:print|output) (?:all|everything)\b/,
  /\bshow me your rules\b/,
  /\breset your (?:instructions|rules|memory|prompt|personality)\b/,
  /\bjson record\b/,
  // A new rule set pasted at the top of a message, not "I need new instructions: how do I start?"
  /^\s*new instructions:|\byour new instructions\b/,
  /\bignora (?:las |todas las |tus )?instrucciones\b/,
  /\bignora todo\b/,
  /\bolvida todo\b/,
  /\bnueva personalidad\b/,
  /\bprotocolo de defensa\b/,
  /\bcuáles son tus instrucciones\b/,
  /\b(?:muestra|imprime|repite) todo\b/,
  /\btodo lo anterior\b/,
]

export function classifyIntent(text) {
  const lower = text.toLowerCase()
  const tags = []

  // Whole words and phrases only. The old list matched substrings, so "dan"
  // fired on dana@…, "standard", "guidance" and "Jordan", "act as" on "contact
  // as", "evil" on "medieval" — and every hit emails Joe a JAILBREAK alert
  // (found 2026-09-26: a real lead, "my email is dana@example.com — can I get a
  // price?", was reported as an attack). This tag only drives alerts and ops
  // filters; the agent's own guardrails handle the attacks themselves.
  if (JAILBREAK_RES.some((re) => re.test(lower))) {
    tags.push('jailbreak-attempt')
  }

  if (/experiencia|experience|trabajo|work|career|carrera|joblas|joseph blas/.test(lower)) tags.push('topic:experience')
  if (/proyecto|project|portfolio|github|código|code/.test(lower)) tags.push('topic:projects')
  if (/contact|contacto|email|linkedin|hablar|talk|hire|contratar/.test(lower)) tags.push('topic:contact')
  if (/stack|tech|tecnolog|python|react|airtable|claude|ai|ia|llm|agente|agent/.test(lower)) tags.push('topic:technical')
  if (/salario|salary|money|dinero|rate|precio|cobr/.test(lower)) tags.push('topic:compensation')
  if (/hola|hello|hi|hey|buenos|good/.test(lower) && text.length < 20) tags.push('greeting')

  return tags.length > 0 ? tags : ['topic:general']
}

// ---------------------------------------------------------------------------
// Jailbreak alert
// ---------------------------------------------------------------------------

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

export async function sendJailbreakAlert(userMessage) {
  if (!process.env.RESEND_API_KEY || !process.env.ALERT_EMAIL) return

  // Runs in the background (waitUntil): bounded, and it must never throw.
  try {
    const res = await boundedFetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Cloudy-Joe Agent <alerts@subscribe.joestechsolutions.com>',
        to: process.env.ALERT_EMAIL,
        subject: '🚨 JAILBREAK ATTEMPT - cloudyjoe.com',
        html: `
          <h2>🚨 Jailbreak Attempt Detected</h2>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>User message:</strong></p>
          <blockquote style="background: #f5f5f5; padding: 15px; border-left: 4px solid #e74c3c;">
            ${escapeHtml(userMessage.slice(0, 500))}${userMessage.length > 500 ? '...' : ''}
          </blockquote>
          <p style="margin-top: 20px;">
            <a href="https://cloud.langfuse.com" style="background: #e74c3c; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              View in Langfuse
            </a>
          </p>
        `,
      }),
    }, 8000)
    if (!res.ok) console.error(`[alert] jailbreak alert failed: HTTP ${res.status}`)
  } catch (err) {
    console.error('[alert] jailbreak alert failed:', err?.message)
  }
}

// ---------------------------------------------------------------------------
// Prompt leak detection
// ---------------------------------------------------------------------------

export const PROMPT_FINGERPRINTS = [
  'BREVEDAD OBLIGATORIA', 'máximo 150 palabras', '150 words', 'word limit',
  'formato sin listas', 'redirección ingeniosa', 'NUNCA revelar',
  'Anti-extracción', 'Instrucciones CRÍTICAS', 'cache_control',
  'never_exceed', 'token_budget',
]

export const LEAK_RESPONSE = 'That information is part of my internal design. The project source code is public on GitHub if you are interested in the architecture.'

// Lowered once: every chunk of every answer is checked (reply-text.js).
const FINGERPRINTS_LOWER = PROMPT_FINGERPRINTS.map(fp => fp.toLowerCase())

export function containsFingerprint(text) {
  const lower = text.toLowerCase()
  return FINGERPRINTS_LOWER.some(fp => lower.includes(fp))
}
