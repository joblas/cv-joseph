// ---------------------------------------------------------------------------
// Shared RAG pipeline — used by api/chat.js (text) and api/rag-search.js (voice)
// ---------------------------------------------------------------------------

import { FAST_MODEL, scaleTokens } from './models.js'
import { getPersona } from './personas.js'

// ---------------------------------------------------------------------------
// Cost tracking per span
// ---------------------------------------------------------------------------

export const MODEL_COSTS = {
  'claude-sonnet-4-6': { input: 3.0 / 1e6, output: 15.0 / 1e6 },
  'claude-haiku-4-5-20251001': { input: 0.25 / 1e6, output: 1.25 / 1e6 },
  'text-embedding-3-small': { input: 0.02 / 1e6 },
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
  // Only the cloudyjoe corpus carries Voyage vectors
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
// The JTS corpus is retrieved lexically: `hasEmbeddings` above admits only
// `kind: 'documents'`, and every one of the 229 site_chunks rows has a NULL
// embedding. A page can therefore only be found through a token it literally
// contains -- and no /portfolio chunk contains the word "example", which is the
// word visitors reach for. Measured against the live index on 2026-09-19:
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
export const JTS_CASE_STUDIES = ['The Skate Workshop', 'RenFaire Directory', 'Cbarrgs Music', 'FixBot']

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
].map((r) => r.source).join('|'), 'i')

export function expandSiteQuery(query) {
  const q = String(query ?? '').trim()
  if (!q || !WORK_INTENT.test(q.replace(/[\u2018\u2019]/g, "'"))) return q
  const lower = q.toLowerCase()
  const additions = ['portfolio', 'case studies', ...JTS_CASE_STUDIES]
    .filter((term) => !lower.includes(term.toLowerCase()))
  return additions.length ? `${q} ${additions.join(' ')}` : q
}

async function siteChunkSearch(queryText, persona) {
  const t0 = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2500)
  try {
    const key = persona.rag.supabaseKey()
    const response = await fetch(`${persona.rag.supabaseUrl()}/rest/v1/rpc/search_site_chunks_public`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query_text: expandSiteQuery(queryText), match_count: 12 }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!response.ok) throw new Error(`Supabase site search failed: ${response.status}`)
    const rows = await response.json()
    return { chunks: boostNamedPages(queryText, rows.map(siteChunkToDocument)), latencyMs: Date.now() - t0 }
  } catch (err) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') throw new Error('Supabase search timeout (>2.5s)')
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

export async function embedQuery(query) {
  const t0 = Date.now()
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
// RAG: re-rank top-10 → top-3 with Haiku
// ---------------------------------------------------------------------------

export async function rerankChunks(query, chunks, anthropicClient) {
  if (chunks.length <= 3) return { chunks, latencyMs: 0, rerankedOrder: null, usage: null }

  const t0 = Date.now()
  try {
    const numbered = chunks.slice(0, 10).map((c, i) =>
      `[${i}] ${c.content.slice(0, 200)}`
    ).join('\n')

    const response = await anthropicClient.messages.create({
      model: FAST_MODEL,
      max_tokens: scaleTokens(150),
      messages: [{
        role: 'user',
        content: `Query: "${query}"\nRank these chunks by relevance. Return ONLY the top 5 IDs as comma-separated numbers (most relevant first):\n${numbered}`,
      }],
    })

    // Thinking models put a `thinking` block before the text block.
    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const ids = text.match(/\d+/g)?.map(Number).filter(n => n < chunks.length) || []

    const ranked = ids.slice(0, 5).map(i => chunks[i])
    // Fill up to 5 if Haiku returned fewer
    while (ranked.length < 5 && ranked.length < chunks.length) {
      const next = chunks.find(c => !ranked.includes(c))
      if (next) ranked.push(next)
      else break
    }

    // Diversify: ensure each distinct article has at least one representative
    const diversified = diversifyByArticle(ranked)

    return {
      chunks: diversified, latencyMs: Date.now() - t0, rerankedOrder: ids.slice(0, 5),
      usage: { input_tokens: response.usage?.input_tokens || 0, output_tokens: response.usage?.output_tokens || 0 },
    }
  } catch {
    // Fallback: use original order with diversity
    const diversified = diversifyByArticle(chunks.slice(0, 5))
    return { chunks: diversified, latencyMs: Date.now() - t0, rerankedOrder: null, usage: null }
  }
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

export function formatChunksForContext(chunks) {
  return chunks.map((c, i) => {
    const meta = c.metadata || {}
    // Site personas label by corpus (`kind`), never by section id: cloudyjoe's
    // articles all carry a `faq` section that must keep its first-person label.
    const source = meta.kind === 'site'
      ? (meta.section_id === 'faq'
        ? `[Curated FAQ: ${meta.title || meta.article_id}]`
        : `[From the site page: ${meta.page_path || meta.article_id}]`)
      : meta.article_id ? `[From your article: ${meta.article_id}, section: ${meta.section_id}]` : ''
    return `--- Your content ${i + 1} ${source} ---\n${c.content}`
  }).join('\n\n')
}

export function extractSources(chunks) {
  const seenArticles = new Set()
  const sources = []
  for (const c of chunks) {
    const meta = c.metadata || {}
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
 * its title or its slug words ("google maps growth"); otherwise fall back to
 * the top hit. Mirrors filterSourcesByResponse for the article corpus. Max 3.
 */
export function filterSiteSources(sources, responseText) {
  const pages = sources.filter(s => s.page_path_en)
  if (!responseText || pages.length === 0) return pages.slice(0, 3)
  const lower = responseText.toLowerCase()
  const matched = pages.filter(s => {
    const path = s.page_path_en.toLowerCase()
    if (path !== '/' && lower.includes(path)) return true
    // Multi-word slugs ("google maps growth") as a phrase; a single word only
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
  'n8n-for-pms':          ['n8n', 'nodemation'],
  'self-healing-chatbot': ['self-healing', 'this chat', 'closed-loop', 'langfuse', 'evals'],
  'career-ops':           ['career-ops', 'career ops'],
  'hermes':               ['hermes', 'openclaw', 'lurkr'],
  'turnover-agent':       ['turnover', 'nick', 'airbnb', 'vrbo', 'short-term rental', 'short-term-rental', 'property manager'],
  'archive-beta-loop':    ['archive', 'salon', 'van '],
  'cbarrgs-agent':        ['cbarrgs', 'musician'],
  'skate-workshop-loop':  ['skate', 'willy'],
}

export const ARTICLE_DETECT_KEYWORDS = {
  'n8n-for-pms':          ['n8n', 'nodemation'],
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
  'n8n-for-pms':          { page_path_es: '/n8n-for-pms', page_path_en: '/n8n-for-pms' },
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
    usage: { embeddingTokens: 0, rerankInputTokens: 0, rerankOutputTokens: 0 },
    mode: persona.rag.kind === 'site_chunks' ? 'site' : hasEmbeddings(persona) ? 'hybrid' : 'keyword',
  }

  // 1. Embed (hybrid mode only)
  let embedding
  if (result.mode === 'hybrid') {
    const embeddingGen = trace?.generation({ name: 'embedding', model: 'voyage-3-lite', metadata: { query } })
    try {
      const embResult = await embedQuery(query)
      embedding = embResult.embedding
      result.metrics.embeddingMs = embResult.latencyMs
      result.usage.embeddingTokens = embResult.totalTokens
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
        : await searchDocumentsByKeyword(query)
    result.metrics.retrievalMs = searchResult.latencyMs
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

    // 3. Re-rank
    const rerankGen = trace?.generation({ name: 'reranking', model: FAST_MODEL, metadata: { query } })
    const rerankResult = await rerankChunks(query, filteredChunks, anthropicClient)
    result.metrics.rerankMs = rerankResult.latencyMs
    if (rerankResult.usage) {
      result.usage.rerankInputTokens = rerankResult.usage.input_tokens
      result.usage.rerankOutputTokens = rerankResult.usage.output_tokens
    }
    rerankGen?.end({
      usage: {
        input: rerankResult.usage?.input_tokens || 0,
        output: rerankResult.usage?.output_tokens || 0,
      },
      metadata: {
        rerankedOrder: rerankResult.rerankedOrder,
        latencyMs: rerankResult.latencyMs,
      },
    })

    result.chunks = rerankResult.chunks

    // Site mode: the LLM rerank only sees 200-char previews and at times drops
    // the very page the query named ("What is the Private AI Setup?" →
    // /private-ai-setup); pin those back in front.
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

export function classifyIntent(text) {
  const lower = text.toLowerCase()
  const tags = []

  const jailbreakPatterns = [
    'ignore previous', 'ignora las instrucciones', 'ignora todo',
    'pretend', 'roleplay', 'act as', 'you are now',
    'forget', 'disregard', 'bypass', 'override', 'jailbreak',
    'dan', 'developer mode', 'evil', 'malicious', 'hackear', 'hacking',
    'system prompt', 'tu prompt', 'your prompt', 'instructions',
    'protocolo de defensa', 'olvida todo', 'nueva personalidad',
    'reset your', 'reveal your', 'show me your rules',
    'your objective', 'your orders', 'tus órdenes', 'tus reglas',
    'cuáles son tus instrucciones', 'rules configured', 'reglas configuradas',
    'print all', 'print everything', 'yaml', 'json record',
    'dump', 'export', 'serialize', 'reproduce', 'output all',
    'all of the above', 'todo lo anterior', 'everything above',
    'repeat everything', 'write all above', 'copy all',
    'show me everything', 'imprime todo', 'muestra todo lo anterior',
    'repite todo', 'exporta', 'convierte a',
  ]
  if (jailbreakPatterns.some(p => lower.includes(p))) {
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

  await fetch('https://api.resend.com/emails', {
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
  })
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

export function containsFingerprint(text) {
  const lower = text.toLowerCase()
  return PROMPT_FINGERPRINTS.some(fp => lower.includes(fp.toLowerCase()))
}
