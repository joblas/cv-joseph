import { CHAT_MODEL, scaleTokens, createAnthropicClient, createWithin } from './_shared/models.js'
import { resolvePersona } from './_shared/personas.js'
import { Langfuse } from 'langfuse'
import {
  searchPortfolio, formatChunksForContext, calcCost,
  filterSourcesByResponse, filterSiteSources, detectMentionedArticles, HOME_SOURCE,
} from './_shared/rag.js'
import { getSystemPrompt } from './_shared/prompt.js'
import { checkRateLimit } from './_shared/leads.js'

export const config = {
  runtime: 'edge',
}

const client = createAnthropicClient()

let langfuseClient = null
function getLangfuse() {
  if (!langfuseClient && process.env.LANGFUSE_SECRET_KEY) {
    langfuseClient = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL,
    })
  }
  return langfuseClient
}

// ---------------------------------------------------------------------------
// Claude reasoning layer — turns raw RAG chunks into a verified answer
// ---------------------------------------------------------------------------

// Spoken-answer contract appended to the persona prompt. The identity clause is
// the persona's own, so each face names itself (see api/_shared/personas.js).
const voiceOverride = (persona) => `Response for spoken conversation. Up to 4-5 sentences, most important first — the voice agent shortens it for a first answer and needs the fuller material when a caller asks for more. No markdown or links. Natural spoken language. Be precise with context data — never make things up, and never pad to reach a length: if the context holds nothing beyond what the question already covers, say that is what the site has. ${persona.spokenIdentity ?? "You are Joe's AI agent"}: speak about Joe in the THIRD PERSON ("Joe built...", "his project...") — never "I built..." or "my project...".`

// The voice model speaks whatever comes back, so the "no markdown" contract
// is enforced here rather than trusted to the LLM (glm ignores it sometimes).
export function toSpokenText(text) {
  return String(text || '')
    .replace(/\[([^\]\n]+)\]\([^)\n]*\)/g, '$1') // links → their text (single line)
    .replace(/`{1,3}([^`\n]*)`{1,3}/g, '$1')
    .replace(/^#{1,6}[ \t]+/gm, '')
    .replace(/\*\*|__/g, '')
    // *emphasis* / _emphasis_ on one line only; the closer must end the word so
    // an unbalanced marker never swallows an underscore inside snake_case
    .replace(/(^|\s)[*_](\S[^*_\n]*?)[*_](?![A-Za-z0-9])/g, '$1$2')
    .replace(/^[ \t]*[-*•][ \t]+/gm, '')
    .replace(/[ \t]*->[ \t]*/g, ': ')
    .replace(/https?:\/\/[^\s,;)]+/g, '')
    .replace(/[*`]/g, '') // any stray marker would be read aloud
    .replace(/[ \t]+/g, ' ')
    // line breaks become sentence pauses unless the line already ends in punctuation
    .replace(/([^.!?:;,\s])[ \t]*\n+/g, '$1. ')
    .replace(/\n+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

// ONE time budget for the whole voice search, from the request's arrival: the
// caller hears dead air until it answers. Until 2026-10-02 retrieval had a
// 1500ms gate and reasoning a separate 3000ms race, so the worst case was
// 4.5s, and the losing reasoning call kept running (and could be retried by
// the SDK) after its answer was no longer wanted. Now reasoning runs only when
// at least voiceReasonMinMs() of the budget is left, inside what is left
// (createWithin: aborted at the limit, never retried), and otherwise the
// caller hears the retrieved excerpts, exactly the old tier 2.
//
// The minimum is the reasoning call's own healthy length at effort "high"
// (1.4-1.9s locally for a 4-5 sentence answer, an estimated 1.2-1.7s in
// production): starting one with less left only buys silence followed by the
// excerpts anyway. Tune both from the Server-Timing header.
// VOICE_SEARCH_BUDGET_MS=0 never reasons. VOICE_REASON_TIMEOUT_MS, when set,
// caps the reasoning call below what the budget leaves.
const envMs = (name, fallback) => {
  const raw = process.env[name]
  if (raw === undefined || String(raw).trim() === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}
export const voiceSearchBudgetMs = () => envMs('VOICE_SEARCH_BUDGET_MS', 2500)
export const voiceReasonMinMs = () => envMs('VOICE_REASON_MIN_MS', 1500)
const voiceReasonCapMs = () => envMs('VOICE_REASON_TIMEOUT_MS', Infinity) || Infinity

async function reasonWithClaude(query, formattedChunks, span, langfuse, persona, ms) {
  const t0 = Date.now()
  const reasoningSpan = span?.span({ name: 'claude-reasoning', metadata: { query } })

  try {
    const { text: systemPromptText } = await getSystemPrompt(langfuse, persona)
    const left = ms - (Date.now() - t0)
    if (left <= 0) throw new Error('no time left to reason')

    const response = await createWithin(client, {
      model: CHAT_MODEL,
      max_tokens: scaleTokens(300),
      system: `${systemPromptText}\n\n${voiceOverride(persona)}`,
      messages: [
        { role: 'user', content: query },
        {
          role: 'assistant',
          content: [{
            type: 'tool_use',
            id: 'voice_rag_call',
            name: 'search_portfolio',
            input: { query },
          }],
        },
        {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: 'voice_rag_call',
            content: formattedChunks,
          }],
        },
      ],
    }, left)

    const answer = toSpokenText(response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join(''))

    const inputTokens = response.usage?.input_tokens || 0
    const outputTokens = response.usage?.output_tokens || 0
    const latencyMs = Date.now() - t0

    reasoningSpan?.end({
      metadata: {
        inputTokens,
        outputTokens,
        latencyMs,
        cost: calcCost(CHAT_MODEL, inputTokens, outputTokens),
      },
    })

    return answer || null
  } catch (err) {
    reasoningSpan?.end({ metadata: { error: err.message, latencyMs: Date.now() - t0 } })
    return null // fallback to raw chunks
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req) {
  // The search budget and the Server-Timing header count from here.
  const arrived = Date.now()
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.json()
    const { query, traceId, currentPage } = body
    const persona = resolvePersona(body, req)

    // traceId is OPTIONAL, and must stay optional. It is observability
    // plumbing — the Langfuse trace the voice session opened — not
    // authentication. This handler used to answer a missing one with a 401,
    // and that check did two things, both wrong:
    //
    //   - It excluded no attacker. Any non-empty string passed; nothing
    //     compared it to a trace the server had actually issued.
    //   - It excluded every real visitor whenever tracing is off. voice-token
    //     returns traceId: null when LANGFUSE_* is unset, which has been
    //     production's normal state since the Cloudflare move. So every voice
    //     search 401'd, the widget turned the 401 into "No relevant content
    //     found.", and the voice agent — on both sites — told callers the site
    //     had no details about things it covers at length. Reproduced
    //     2026-09-25 against production: the agent searched on exactly the
    //     turns that needed it and was told, every time, that nothing existed.
    //
    // The real control is a per-IP rate limit. This is the same limiter and
    // the same per-IP counter as /api/chat (check_chat_rate_limit keys on the
    // IP alone), so one address is capped across both: a voice session
    // searches a handful of times, and 60 an hour is far past normal use.
    // Like chat's, it fails open — a limiter outage must not take voice down.
    const rl0 = Date.now()
    const allowed = await checkRateLimit(req, 60)
    const timing = { rl: Date.now() - rl0 }
    // Where a voice search's time went (Server-Timing; integer ms and a tier
    // name, no content): rl, retrieve, rerank, reason, total; tier = reasoned
    // (the model's answer), chunks (the excerpts), empty, or failed.
    const timed = (tier) => ({
      'Content-Type': 'application/json',
      'Server-Timing': [
        ...Object.entries(timing).map(([k, v]) => `${k};dur=${Math.round(v)}`),
        `total;dur=${Date.now() - arrived}`, `tier;desc=${tier}`,
      ].join(', '),
    })
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (typeof query !== 'string' || !query.trim()) {
      return new Response(JSON.stringify({ error: 'Missing query' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    // A voice query is a short phrase the model wrote. Nothing longer is a
    // search; it is a payload. chat.js caps messages at 2000; this is tighter.
    const searchQuery = query.slice(0, 500)

    // Create span under existing voice trace if provided
    const langfuse = getLangfuse()
    let trace = null
    if (langfuse && traceId) {
      trace = langfuse.trace({ id: traceId })
    }
    const ragSpan = trace?.span({ name: 'voice-rag', metadata: { query: searchQuery } })

    try {
      const r0 = Date.now()
      const ragResult = await searchPortfolio(searchQuery, ragSpan, client, persona)
      timing.retrieve = Date.now() - r0
      timing.rerank = ragResult.metrics?.rerankMs || 0

      // A FAILED retrieval must not be reported as an EMPTY one. searchPortfolio
      // swallows a Supabase error or timeout, sets degraded=true and returns no
      // chunks — and this handler used to turn that into a 200 saying "No
      // relevant content found.", which no widget can tell apart from a real
      // empty result. The voice prompt treats exactly that string as licence
      // to tell a caller the site does not cover something. So a failure is a
      // 503, and only a search that ran and matched nothing ('no_match', where
      // degraded stays false) may say nothing was found.
      if (ragResult.degraded) {
        ragSpan?.end({ metadata: { degraded: true, reason: ragResult.degradedReason } })
        if (langfuse) await langfuse.flushAsync()
        return new Response(JSON.stringify({ error: 'search_unavailable' }), {
          status: 503,
          headers: timed('failed'),
        })
      }

      const formattedChunks = ragResult.chunks
        ? formatChunksForContext(ragResult.chunks)
        : 'No relevant content found.'

      const sources = ragResult.sources || []

      ragSpan?.end({
        metadata: {
          chunksFound: ragResult.chunks?.length || 0,
          degraded: ragResult.degraded,
          metrics: ragResult.metrics,
        },
      })

      // Reason only with chunks to reason over and time to do it (see
      // voiceSearchBudgetMs): what is left of the budget, capped.
      const left = Math.min(voiceSearchBudgetMs() - (Date.now() - arrived), voiceReasonCapMs())
      let reasonedAnswer = null
      if (ragResult.chunks && voiceSearchBudgetMs() > 0 && left >= voiceReasonMinMs()) {
        const q0 = Date.now()
        reasonedAnswer = await reasonWithClaude(searchQuery, formattedChunks, trace, langfuse, persona, left)
        timing.reason = Date.now() - q0
      }

      // Tier 1: Claude + RAG → reasoned answer
      // Tier 2: RAG only (Claude failed) → raw chunks
      // Tier 3: both failed → handled by catch below
      // Both tiers are spoken verbatim by the voice model, so the raw-chunk
      // fallback must honour the no-markdown contract too.
      // A fact card's guide lines (retrieval phrasings, wording rule) steer the
      // reasoning model above but must never be read aloud, so the spoken
      // fallback formats the chunks without them.
      const spokenChunks = ragResult.chunks
        ? formatChunksForContext(ragResult.chunks, { spoken: true })
        : formattedChunks
      const context = toSpokenText(reasonedAnswer || spokenChunks)

      // Filter sources to articles mentioned in the answer (same logic as chat.js)
      const responseText = reasonedAnswer || ''
      let filteredSources
      if (persona.rag.articleBadges) {
        filteredSources = sources.length > 0
          ? filterSourcesByResponse(sources, responseText)
          : []

        // Enrich with keyword-detected articles not in RAG sources
        const ragArticleIds = new Set(filteredSources.map(s => s.article_id))
        const detected = detectMentionedArticles(responseText)
        for (const d of detected) {
          if (!ragArticleIds.has(d.article_id) && filteredSources.length < 3) {
            filteredSources.push(d)
          }
        }

        // Home fallback when RAG found chunks but no specific article matched
        if (filteredSources.length === 0 && sources.length > 0) {
          filteredSources = [HOME_SOURCE]
        }
      } else {
        filteredSources = filterSiteSources(sources, responseText)
      }

      if (langfuse) await langfuse.flushAsync()

      return new Response(JSON.stringify({ context, sources: filteredSources, currentPage }), {
        headers: timed(reasonedAnswer ? 'reasoned' : ragResult.chunks ? 'chunks' : 'empty'),
      })
    } catch (err) {
      ragSpan?.end({ metadata: { error: err.message } })
      if (langfuse) await langfuse.flushAsync()

      // Was a 200 telling the model to answer from memory,
      // which the voice prompts forbid. A failure is a failure: 503, and the
      // widget tells the model it couldn't look that up.
      return new Response(JSON.stringify({ error: 'search_unavailable' }), {
        status: 503,
        headers: timed('failed'),
      })
    }
  } catch (error) {
    console.error('RAG search error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
