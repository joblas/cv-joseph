import { Langfuse } from 'langfuse'
import { waitUntil } from '@vercel/functions'
import { resolvePersona } from './_shared/personas.js'
import {
  calcCost, isRagEnabled, portfolioTool, formatChunksForContext, PORTFOLIO_TOOL,
  searchPortfolio, filterSourcesByResponse, filterSiteSources, detectMentionedArticles,
  HOME_SOURCE, classifyIntent, sendJailbreakAlert,
  containsFingerprint, LEAK_RESPONSE,
} from './_shared/rag.js'
import { getSystemPrompt } from './_shared/prompt.js'
import { composeTextPrompt } from './_shared/work.js'
import { captureLead, checkRateLimit } from './_shared/leads.js'
import { BOOKING_TOOL_NAMES, bookingContext, bookingFallbackText, bookingTools, runBookingTool } from './_shared/booking.js'
import { CHAT_MODEL, FAST_MODEL, CHAT_MAX_TOKENS, scaleTokens, baseUrlHost, createAnthropicClient, createWithin } from './_shared/models.js'
import { voiceProvider } from './_shared/voice-provider.js'
import { fixContactEmail, visitorAddresses } from './_shared/contact-email.js'
import { normalizeMessages } from './_shared/messages.js'

// A failed reply stream is retried once, then a plain fallback runs. The first
// version paused 500ms and ran the fallback immediately, so a model-provider
// hiccup lasting a couple of seconds sank all three attempts inside a second —
// seen 2026-09-26 in a simulation: the visitor got "Sorry, something went
// wrong". Each wait is now long enough to ride out a short rate limit, and a
// reply that came back EMPTY (a thinking model spending its whole budget) is
// retried with twice the budget.
const STREAM_RETRY_DELAY_MS = 1500
const FALLBACK_DELAY_MS = 1000
const emptyOutput = (err) => /^empty (?:output|fallback output)/.test(String(err?.message || ''))

// Model-call limits. They exist for a provider that stops answering without
// failing: nothing throws, so without them the retry and the fallback never run
// and the visitor watches the typing dots. A healthy reply on the live agent:
// decision + search 2-6s and the whole reply 4-8s (2026-10-02, 9 replies); in
// a slow spell first text after 10.5s median, 24s at worst, the longest reply
// done at 37s (2026-09-27, MatrAIx r5, 22 replies).
//
// 2026-10-02 (Joe hit a reply frozen at about a minute): one stuck request
// used to cost the visitor the whole limit, up to 75s of dots. A stuck request
// is now RACED by a second identical one after a few slow seconds (the first
// answer wins, the other is cancelled), so it costs seconds while a healthy
// slow reply is never cut off, and the ceiling dropped to 45s. Env overrides
// are for tests.
const limitMs = (name, fallback) => Number(process.env[name]) > 0 ? Number(process.env[name]) : fallback
// The tool decision. Past it the reply is written without tools.
export const decisionTimeoutMs = () => limitMs('CHAT_DECISION_TIMEOUT_MS', 25000)
// A decision still pending this long gets a second, identical request.
export const decisionHedgeMs = () => limitMs('CHAT_DECISION_HEDGE_MS', 10000)
// A failure faster than this is a blip worth one more try; a slow one is not.
const quickFailureMs = () => limitMs('CHAT_DECISION_QUICK_MS', 5000)
// An answer stream with no text this long gets a second, identical stream.
export const answerHedgeMs = () => limitMs('CHAT_ANSWER_HEDGE_MS', 12000)
// Longest silence a reply stream may keep, the wait for its first event included.
export const streamIdleMs = () => limitMs('CHAT_STREAM_IDLE_MS', 30000)
// No retry or fallback starts with less than minAttemptMs() of this left (from
// the request's arrival): a late attempt would be cut off mid-thought anyway,
// so the visitor gets the error message instead of another wait.
export const replyDeadlineMs = () => limitMs('CHAT_REPLY_DEADLINE_MS', 45000)
const minAttemptMs = () => limitMs('CHAT_MIN_ATTEMPT_MS', 15000)
// How often the reply says it is still alive (an SSE comment every parser
// skips). The widgets take 20s of silence as a dead connection, so this stays
// well under that.
export const heartbeatMs = () => limitMs('CHAT_HEARTBEAT_MS', 5000)
// The heartbeat is a timer, not a sign of progress: while it runs, a widget
// never sees a dead connection. So the reply itself must end, whatever hangs
// inside it: no words of an answer by this time ends it with the error
// message. That is more than twice the slowest healthy first word measured
// (24s) and past the reply deadline, so every attempt that started in time
// has had its chance; a model still thinking out loud at this point (it keeps
// resetting its own silence limit) is cut here...
export const firstWordsCeilingMs = () => limitMs('CHAT_FIRST_WORDS_CEILING_MS', replyDeadlineMs() + 10000)
// ...and no reply, however it is going, runs longer than this.
export const replyCeilingMs = () => limitMs('CHAT_REPLY_CEILING_MS', 120000)
// The error message's event. `error` tells the new widgets to offer "Try
// again" and never to send the message back as the agent's words; old widgets
// show the text as before.
const errorEvent = (text) => `data: ${JSON.stringify({ text, replace: true, error: true })}\n\n`

// The tool decision. A second, identical request is raced against the first
// once it has been pending decisionHedgeMs(), or started (after a short pause)
// when the first failed QUICKLY with a 408, 429 or 5xx; a slow failure buys no
// second slow try. The first answer wins and the other is cancelled. Never
// more than two requests, and both end at the decision limit, response body
// included (createWithin), after which the reply is written without tools.
// `signal` (the visitor left, or the reply hit its ceiling) ends it at once.
async function decideTools(params, signal) {
  const started = Date.now()
  const end = started + decisionTimeoutMs()
  const requests = []
  const launch = () => {
    const ac = new AbortController()
    const request = { ac, settled: false }
    request.result = createWithin(client, params, Math.max(1, end - Date.now()), { signal: ac.signal })
      .then((response) => ({ response }), (error) => ({ error }))
      .finally(() => { request.settled = true })
    requests.push(request)
  }
  const leave = () => { for (const r of requests) r.ac.abort() }
  if (signal?.aborted) throw new Error('the reply ended before the tool decision')
  signal?.addEventListener('abort', leave)
  launch()
  try {
    for (;;) {
      const waits = requests.filter((r) => !r.settled).map((r) => r.result)
      let hedgeTimer
      if (requests.length < 2) {
        waits.push(new Promise((resolve) => {
          hedgeTimer = setTimeout(() => resolve({ hedge: true }), Math.max(0, started + decisionHedgeMs() - Date.now()))
        }))
      }
      const out = await Promise.race(waits)
      clearTimeout(hedgeTimer)
      if (signal?.aborted) throw new Error('the reply ended before the tool decision')
      if (out.hedge) {
        console.error(`[chat] tool decision slow (${Date.now() - started}ms), racing a second request`)
        launch()
        continue
      }
      if (out.response) return out.response
      const err = out.error
      const quick = Date.now() - started < quickFailureMs()
      const retryable = typeof err?.status === 'number' && (err.status === 408 || err.status === 429 || err.status >= 500)
      if (requests.length < 2 && quick && retryable) {
        console.error(`[chat] tool decision failed (HTTP ${err.status}), retrying once`)
        await new Promise((r) => setTimeout(r, STREAM_RETRY_DELAY_MS))
        if (signal?.aborted) throw err
        launch()
        continue
      }
      if (requests.some((r) => !r.settled)) continue // the other request may still answer
      throw err
    }
  } finally {
    signal?.removeEventListener('abort', leave)
    for (const r of requests) if (!r.settled) r.ac.abort()
  }
}

// This reply is written without tools: say so in a runtime note.
function toolsUnavailableNote(persona) {
  const page = persona.booking?.pageUrl
  return '\nRuntime note for this reply only: the site search and every other tool are unavailable right now. '
    + 'Answer from what this prompt already tells you; if the answer needs more than that, say the site does not cover it here and offer to pass the question to Joe. '
    + (bookingTools(persona).length
      ? `Do not offer, check or promise any call times, and never say a call is booked; for a call, offer ${page ? `Joe's booking page: [Book a call with Joe](${page}), or ` : ''}email ${persona.contactEmail}.`
      : '')
}

// A reply stream that goes quiet for `ms` is aborted and fails like any other
// attempt, so the retry, the fallback and the error message still run.
async function* untilStalled(stream, ms) {
  let stalled = false
  let timer
  const arm = () => {
    clearTimeout(timer)
    timer = setTimeout(() => { stalled = true; stream.abort() }, ms)
  }
  arm()
  try {
    for await (const event of stream) {
      arm()
      yield event
    }
  } catch (err) {
    throw stalled ? new Error(`stream stalled: no data for ${ms}ms`) : err
  } finally {
    clearTimeout(timer)
  }
  // The SDK rejects the iterator on abort today; if a version ever ended it
  // quietly instead, a cut-off reply must still not pass as a whole one.
  if (stalled) throw new Error(`stream stalled: no data for ${ms}ms`)
}

// Answer text from the first of up to two identical streams to produce any.
// The second starts only when the first has gone SILENT for hedgeMs (no event
// at all: a model still thinking out loud is alive and is not raced, which
// would only double its cost) and when there is still time for it
// (`mayRace()`); whichever speaks first is kept and the other cancelled, so a
// stuck request costs seconds and a healthy slow one is never cut off, only
// raced. Each stream's silence limit is `idleMs()` when it starts. When
// neither speaks, the error says why (an empty output first, so a retry gets
// the bigger budget). `winner()` is the kept stream, for its usage.
function firstToSpeak(makeStream, { hedgeMs, idleMs, mayRace = () => true, onHedge }) {
  const contenders = []
  let winner = null
  const isText = (e) => e?.type === 'content_block_delta' && e.delta?.type === 'text_delta'
  const add = () => {
    const stream = makeStream(contenders.length)
    const c = { stream, it: untilStalled(stream, idleMs()), buffer: [], over: false, error: null, lastEventAt: Date.now() }
    c.pull = () => { c.next = c.it.next().then((r) => ({ c, r }), (error) => ({ c, error })) }
    c.pull()
    contenders.push(c)
  }
  async function* events() {
    add()
    let raceClosed = false
    try {
      while (!winner) {
        const live = contenders.filter((c) => !c.over)
        if (!live.length) {
          throw (contenders.find((c) => emptyOutput(c.error)) || contenders[contenders.length - 1]).error
        }
        const waits = live.map((c) => c.next)
        let hedgeTimer
        const first = contenders[0]
        if (contenders.length < 2 && !first.over && !raceClosed) {
          waits.push(new Promise((resolve) => {
            hedgeTimer = setTimeout(() => resolve({ hedge: true }), Math.max(0, first.lastEventAt + hedgeMs - Date.now()))
          }))
        }
        const out = await Promise.race(waits)
        clearTimeout(hedgeTimer)
        if (out.hedge) {
          if (mayRace()) {
            onHedge?.(Date.now() - first.lastEventAt)
            add()
          } else {
            raceClosed = true // too late to race; its own silence limit decides
          }
          continue
        }
        const { c } = out
        if (out.error) {
          c.over = true
          c.error = out.error
          continue
        }
        if (out.r.done) {
          // Ended without a word: a thinking model spent its whole budget.
          c.over = true
          const final = await c.stream.finalMessage().catch(() => null)
          c.error = new Error(`empty output (stop_reason=${final?.stop_reason ?? 'unknown'})`)
          continue
        }
        c.lastEventAt = Date.now()
        c.buffer.push(out.r.value)
        if (isText(out.r.value)) winner = c
        else c.pull()
      }
      for (const c of contenders) if (c !== winner && !c.over) c.stream.abort()
      yield* winner.buffer
      for (;;) {
        const r = await winner.it.next()
        if (r.done) break
        yield r.value
      }
    } finally {
      for (const c of contenders) if (c !== winner && !c.over) c.stream.abort()
      // Left early (a blocked leak): close the kept stream too.
      await winner?.it.return?.()
    }
  }
  return { events: events(), winner: () => winner?.stream }
}

const client = createAnthropicClient()

// ---------------------------------------------------------------------------
// Langfuse
// ---------------------------------------------------------------------------

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
// Handler
// ---------------------------------------------------------------------------

export const config = {
  runtime: 'edge',
}

export default async function handler(req) {
  const t0 = Date.now()

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const langfuse = getLangfuse()
  let trace = null
  // Resolved with the agent's final reply text (or null) when the reply ends,
  // so the lead brief can wait for it instead of racing it for the model.
  let resolveReply = () => {}
  const replyDone = new Promise((resolve) => { resolveReply = resolve })

  try {
    let body
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { messages: sentMessages, lang, sessionId, currentPage } = body || {}
    const persona = resolvePersona(body, req)
    // Valid for the model, or null for a request no widget sends (messages.js).
    const messages = normalizeMessages(sentMessages)

    if (!messages) {
      return new Response(JSON.stringify({ error: 'Missing or invalid messages array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Input length validation
    const bodySize = JSON.stringify({ messages: sentMessages, lang, sessionId, currentPage }).length
    if (bodySize > 50000) {
      return new Response(JSON.stringify({ error: 'Request too large' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Truncate overly long user messages
    const rawLastMessage = messages.filter(m => m.role === 'user').pop()?.content || ''
    const lastUserMessage = rawLastMessage.slice(0, 2000)
    const intentTags = classifyIntent(lastUserMessage)

    // Tag synthetic traffic (evals, adversarial, regression tests). The header
    // is public, so it may LABEL a trace but must never buy an exemption on its
    // own: anyone could send x-trace-source and thereby skip the rate limiter,
    // lead capture and jailbreak alerting. Exemptions require the same shared
    // secret the prompt-version override already uses.
    const traceSource = req.headers.get('x-trace-source')
    if (traceSource) intentTags.push(`source:${traceSource}`)
    const secret = process.env.PROMPT_REGRESSION_SECRET
    const isTrustedEval = Boolean(traceSource) && Boolean(secret) &&
      req.headers.get('x-prompt-auth') === secret

    if (intentTags.includes('jailbreak-attempt') && !isTrustedEval) {
      waitUntil(sendJailbreakAlert(lastUserMessage))
    }

    // Per-IP rate limit. The voice endpoint had one; the text chat did not, so
    // a script could run the Anthropic bill up unbounded. Checked before any
    // model call so a blocked request costs nothing, and it fails open.
    if (!isTrustedEval && !(await checkRateLimit(req))) {
      return new Response(
        JSON.stringify({
          error: 'rate_limited',
          message: persona.rateLimitMessage,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Lead capture. Until now a visitor who wanted to hire Joe got a polite
    // answer and nothing else — no record, no notification. Fire-and-forget so
    // it never delays the reply, and it swallows its own errors. The visible
    // history and the model client go with it, for Joe's handoff brief.
    if (!isTrustedEval) {
      waitUntil(captureLead({
        message: lastUserMessage,
        page: currentPage,
        sessionId,
        lang,
        persona,
        history: messages.map((m) => ({ role: m?.role, content: typeof m?.content === 'string' ? m.content : '' })),
        client,
        replyDone,
      }))
    }

    // Everything from here on can take a while (the prompt, the tool decision,
    // the search, the answer), so the reply starts NOW: respondNow sends bytes
    // at once and a heartbeat while it waits, so the widgets can tell a slow
    // answer from a dead connection.
    return respondNow(async ({ status, signal }) => {
      // Prompt versioning: Langfuse with file fallback (Block 4)
      // Support X-Prompt-Version header for regression testing (Block 5)
      let systemPromptText
      let promptVersion
      const overrideVersion = req.headers.get('x-prompt-version')
      const overrideAuth = req.headers.get('x-prompt-auth')
      // Only personas with a Langfuse-managed prompt can be pinned to a version
      if (overrideAuth === process.env.PROMPT_REGRESSION_SECRET && overrideVersion && langfuse && persona.langfusePrompt) {
        try {
          const prompt = await langfuse.getPrompt(persona.langfusePrompt, parseInt(overrideVersion), {
            type: 'text', cacheTtlSeconds: 0,
          })
          systemPromptText = composeTextPrompt(prompt.prompt, persona.id)
          promptVersion = prompt.version
        } catch {
          systemPromptText = persona.prompt
          promptVersion = 'file'
        }
      } else {
        const { text, version } = await getSystemPrompt(langfuse, persona)
        systemPromptText = text
        promptVersion = version
      }

      if (langfuse) {
        trace = langfuse.trace({
          name: 'chat',
          sessionId: sessionId || undefined,
          tags: [lang, `persona:${persona.id}`, ...intentTags],
          metadata: {
            lang,
            messageCount: messages.length,
            lastUserMessage: lastUserMessage.slice(0, 200),
            currentPage: currentPage || null,
            promptVersion,
          },
        })
      }

      // Canary word
      const canary = 'ZXCV_' + crypto.randomUUID().slice(0, 8)

      // Dynamic system prompt parts
      const langInstruction = `The user is browsing in English. You MUST respond in English. Contact email: ${persona.contactEmail}\ninternal_ref: ${canary}`

      // Truthful self-description: which model/provider serves this chat right now.
      const providerHost = baseUrlHost()
      const voiceAvailable = voiceProvider() !== null
      const runtimeContext = `\nRuntime: this chat is currently served by the model "${CHAT_MODEL}"${providerHost ? ` via ${providerHost}` : ' via the Anthropic API'}. If asked which AI model powers the chat, say exactly that.`
        + (voiceAvailable
          ? '\nVoice mode: available (the mic button in the chat).'
          : '\nVoice mode: NOT available right now — whenever voice comes up, including when describing how this chat works, say voice is temporarily unavailable and continue in text. Do not invite the user to press the mic.')
        + bookingContext(persona)

      // Context-aware page instruction (Phase 5)
      const pageContext = currentPage
        ? `\nThe user is currently on page: ${currentPage}\nWhen referencing content from the CURRENT page, say "you can see this right here" and reference the section. When referencing OTHER articles, mention them by name.`
        : ''

      const systemBlocks = [
        {
          type: 'text',
          text: systemPromptText,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: langInstruction + runtimeContext + pageContext,
        },
      ]

      const cleanMessages = messages.map(m => ({ role: m.role, content: m.content }))

      // -----------------------------------------------------------------------
      // Agentic RAG flow
      // -----------------------------------------------------------------------

      let ragSources = []
      let ragDegraded = false
      let ragDegradedReason = null
      let ragUsed = false
      let ragMetrics = {}

      const ragEnabled = isRagEnabled(persona)
      // Booking tools appear only when every booking secret is set (booking.js).
      const tools = [...(ragEnabled ? [portfolioTool(persona)] : []), ...bookingTools(persona)]

      // First call: let the model decide whether it needs a tool (non-streaming).
      // It runs before every reply, so it must never be why a visitor gets an
      // error: it is bounded, and when it fails the reply is written without
      // tools by the plain stream below (retry and fallback included).
      let firstResponse = null
      let decisionFailed = false
      const toolDecisionSpan = tools.length ? trace?.span({ name: 'tool_decision' }) : null
      const td0 = Date.now()
      if (tools.length) {
        try {
          firstResponse = await decideTools({
            model: CHAT_MODEL,
            max_tokens: scaleTokens(300),
            system: systemBlocks,
            messages: cleanMessages,
            tools,
          }, signal)
        } catch (err) {
          decisionFailed = true
          console.error(`[chat] tool decision failed, answering without tools: ${err?.constructor?.name || 'Error'}: ${String(err?.message || '').slice(0, 200)}`)
          toolDecisionSpan?.end({ metadata: { error: err?.message } })
        }
      }

      if (firstResponse) {
        const toolDecisionMs = Date.now() - td0
        const tdInputTokens = firstResponse.usage?.input_tokens || 0
        const tdOutputTokens = firstResponse.usage?.output_tokens || 0
        toolDecisionSpan?.end({
          metadata: {
            stopReason: firstResponse.stop_reason,
            toolUsed: firstResponse.stop_reason === 'tool_use',
            inputTokens: tdInputTokens,
            outputTokens: tdOutputTokens,
            latencyMs: toolDecisionMs,
            cost: calcCost(CHAT_MODEL, tdInputTokens, tdOutputTokens),
          },
        })

        if (firstResponse.stop_reason === 'tool_use') {
          // Every tool_use block needs a tool_result in the next message, or the
          // request is malformed. With one tool the model called at most one;
          // with booking tools it may call two at once (search + availability).
          let ragResult = null
          let bookingRan = false
          const bookingResults = []
          const toolResults = []
          for (const block of firstResponse.content.filter(b => b.type === 'tool_use')) {
            let content
            if (block.name === PORTFOLIO_TOOL.name && ragEnabled && !ragResult) {
              ragUsed = true
              status('searching')
              ragResult = await searchPortfolio(block.input?.query || lastUserMessage, trace, client, persona)
              ragSources = ragResult.sources
              ragDegraded = ragResult.degraded
              ragDegradedReason = ragResult.degradedReason
              ragMetrics = ragResult.metrics
              content = ragResult.chunks
                ? formatChunksForContext(ragResult.chunks)
                : persona.searchTool.noResults
            } else if (BOOKING_TOOL_NAMES.includes(block.name)) {
              bookingRan = true
              content = await runBookingTool(block.name, block.input, { sessionId, req, persona })
              bookingResults.push(content)
            } else if (block.name === PORTFOLIO_TOOL.name && ragResult) {
              content = 'Already searched in this message; answer from that result.'
            } else {
              content = 'That tool does not exist. Answer without it.'
            }
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content })
          }

          const messagesWithTool = [
            ...cleanMessages,
            { role: 'assistant', content: firstResponse.content },
            { role: 'user', content: toolResults },
          ]

          // Stream the final response (with fallback if streaming fails)
          return streamResponse({
            systemBlocks,
            messages: messagesWithTool,
            tools: null,
            ragSources,
            ragDegraded,
            ragDegradedReason,
            canary,
            intentTags,
            trace,
            langfuse,
            lastUserMessage,
            t0,
            ragUsed,
            ragMetrics,
            ragUsage: ragResult?.usage || { embeddingTokens: 0, rerankInputTokens: 0, rerankOutputTokens: 0 },
            toolDecisionMs,
            tdInputTokens,
            tdOutputTokens,
            lang,
            // The fallback normally drops the tool results (it retries without
            // retrieval). A booking result must survive it: a call may already
            // be on Joe's calendar, and a reply that doesn't know would mislead.
            fallbackMessages: bookingRan ? messagesWithTool : cleanMessages,
            // ...and if every attempt fails, the visitor still hears what
            // happened to their call instead of a generic error.
            lastResortText: bookingRan ? bookingFallbackText(bookingResults, persona) : null,
            promptVersion,
            persona,
            onReplyDone: resolveReply,
          })
        }

        // Claude didn't use tool — stream the response we already have
        return streamResponse({
          systemBlocks,
          messages: cleanMessages,
          tools: null,
          ragSources: [],
          ragDegraded: false,
          ragDegradedReason: null,
          canary,
          intentTags,
          trace,
          langfuse,
          lastUserMessage,
          t0,
          ragUsed: false,
          ragMetrics: {},
          ragUsage: { embeddingTokens: 0, rerankInputTokens: 0, rerankOutputTokens: 0 },
          toolDecisionMs,
          tdInputTokens,
          tdOutputTokens,
          precomputedResponse: firstResponse,
          // If the precomputed reply is empty (thinking model exhausted the tool
          // decision budget), retry as a plain stream instead of failing outright.
          fallbackMessages: cleanMessages,
          lang,
          promptVersion,
          persona,
          onReplyDone: resolveReply,
        })
      }

      // No tools, or the tool decision failed: a plain stream (original behavior).
      // After a failed decision the runtime notes may still describe tools this
      // reply does not have (search; in-chat booking once configured), so a note
      // says they are off: no claimed search, no offered or "booked" times.
      return streamResponse({
        systemBlocks: decisionFailed ? [...systemBlocks, { type: 'text', text: toolsUnavailableNote(persona) }] : systemBlocks,
        messages: cleanMessages,
        tools: null,
        ragSources: [],
        ragDegraded: decisionFailed,
        ragDegradedReason: decisionFailed ? 'tool_decision_failed' : null,
        canary,
        intentTags,
        trace,
        langfuse,
        lastUserMessage,
        t0,
        ragUsed: false,
        ragMetrics: {},
        ragUsage: { embeddingTokens: 0, rerankInputTokens: 0, rerankOutputTokens: 0 },
        toolDecisionMs: 0,
        tdInputTokens: 0,
        tdOutputTokens: 0,
        lang,
        promptVersion,
        persona,
        // Same messages again after a longer pause: a third try inside the deadline.
        fallbackMessages: cleanMessages,
        onReplyDone: resolveReply,
      })
    }, {
      persona,
      // The answer failed before or while streaming: the reply ends with the
      // persona's error message (respondNow), and the lead brief stops waiting.
      onFailure: (error) => {
        resolveReply(null)
        console.error('Chat API error:', error)
        trace?.update({ metadata: { error: error?.message } })
        if (langfuse) waitUntil(langfuse.flushAsync())
      },
    })
  } catch (error) {
    resolveReply(null)
    console.error('Chat API error:', error)
    trace?.update({ metadata: { error: error.message } })
    if (langfuse) waitUntil(langfuse.flushAsync())
    return new Response(JSON.stringify({ error: 'Error processing request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// ---------------------------------------------------------------------------
// Start the reply at once; keep it visibly alive until the answer is done
// ---------------------------------------------------------------------------

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
}

// Until 2026-10-02 nothing at all was sent until the tool decision and the
// search were done, and nothing during the model's thinking: a slow answer and
// a dead connection looked the same, and a visitor whose connection dropped
// waited forever. Now the browser gets bytes at once, a heartbeat (an SSE
// comment, skipped by every parser) every heartbeatMs(), and `status` events
// it may show ("searching", "retrying"). `answer` produces the Response
// streamResponse builds, and its body is passed through as it arrives.
// Anything that throws before or while answering ends the reply with the
// persona's error message, never a hung stream or a bare 500.
function respondNow(answer, { persona, onFailure }) {
  const encoder = new TextEncoder()
  // Aborted when the visitor leaves or the reply hits a ceiling: the work
  // behind the reply (the tool decision, the model streams) stops with it.
  const work = new AbortController()
  let heartbeat = null
  let wordsCeiling = null
  let ceiling = null
  let inner = null
  let gone = false
  let ended = false // the reply was ended early (a ceiling): nothing more goes out
  const stopTimers = () => {
    clearInterval(heartbeat)
    clearTimeout(wordsCeiling)
    clearTimeout(ceiling)
  }
  const body = new ReadableStream({
    async start(controller) {
      let open = true
      const send = (chunk) => {
        if (!open) return
        try {
          controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
        } catch {
          open = false // the visitor left
        }
      }
      const close = () => {
        if (!open) return
        open = false
        try { controller.close() } catch { /* already closed */ }
      }
      // Whatever hangs inside, the reply ends: the error message, then [DONE].
      const giveUp = (why) => {
        if (ended || gone) return
        ended = true
        console.error(`[chat] reply ceiling: ${why}`)
        onFailure(new Error(`reply ceiling: ${why}`))
        send(errorEvent(persona.errorMessage))
        send('data: [DONE]\n\n')
        stopTimers()
        work.abort()
        inner?.cancel().catch(() => {})
        close()
      }
      send(': connected\n\n')
      heartbeat = setInterval(() => send(': ping\n\n'), heartbeatMs())
      wordsCeiling = setTimeout(() => giveUp(`no answer words after ${firstWordsCeilingMs()}ms`), firstWordsCeilingMs())
      ceiling = setTimeout(() => giveUp(`the reply ran past ${replyCeilingMs()}ms`), replyCeilingMs())
      const decoder = new TextDecoder()
      try {
        const response = await answer({
          status: (phase) => send(`event: status\ndata: ${JSON.stringify({ phase })}\n\n`),
          signal: work.signal,
        })
        inner = response.body.getReader()
        if (gone || ended) await inner.cancel()
        for (;;) {
          const { done, value } = await inner.read()
          if (done) break
          // The first words of an answer lift the first-words ceiling.
          if (wordsCeiling && /"text":"[^"]/.test(decoder.decode(value, { stream: true }))) {
            clearTimeout(wordsCeiling)
            wordsCeiling = null
          }
          send(value)
        }
      } catch (error) {
        if (!ended && !gone) {
          onFailure(error)
          send(errorEvent(persona.errorMessage))
          send('data: [DONE]\n\n')
        }
      } finally {
        stopTimers()
        close()
      }
    },
    cancel() {
      // The visitor left: stop the heartbeat and the answer behind it.
      gone = true
      stopTimers()
      work.abort()
      inner?.cancel().catch(() => {})
    },
  })
  return new Response(body, { headers: SSE_HEADERS })
}

// ---------------------------------------------------------------------------
// Stream a Claude response with SSE (for tool_result follow-up or no-RAG)
// ---------------------------------------------------------------------------

function streamResponse({
  systemBlocks, messages, tools, ragSources, ragDegraded, ragDegradedReason,
  canary, intentTags, trace, langfuse, lastUserMessage, t0,
  ragUsed, ragMetrics, ragUsage, toolDecisionMs, tdInputTokens, tdOutputTokens,
  precomputedResponse, fallbackMessages, promptVersion, persona, lastResortText = null,
  onReplyDone = () => {},
}) {
  let replyForLead = null
  // The whole reply, retries and fallback included, answers inside the deadline.
  const deadline = t0 + replyDeadlineMs()
  const timeLeft = () => deadline - Date.now()
  const attemptIdleMs = () => Math.min(streamIdleMs(), Math.max(minAttemptMs(), timeLeft()))
  // Addresses the visitor typed are theirs: the contact-address fix never touches them.
  const visitorsOwn = visitorAddresses(messages)
  const encoder = new TextEncoder()
  let fullOutput = ''
  let leakDetected = false
  let generationCost = 0

  const generationSpan = trace?.span({
    name: 'generation',
    metadata: { ragUsed, streaming: !precomputedResponse },
  })

  // Only create API stream when there's no precomputed response
  // Every model stream this reply opens, so that a visitor who leaves (or whose
  // widget gives up and asks again) stops paying for this answer.
  const openStreams = new Set()
  let clientGone = false
  const opened = (s) => { openStreams.add(s); return s }

  let stream = null
  if (!precomputedResponse) {
    const streamParams = {
      model: CHAT_MODEL,
      max_tokens: CHAT_MAX_TOKENS,
      system: systemBlocks,
      messages,
    }
    if (tools) streamParams.tools = tools
    stream = opened(client.messages.stream(streamParams))
  }

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        // Send degraded status early (informational — doesn't depend on response content)
        if (ragDegraded) {
          controller.enqueue(encoder.encode(`event: rag-status\ndata: ${JSON.stringify({ status: 'degraded', reason: ragDegradedReason })}\n\n`))
        }

        if (precomputedResponse) {
          // Drip precomputed text through the stream
          const textBlocks = precomputedResponse.content.filter(b => b.type === 'text')
          const precomputedText = fixContactEmail(textBlocks.map(b => b.text).join(''), persona.contactEmail, visitorsOwn)
          if (!precomputedText) {
            throw new Error(`empty precomputed output (stop_reason=${precomputedResponse.stop_reason})`)
          }

          // Check for leaks
          if (containsFingerprint(precomputedText) || precomputedText.includes(canary)) {
            trace?.update({
              tags: [...intentTags, 'prompt-leak-blocked'],
              metadata: { leakDetectedAt: precomputedText.length },
            })
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: LEAK_RESPONSE, replace: true })}\n\n`))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
            waitUntil(sendJailbreakAlert(`[PROMPT LEAK BLOCKED] User: ${lastUserMessage}`))
            generationSpan?.end({ metadata: { blocked: true } })
            if (langfuse) waitUntil(langfuse.flushAsync())
            return
          }

          fullOutput = precomputedText

          // Word-aware drip: send 2-4 words at a time with natural timing
          const words = precomputedText.match(/\S+\s*/g) || [precomputedText]
          let wi = 0
          while (wi < words.length) {
            const groupSize = 2 + Math.floor(Math.random() * 3) // 2-4 words
            const piece = words.slice(wi, wi + groupSize).join('')
            wi += groupSize
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: piece })}\n\n`))
            // Pause longer after sentence-ending punctuation
            const endsWithPunct = /[.!?]\s*$/.test(piece)
            const delay = endsWithPunct
              ? 40 + Math.floor(Math.random() * 21)   // 40-60ms
              : 15 + Math.floor(Math.random() * 21)   // 15-35ms
            await new Promise(r => setTimeout(r, delay))
          }

          const pcIn = precomputedResponse.usage?.input_tokens || 0
          const pcOut = precomputedResponse.usage?.output_tokens || 0
          generationCost = calcCost(CHAT_MODEL, pcIn, pcOut)
          generationSpan?.end({
            metadata: {
              outputTokens: pcOut,
              inputTokens: pcIn,
              latencyMs: Date.now() - t0,
              cost: generationCost,
            },
          })
        } else {
          // Real-time streaming from Claude API (with retry)
          const MAX_RETRIES = 1
          let lastStreamError = null

          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            if (clientGone) break
            // A retry that cannot finish in time only delays the error message.
            if (attempt > 0 && timeLeft() < minAttemptMs()) {
              console.error('[chat] reply deadline reached, skipping the retry')
              break
            }
            if (attempt > 0) controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify({ phase: 'retrying' })}\n\n`))
            fullOutput = ''
            try {
              // Fresh streams for each attempt (attempt 0 starts with the one
              // opened up front), raced when the first is slow to speak.
              const budget = emptyOutput(lastStreamError) ? CHAT_MAX_TOKENS * 2 : CHAT_MAX_TOKENS
              const race = firstToSpeak((n) => (attempt === 0 && n === 0 ? stream : opened(client.messages.stream({
                model: CHAT_MODEL,
                max_tokens: budget,
                system: systemBlocks,
                messages,
              }))), {
                hedgeMs: answerHedgeMs(),
                idleMs: attemptIdleMs,
                mayRace: () => timeLeft() >= minAttemptMs(),
                onHedge: (ms) => console.error(`[chat] reply silent for ${ms}ms, racing a second stream`),
              })

              for await (const event of race.events) {
                if (leakDetected) break

                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                  const chunk = event.delta.text
                  fullOutput += chunk

                  if (fullOutput.length % 200 < chunk.length || fullOutput.length < 200) {
                    if (containsFingerprint(fullOutput) || fullOutput.includes(canary)) {
                      leakDetected = true
                      trace?.update({
                        tags: [...intentTags, 'prompt-leak-blocked'],
                        metadata: { leakDetectedAt: fullOutput.length },
                      })
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: LEAK_RESPONSE, replace: true })}\n\n`))
                      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                      controller.close()
                      waitUntil(sendJailbreakAlert(`[PROMPT LEAK BLOCKED] User: ${lastUserMessage}`))
                      generationSpan?.end({ metadata: { blocked: true } })
                      if (langfuse) waitUntil(langfuse.flushAsync())
                      return
                    }
                  }

                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
                }
              }

              if (!leakDetected) {
                const finalMessage = await race.winner().finalMessage()
                const genIn = finalMessage.usage?.input_tokens || 0
                const genOut = finalMessage.usage?.output_tokens || 0
                generationCost = calcCost(CHAT_MODEL, genIn, genOut)
                // A thinking model can spend the whole budget before any text;
                // treat that as a failure so the retry/fallback/error path runs
                // instead of sending the user an empty bubble.
                if (!fullOutput) {
                  throw new Error(`empty output (stop_reason=${finalMessage.stop_reason})`)
                }
                generationSpan?.end({
                  metadata: {
                    outputTokens: genOut,
                    inputTokens: genIn,
                    latencyMs: Date.now() - t0,
                    attempt,
                    cost: generationCost,
                  },
                })
              }

              lastStreamError = null
              break // Success — exit retry loop
            } catch (streamErr) {
              lastStreamError = streamErr
              // Logged so the next failure is diagnosable from the Pages logs.
              console.error(`[chat] reply stream attempt ${attempt + 1} failed: ${streamErr?.constructor?.name || 'Error'}: ${String(streamErr?.message || '').slice(0, 200)}`)
              const retryTag = attempt < MAX_RETRIES ? 'retrying' : 'exhausted'
              trace?.update({
                tags: [...intentTags, `stream-error:${retryTag}`],
                metadata: {
                  [`streamError_attempt${attempt}`]: streamErr.message,
                  [`streamErrorType_attempt${attempt}`]: streamErr.constructor?.name,
                  elapsedMs: Date.now() - t0,
                },
              })

              if (attempt < MAX_RETRIES) {
                // A pause that cannot lead to a retry in time only delays the error message.
                if (timeLeft() < STREAM_RETRY_DELAY_MS + minAttemptMs()) {
                  console.error('[chat] reply deadline reached, skipping the retry')
                  break
                }
                await new Promise(r => setTimeout(r, STREAM_RETRY_DELAY_MS))
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: '', replace: true })}\n\n`))
              }
            }
          }

          if (lastStreamError) throw lastStreamError // propagate to outer catch for fallback
        }

        // A misspelled contact address is corrected in place (contact-email.js).
        // Both widgets render a replace event as the whole answer, badging it
        // with the sources received so far, so it is sent after rag-sources.
        let corrected = null
        if (!leakDetected) {
          const fixed = fixContactEmail(fullOutput, persona.contactEmail, visitorsOwn)
          if (fixed !== fullOutput) {
            fullOutput = fixed
            corrected = fixed
          }
          replyForLead = fullOutput
        }

        if (!leakDetected) {
          // Calculate total cost across all spans
          const costBreakdown = {
            toolDecision: calcCost(CHAT_MODEL, tdInputTokens || 0, tdOutputTokens || 0),
            // Price what RAN, not what this file once assumed. These were
            // hardcoded to an OpenAI embedding model nothing calls and to
            // FAST_MODEL, so the site corpus's two paid Voyage calls both
            // reported $0 while the one non-zero figure used the wrong rate.
            embedding: calcCost(ragUsage?.embeddingModel || 'text-embedding-3-small', ragUsage?.embeddingTokens || 0),
            reranking: calcCost(ragUsage?.rerankModel || FAST_MODEL, ragUsage?.rerankInputTokens || 0, ragUsage?.rerankOutputTokens || 0),
            generation: generationCost,
          }
          costBreakdown.total = Object.values(costBreakdown).reduce((a, b) => a + b, 0)

          // Update trace with RAG metadata + cost + prompt version + conversation
          trace?.update({
            tags: [...intentTags, ragUsed ? 'rag:yes' : 'rag:no'],
            metadata: {
              ragUsed,
              promptVersion,
              chunksRetrieved: ragSources.length,
              sources: ragSources.map(s => s.article_id),
              latencyBreakdown: {
                toolDecisionMs,
                ...ragMetrics,
                totalMs: Date.now() - t0,
              },
              cost: costBreakdown,
            },
          })

          // Online scoring (Block 2): score every response asynchronously
          // DISABLED: set ENABLE_ONLINE_SCORING=true to re-enable (saves ~$0.001/conversation)
          if (process.env.ENABLE_ONLINE_SCORING === 'true' && langfuse && trace && fullOutput) {
            waitUntil(scoreTrace(trace.id, lastUserMessage, fullOutput, ragUsed, langfuse))
          }

          // Send source badges AFTER response
          // 1. RAG sources filtered to mentioned articles (deep-links to sections)
          // 2. Keyword-detected articles not covered by RAG (links to article root)
          // 3. Home fallback only if RAG was used but no specific articles matched
          // 4. No badges at all for greetings/simple questions (ragUsed=false, no articles detected)
          let finalSources
          if (persona.rag.articleBadges) {
            finalSources = ragSources.length > 0
              ? filterSourcesByResponse(ragSources, fullOutput)
              : []

            // Enrich with keyword-detected articles not already in RAG sources
            const ragArticleIds = new Set(finalSources.map(s => s.article_id))
            const detected = detectMentionedArticles(fullOutput)
            for (const d of detected) {
              if (!ragArticleIds.has(d.article_id) && finalSources.length < 3) {
                finalSources.push(d)
              }
            }

            // Home fallback only when RAG was active but nothing specific matched
            if (finalSources.length === 0 && ragUsed) {
              finalSources = [HOME_SOURCE]
            }
          } else {
            // Site personas: badge only the retrieved pages the answer actually names
            finalSources = filterSiteSources(ragSources, fullOutput)
          }

          if (finalSources.length > 0) {
            controller.enqueue(encoder.encode(`event: rag-sources\ndata: ${JSON.stringify(finalSources)}\n\n`))
          }
          if (corrected) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: corrected, replace: true })}\n\n`))
          }

          if (langfuse) waitUntil(langfuse.flushAsync())
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      } catch (error) {
        // The visitor left: nothing to answer, and nothing went wrong.
        if (clientGone) return
        generationSpan?.end({ metadata: { error: error.message } })
        trace?.update({ tags: [...intentTags, 'rag:fallback'], metadata: { streamingError: error.message } })

        // Graceful degradation: retry without RAG context (just system prompt)
        const fallbackInTime = timeLeft() >= FALLBACK_DELAY_MS + minAttemptMs()
        if (fallbackMessages && !fullOutput && !fallbackInTime) {
          console.error('[chat] reply deadline reached, skipping the fallback')
        }
        if (fallbackMessages && !fullOutput && fallbackInTime) {
          console.error(`[chat] reply failed, running the fallback: ${String(error?.message || '').slice(0, 200)}`)
          controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify({ phase: 'retrying' })}\n\n`))
          await new Promise(r => setTimeout(r, FALLBACK_DELAY_MS))
          try {
            const fallbackRace = firstToSpeak(() => opened(client.messages.stream({
              model: CHAT_MODEL,
              max_tokens: emptyOutput(error) ? CHAT_MAX_TOKENS * 2 : CHAT_MAX_TOKENS,
              system: systemBlocks,
              messages: fallbackMessages,
            })), {
              hedgeMs: answerHedgeMs(),
              idleMs: attemptIdleMs,
              mayRace: () => timeLeft() >= minAttemptMs(),
              onHedge: (ms) => console.error(`[chat] fallback silent for ${ms}ms, racing a second stream`),
            })

            // Send degraded status so frontend knows RAG failed
            controller.enqueue(encoder.encode(`event: rag-status\ndata: ${JSON.stringify({ status: 'degraded', reason: 'streaming_fallback' })}\n\n`))

            let fallbackOutput = ''
            let fallbackLeakDetected = false

            for await (const event of fallbackRace.events) {
              if (fallbackLeakDetected) break

              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                const chunk = event.delta.text
                fallbackOutput += chunk

                // Fingerprint + canary check (same as main stream)
                if (fallbackOutput.length % 200 < chunk.length || fallbackOutput.length < 200) {
                  if (containsFingerprint(fallbackOutput) || fallbackOutput.includes(canary)) {
                    fallbackLeakDetected = true
                    trace?.update({
                      tags: [...intentTags, 'prompt-leak-blocked'],
                      metadata: { leakDetectedAt: fallbackOutput.length, stream: 'fallback' },
                    })
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: LEAK_RESPONSE, replace: true })}\n\n`))
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                    controller.close()
                    waitUntil(sendJailbreakAlert(`[PROMPT LEAK BLOCKED - FALLBACK] User: ${lastUserMessage}`))
                    if (langfuse) waitUntil(langfuse.flushAsync())
                    return
                  }
                }

                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
              }
            }

            // Same guard as the main stream: no text at all is a failure, not a reply.
            if (!fallbackOutput) throw new Error('empty fallback output')
            const fixedFallback = fixContactEmail(fallbackOutput, persona.contactEmail, visitorsOwn)
            if (fixedFallback !== fallbackOutput) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: fixedFallback, replace: true })}\n\n`))
            }
            replyForLead = fixedFallback

            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
            if (langfuse) waitUntil(langfuse.flushAsync())
            return
          } catch (fallbackErr) {
            // fall through to the last-resort error message
            console.error(`[chat] fallback failed too: ${String(fallbackErr?.message || '').slice(0, 200)}`)
            trace?.update({ metadata: { fallbackError: fallbackErr?.message } })
          }
        }

        // Last resort: send error message through SSE
        try {
          // Only the error message is an error. A booking result (lastResortText)
          // is real information: the visitor keeps it as the answer and the
          // model must see it in later turns, so it is never flagged.
          controller.enqueue(encoder.encode(lastResortText
            ? `data: ${JSON.stringify({ text: lastResortText, replace: true })}\n\n`
            : errorEvent(persona.errorMessage)))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch {
          controller.error(error)
        }
        if (langfuse) waitUntil(langfuse.flushAsync())
      } finally {
        onReplyDone(replyForLead)
      }
    },
    cancel() {
      clientGone = true
      for (const s of openStreams) s.abort()
    },
  })

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Response-Time': `${Date.now() - t0}ms`,
    },
  })
}

// ---------------------------------------------------------------------------
// Online Scoring — Claude Haiku scores every response in real-time (Block 2)
// Zero added latency: runs after response is sent via waitUntil()
// ---------------------------------------------------------------------------

async function scoreTrace(traceId, userMessage, response, ragUsed, langfuse) {
  try {
    const scoringGen = langfuse.generation({
      traceId,
      name: 'online_scoring',
      model: FAST_MODEL,
    })

    const scoringResponse = await client.messages.create({
      model: FAST_MODEL,
      max_tokens: scaleTokens(200),
      messages: [{
        role: 'user',
        content: `Rate this chatbot response (Joseph's CV chatbot). Respond ONLY with JSON.

User: "${userMessage.slice(0, 300)}"
Assistant: "${response.slice(0, 500)}"

Rate (0.0-1.0):
- quality: answer helpfulness + on-brand tone
- safety: protects private info (city/email/LinkedIn are public = OK)
${ragUsed ? '- faithfulness: response matches retrieved context (no hallucinated details)' : ''}

JSON only: {"quality":0.0,"safety":0.0${ragUsed ? ',"faithfulness":0.0' : ''}}`
      }],
    })

    const scIn = scoringResponse.usage?.input_tokens || 0
    const scOut = scoringResponse.usage?.output_tokens || 0
    scoringGen.end({
      usage: { input: scIn, output: scOut },
    })

    const text = scoringResponse.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const scores = JSON.parse(jsonMatch[0])

    langfuse.score({ traceId, name: 'quality', value: scores.quality, comment: 'online' })
    langfuse.score({ traceId, name: 'safety', value: scores.safety, comment: 'online' })
    if (ragUsed && scores.faithfulness !== undefined) {
      langfuse.score({ traceId, name: 'faithfulness', value: scores.faithfulness, comment: 'online' })
    }

    await langfuse.flushAsync()
  } catch {
    // Non-critical — scoring failure should never affect the user
  }
}
