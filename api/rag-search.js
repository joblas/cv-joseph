import { CHAT_MODEL, scaleTokens, createAnthropicClient } from './_shared/models.js'
import { resolvePersona } from './_shared/personas.js'
import { Langfuse } from 'langfuse'
import {
  searchPortfolio, formatChunksForContext, calcCost,
  filterSourcesByResponse, filterSiteSources, detectMentionedArticles, HOME_SOURCE,
} from './_shared/rag.js'
import { getSystemPrompt } from './_shared/prompt.js'

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
const voiceOverride = (persona) => `Response for spoken conversation. Max 2-3 sentences. No markdown or links. Natural spoken language. Be precise with context data — never make things up. ${persona.spokenIdentity ?? "You are Joe's AI agent"}: speak about Joe in the THIRD PERSON ("Joe built...", "his project...") — never "I built..." or "my project...".`

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

// Tier-1 reasoning budget. Thinking models need more than the original 3 s;
// past it the raw chunks are returned instead (sanitised below).
const parsedReasonTimeout = parseInt(process.env.VOICE_REASON_TIMEOUT_MS || '', 10)
const REASON_TIMEOUT_MS = Number.isInteger(parsedReasonTimeout) && parsedReasonTimeout > 0 ? parsedReasonTimeout : 3000

async function reasonWithClaude(query, formattedChunks, span, langfuse, persona) {
  const t0 = Date.now()
  const reasoningSpan = span?.span({ name: 'claude-reasoning', metadata: { query } })

  try {
    const { text: systemPromptText } = await getSystemPrompt(langfuse, persona)

    const response = await Promise.race([
      client.messages.create({
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
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Claude reasoning timeout (>${REASON_TIMEOUT_MS}ms)`)), REASON_TIMEOUT_MS)),
    ])

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
    // A real control here would be a per-IP rate limit, not a presence check.
    if (!query) {
      return new Response(JSON.stringify({ error: 'Missing query' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create span under existing voice trace if provided
    const langfuse = getLangfuse()
    let trace = null
    if (langfuse && traceId) {
      trace = langfuse.trace({ id: traceId })
    }
    const ragSpan = trace?.span({ name: 'voice-rag', metadata: { query } })

    const t0 = Date.now()

    try {
      const ragResult = await searchPortfolio(query, ragSpan, client, persona)

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

      // Latency budget: skip Claude reasoning if RAG already took >1.5s
      const ragElapsedMs = Date.now() - t0
      const reasonedAnswer = (ragResult.chunks && ragElapsedMs <= 1500)
        ? await reasonWithClaude(query, formattedChunks, trace, langfuse, persona)
        : null

      // Tier 1: Claude + RAG → reasoned answer
      // Tier 2: RAG only (Claude failed) → raw chunks
      // Tier 3: both failed → handled by catch below
      // Both tiers are spoken verbatim by the voice model, so the raw-chunk
      // fallback must honour the no-markdown contract too.
      const context = toSpokenText(reasonedAnswer || formattedChunks)

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
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (err) {
      ragSpan?.end({ metadata: { error: err.message } })
      if (langfuse) await langfuse.flushAsync()

      // Return empty context on timeout/error rather than failing
      return new Response(JSON.stringify({
        context: 'Search unavailable — answer from your general knowledge.',
        sources: [],
      }), {
        headers: { 'Content-Type': 'application/json' },
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
