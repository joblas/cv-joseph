import { Langfuse } from 'langfuse'
import { waitUntil } from '@vercel/functions'
import { resolvePersona } from './_shared/personas.js'
import {
  calcCost, isRagEnabled, portfolioTool, formatChunksForContext, PORTFOLIO_TOOL,
  searchPortfolio, filterSourcesByResponse, filterSiteSources, detectMentionedArticles,
  HOME_SOURCE, classifyIntent, sendJailbreakAlert,
  LEAK_RESPONSE,
} from './_shared/rag.js'
import { getSystemPrompt } from './_shared/prompt.js'
import { captureLead, checkRateLimit } from './_shared/leads.js'
import { BOOKING_TOOL_NAMES, bookingContext, bookingFallbackText, bookingTools, runBookingTool } from './_shared/booking.js'
import { CHAT_MODEL, FAST_MODEL, CHAT_MAX_TOKENS, scaleTokens, baseUrlHost, createAnthropicClient } from './_shared/models.js'
import { voiceProvider } from './_shared/voice-provider.js'
import { visitorAddresses } from './_shared/contact-email.js'
import { normalizeMessages } from './_shared/messages.js'
import { replyText } from './_shared/reply-text.js'

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
// The first call (tools on) must commit, to answer text or a tool call, by
// then. Past it the reply is written without tools.
export const decisionTimeoutMs = () => limitMs('CHAT_DECISION_TIMEOUT_MS', 25000)
// A first call SILENT this long (no event at all; a model thinking out loud is
// alive) gets a second, identical request.
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

// Stream events this file reads.
const isText = (e) => e?.type === 'content_block_delta' && e.delta?.type === 'text_delta'
const isToolStart = (e) => e?.type === 'content_block_start' && e.content_block?.type === 'tool_use'
const LEFT = 'the reply ended before the tool decision'

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
// attempt, so the retry, the fallback and the error message still run. `ms` may
// be a function, read each time the limit re-arms (the first call's limit
// changes once it commits to an answer).
async function* untilStalled(stream, ms) {
  let stalled = false
  let timer
  let limit = 0
  const arm = () => {
    clearTimeout(timer)
    limit = typeof ms === 'function' ? ms() : ms
    timer = setTimeout(() => { stalled = true; stream.abort() }, limit)
  }
  arm()
  try {
    for await (const event of stream) {
      arm()
      yield event
    }
  } catch (err) {
    throw stalled ? new Error(`stream stalled: no data for ${limit}ms`) : err
  } finally {
    clearTimeout(timer)
  }
  // The SDK rejects the iterator on abort today; if a version ever ended it
  // quietly instead, a cut-off reply must still not pass as a whole one.
  if (stalled) throw new Error(`stream stalled: no data for ${limit}ms`)
}

// The events of the first of up to two identical streams to COMMIT: by
// default, to produce answer text. The second starts only when the first has
// gone SILENT for hedgeMs (no event at all: a model still thinking out loud is
// alive and is not raced, which would only double its cost) and when there is
// still time for it (`mayRace()`); whichever commits first is kept and the
// other cancelled, so a stuck request costs seconds and a healthy slow one is
// never cut off, only raced. Each stream's silence limit is `idleMs`. When
// neither commits, the error says why (an empty output first, so a retry gets
// the bigger budget). `winner()` is the kept stream, for its final message.
//
// The first call of a reply (it carries the tools, and is the answer itself
// when no tool is needed) also passes:
// - `commit(event, textSoFar)`: what counts as committing ('text' or 'tool').
// - `until`: an absolute time. Nothing committed by then aborts every request
//   and throws ("tool decision timed out"), body stalls included.
// - `quickRetry {withinMs, delayMs, onRetry}`: a request that FAILS with a
//   408, 429 or 5xx within withinMs of the start, while it is the only one,
//   gets one more after delayMs; a slow failure buys no second slow try.
// - `signal`: the visitor left or the reply hit a ceiling; everything stops.
function firstToSpeak(makeStream, {
  hedgeMs, idleMs, mayRace = () => true, onHedge,
  commit = (event) => (isText(event) ? 'text' : null),
  until = null, quickRetry = null, signal = null,
}) {
  const contenders = []
  let winner = null
  let committedOn = null
  let hedged = false
  let retried = false
  const add = () => {
    const stream = makeStream(contenders.length)
    const c = { stream, it: untilStalled(stream, idleMs), buffer: [], text: '', over: false, error: null, lastEventAt: Date.now() }
    c.pull = () => { c.next = c.it.next().then((r) => ({ c, r }), (error) => ({ c, error })) }
    c.pull()
    contenders.push(c)
  }
  const retryable = (err) => typeof err?.status === 'number' && (err.status === 408 || err.status === 429 || err.status >= 500)
  async function* events() {
    if (signal?.aborted) throw new Error(LEFT)
    const started = Date.now()
    let leave = null
    const left = signal ? new Promise((resolve) => { leave = () => resolve({ left: true }); signal.addEventListener('abort', leave) }) : null
    let retry = null
    let retryTimer
    add()
    let raceClosed = false
    try {
      while (!winner) {
        const live = contenders.filter((c) => !c.over)
        if (!live.length && !retry) {
          throw (contenders.find((c) => emptyOutput(c.error)) || contenders[contenders.length - 1]).error
        }
        const waits = live.map((c) => c.next)
        if (retry) waits.push(retry)
        if (left) waits.push(left)
        let hedgeTimer
        let untilTimer
        const first = contenders[0]
        if (contenders.length < 2 && !first.over && !raceClosed) {
          waits.push(new Promise((resolve) => {
            hedgeTimer = setTimeout(() => resolve({ hedge: true }), Math.max(0, first.lastEventAt + hedgeMs - Date.now()))
          }))
        }
        if (until !== null) {
          waits.push(new Promise((resolve) => {
            untilTimer = setTimeout(() => resolve({ until: true }), Math.max(0, until - Date.now()))
          }))
        }
        const out = await Promise.race(waits)
        clearTimeout(hedgeTimer)
        clearTimeout(untilTimer)
        if (out.left || signal?.aborted) throw new Error(LEFT)
        if (out.until) throw new Error(`tool decision timed out after ${Date.now() - started}ms`)
        if (out.retry) {
          retry = null
          add()
          continue
        }
        if (out.hedge) {
          if (mayRace()) {
            onHedge?.(Date.now() - first.lastEventAt)
            hedged = true
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
          if (quickRetry && contenders.length < 2 && Date.now() - started < quickRetry.withinMs && retryable(out.error)) {
            retried = true
            quickRetry.onRetry?.(out.error.status)
            retry = new Promise((resolve) => { retryTimer = setTimeout(() => resolve({ retry: true }), quickRetry.delayMs) })
          }
          continue
        }
        if (out.r.done) {
          // Ended without committing: a thinking model spent its whole budget.
          c.over = true
          const final = await c.stream.finalMessage().catch(() => null)
          c.error = new Error(`empty output (stop_reason=${final?.stop_reason ?? 'unknown'})`)
          continue
        }
        c.lastEventAt = Date.now()
        c.buffer.push(out.r.value)
        if (isText(out.r.value)) c.text += out.r.value.delta.text
        const kind = commit(out.r.value, c.text)
        if (kind) {
          winner = c
          committedOn = kind
        } else {
          c.pull()
        }
      }
      for (const c of contenders) if (c !== winner && !c.over) c.stream.abort()
      yield* winner.buffer
      for (;;) {
        const r = await winner.it.next()
        if (r.done) break
        yield r.value
      }
    } finally {
      clearTimeout(retryTimer)
      if (leave) signal.removeEventListener('abort', leave)
      for (const c of contenders) if (c !== winner && !c.over) c.stream.abort()
      // Left early (a blocked leak): close the kept stream too.
      await winner?.it.return?.()
    }
  }
  return {
    events: events(),
    winner: () => winner?.stream,
    committedOn: () => committedOn,
    hedged: () => hedged,
    retried: () => retried,
  }
}

// One comment line before [DONE] that says where this reply's time went
// (integer ms, counts and enums; no content). Every widget skips ':' lines.
// first = request arrival to the first visible words; words = to the first
// words the visitor KEPT (the first text after the last clear: words written
// before a search, or half an answer before a retry, are cleared, so on those
// replies `first` is not when the answer began); total = to [DONE].
function timingLine(t, t0) {
  t.total = Date.now() - t0
  const fields = Object.entries(t)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${typeof v === 'number' ? Math.max(0, Math.round(v)) : String(v).toLowerCase().replace(/[^a-z0-9]/g, '')}`)
  return `: timing ${fields.join(' ')}\n\n`
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
    const rl0 = Date.now()
    if (!isTrustedEval && !(await checkRateLimit(req))) {
      return new Response(
        JSON.stringify({
          error: 'rate_limited',
          message: persona.rateLimitMessage,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      )
    }
    const rlMs = Date.now() - rl0

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
    return respondNow(async ({ signal }) => {
      // Prompt versioning: Langfuse with file fallback (Block 4)
      // Support X-Prompt-Version header for regression testing (Block 5)
      const overrideVersion = req.headers.get('x-prompt-version')
      const overrideAuth = req.headers.get('x-prompt-auth')
      // Only personas with a Langfuse-managed prompt can be pinned to a version.
      // Pinned or not, getSystemPrompt composes the work list in (prompt.js).
      const pinned = overrideAuth === process.env.PROMPT_REGRESSION_SECRET && overrideVersion && langfuse && persona.langfusePrompt
      const prompt0 = Date.now()
      const { text: systemPromptText, version: promptVersion } =
        await getSystemPrompt(langfuse, persona, pinned ? { version: parseInt(overrideVersion) } : undefined)
      const promptMs = Date.now() - prompt0

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

      const ragEnabled = isRagEnabled(persona)
      // Booking tools appear only when every booking secret is set (booking.js).
      const tools = [...(ragEnabled ? [portfolioTool(persona)] : []), ...bookingTools(persona)]

      // The tools the model called. Every tool_use block needs a tool_result in
      // the next message, or the request is malformed. With one tool the model
      // calls at most one; with booking tools it may call two at once (search +
      // availability).
      const runTools = async (blocks, status) => {
        let ragResult = null
        let bookingRan = false
        const bookingResults = []
        const toolResults = []
        for (const block of blocks.filter(b => b.type === 'tool_use')) {
          let content
          if (block.name === PORTFOLIO_TOOL.name && ragEnabled && !ragResult) {
            status('searching')
            ragResult = await searchPortfolio(block.input?.query || lastUserMessage, trace, client, persona)
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
        return { ragResult, bookingRan, bookingResults, toolResults }
      }

      return streamResponse({
        systemBlocks,
        messages: cleanMessages,
        tools,
        runTools,
        signal,
        canary,
        intentTags,
        trace,
        langfuse,
        lastUserMessage,
        t0,
        timing: { rl: rlMs, prompt: promptMs },
        promptVersion,
        persona,
        onReplyDone: resolveReply,
      })
    }, {
      persona,
      t0,
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
function respondNow(answer, { persona, onFailure, t0 = Date.now() }) {
  const encoder = new TextEncoder()
  // Aborted when the visitor leaves or the reply hits a ceiling: the work
  // behind the reply (the tool decision, the model streams) stops with it.
  const work = new AbortController()
  const started = Date.now()
  let heartbeat = null
  let wordsCeiling = null
  let ceiling = null
  let inner = null
  let gone = false
  let ended = false // the reply was ended early (a ceiling): nothing more goes out
  let firstWordsAt = 0
  let keptWordsAt = 0 // the first words since the last clear (timingLine's `words`)
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
      // The timing line (streamResponse's, see timingLine) for a reply that
      // ends here instead: `ceiling=1` or `error=1`, so the slowest replies are
      // not the ones with no data.
      const timing = (flag) => `: timing ${firstWordsAt ? `first=${firstWordsAt - t0} ` : ''}${keptWordsAt ? `words=${keptWordsAt - t0} ` : ''}total=${Date.now() - t0} ${flag}=1\n\n`
      // Whatever hangs inside, the reply ends: the error message, then [DONE].
      const giveUp = (why) => {
        if (ended || gone) return
        ended = true
        console.error(`[chat] reply ceiling: ${why}`)
        onFailure(new Error(`reply ceiling: ${why}`))
        send(errorEvent(persona.errorMessage))
        send(timing('ceiling'))
        send('data: [DONE]\n\n')
        stopTimers()
        work.abort()
        inner?.cancel().catch(() => {})
        close()
      }
      // No words of an answer by firstWordsCeilingMs() after the request
      // started ends the reply. Armed at the start, lifted by the first words,
      // and armed again (still from the start) when those words are cleared:
      // "" before a retry, or the words the model wrote before deciding to
      // search. A cleared answer must not leave the visitor waiting on dots
      // with no limit but the reply ceiling.
      const armWordsCeiling = () => {
        clearTimeout(wordsCeiling)
        wordsCeiling = setTimeout(() => giveUp(`no answer words after ${firstWordsCeilingMs()}ms`), Math.max(0, started + firstWordsCeilingMs() - Date.now()))
      }
      send(': connected\n\n')
      heartbeat = setInterval(() => send(': ping\n\n'), heartbeatMs())
      armWordsCeiling()
      ceiling = setTimeout(() => giveUp(`the reply ran past ${replyCeilingMs()}ms`), replyCeilingMs())
      const decoder = new TextDecoder()
      try {
        const response = await answer({ signal: work.signal })
        inner = response.body.getReader()
        if (gone || ended) await inner.cancel()
        for (;;) {
          const { done, value } = await inner.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          if (/"text":"[^"]/.test(chunk)) {
            if (!firstWordsAt) firstWordsAt = Date.now()
            if (!keptWordsAt) keptWordsAt = Date.now()
            if (wordsCeiling) {
              clearTimeout(wordsCeiling)
              wordsCeiling = null
            }
          } else if (/"text":"","replace":true/.test(chunk)) {
            keptWordsAt = 0
            if (!wordsCeiling && !ended) armWordsCeiling()
          }
          send(value)
        }
      } catch (error) {
        if (!ended && !gone) {
          onFailure(error)
          send(errorEvent(persona.errorMessage))
          send(timing('error'))
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
// The reply: the first call (tools on), the search, the answer, the fallback
// ---------------------------------------------------------------------------

// Until 2026-10-02 the first call (the model deciding whether to search) ran
// without streaming: on the turns that needed no search (15 of 18 measured
// that day) the visitor waited for the WHOLE answer, thinking included, and
// then watched it dripped out. Now the first call streams, tools on, and its
// first visible word is the visitor's first word:
//
// - It COMMITS on the first visible text (that stream is the answer, attempt 0)
//   or on a tool_use block. Until then it is raced, bounded and retried like
//   the old decision (firstToSpeak: decisionTimeoutMs, a second identical
//   request after decisionHedgeMs of silence, one quick retry on 408/429/5xx).
// - Text written before a tool call (a "preamble") is cleared with a replace
//   "" the moment the tool call starts; the search runs, then the answer.
// - Nothing committed (a hang, two failures, a refusal, an empty output): the
//   reply is written without tools, told so (toolsUnavailableNote), with the
//   usual retry and fallback.
// - Committed to text, then broke off: the words are cleared and the retry
//   is written without tools, told so too (the words may have been a
//   preamble to a search that never came).
//
// Every attempt's text goes through replyText (reply-text.js): a leak is
// caught before it is sent, and a misspelled contact address is corrected
// before it leaves. Everything goes out through one controller, in order.
function streamResponse({
  systemBlocks, messages, tools = [], runTools = null, signal = null,
  canary, intentTags, trace, langfuse, lastUserMessage, t0, timing = {},
  promptVersion, persona, onReplyDone = () => {},
}) {
  let replyForLead = null
  // The whole reply, retries and fallback included, answers inside the deadline.
  const deadline = t0 + replyDeadlineMs()
  const timeLeft = () => deadline - Date.now()
  const attemptIdleMs = () => Math.min(streamIdleMs(), Math.max(minAttemptMs(), timeLeft()))
  // Addresses the visitor typed are theirs: the contact-address fix never touches them.
  const visitorsOwn = visitorAddresses(messages)
  const newReply = () => replyText({ canary, contact: persona.contactEmail, visitorsOwn })
  const encoder = new TextEncoder()
  const MAX_RETRIES = 1

  // What the search found, for badges, traces and cost.
  let ragSources = []
  let ragUsed = false
  let ragMetrics = {}
  let ragUsage = { embeddingTokens: 0, rerankInputTokens: 0, rerankOutputTokens: 0 }
  let toolDecisionMs = 0
  let tdInputTokens = 0
  let tdOutputTokens = 0
  let generationCost = 0

  // The timing line's fields, in order (timingLine). Values are set as the
  // reply goes; a field that does not apply is never set.
  const t = {
    first: undefined, words: undefined, total: undefined, rl: timing.rl, prompt: timing.prompt,
    call1: undefined, commit: 'none', hedge1: undefined, retry1: undefined,
    search: undefined, embed: undefined, retrieve: undefined, rerank: undefined, chunks: undefined,
    ttft2: undefined, attempt: undefined, fallback: 0, stop: undefined,
    in1: undefined, cached1: undefined, in2: undefined, cached2: undefined,
  }
  const usageOf = (msg) => ({ in: msg?.usage?.input_tokens ?? undefined, cached: msg?.usage?.cache_read_input_tokens ?? undefined })

  const generationSpan = trace?.span({ name: 'generation', metadata: { streaming: true } })

  // Every model stream this reply opens, so that a visitor who leaves (or whose
  // widget gives up and asks again) stops paying for this answer.
  const openStreams = new Set()
  let clientGone = false
  const opened = (s) => { openStreams.add(s); return s }
  const gone = () => clientGone || Boolean(signal?.aborted)

  const readableStream = new ReadableStream({
    async start(controller) {
      let closed = false
      const emit = (s) => {
        if (closed) return
        try { controller.enqueue(encoder.encode(s)) } catch { closed = true }
      }
      const close = () => {
        if (closed) return
        closed = true
        try { controller.close() } catch { /* already closed */ }
      }
      // What the visitor sees right now (a replace swaps it whole).
      let onScreen = ''
      let answerStartedAt = 0
      const sendText = (text) => {
        if (!text) return
        const now = Date.now()
        if (t.first === undefined) t.first = now - t0
        if (t.words === undefined) t.words = now - t0
        if (answerStartedAt && t.ttft2 === undefined) t.ttft2 = now - answerStartedAt
        onScreen += text
        emit(`data: ${JSON.stringify({ text })}\n\n`)
      }
      const sendReplace = (text) => {
        onScreen = text
        // Cleared: the words kept so far are gone. Replaced with words: those count.
        t.words = text ? (t.words ?? Date.now() - t0) : undefined
        emit(`data: ${JSON.stringify({ text, replace: true })}\n\n`)
      }
      const status = (phase) => emit(`event: status\ndata: ${JSON.stringify({ phase })}\n\n`)
      const degraded = (reason) => emit(`event: rag-status\ndata: ${JSON.stringify({ status: 'degraded', reason })}\n\n`)
      const finish = () => {
        emit(timingLine(t, t0))
        emit('data: [DONE]\n\n')
        close()
      }
      const blockLeak = (reply, stream) => {
        trace?.update({
          tags: [...intentTags, 'prompt-leak-blocked'],
          metadata: { leakDetectedAt: reply.visible.length, ...(stream ? { stream } : {}) },
        })
        sendReplace(LEAK_RESPONSE)
        finish()
        waitUntil(sendJailbreakAlert(`[PROMPT LEAK BLOCKED${stream === 'fallback' ? ' - FALLBACK' : ''}] User: ${lastUserMessage}`))
        generationSpan?.end({ metadata: { blocked: true } })
        if (langfuse) waitUntil(langfuse.flushAsync())
      }
      const logFailure = (attempt, err) => {
        console.error(`[chat] reply stream attempt ${attempt + 1} failed: ${err?.constructor?.name || 'Error'}: ${String(err?.message || '').slice(0, 200)}`)
        trace?.update({
          tags: [...intentTags, `stream-error:${attempt < MAX_RETRIES ? 'retrying' : 'exhausted'}`],
          metadata: {
            [`streamError_attempt${attempt}`]: err?.message,
            [`streamErrorType_attempt${attempt}`]: err?.constructor?.name,
            elapsedMs: Date.now() - t0,
          },
        })
      }
      // Between a failed attempt and the next: a pause long enough to ride out
      // a short provider hiccup, then the half-written answer is cleared. A
      // pause that cannot lead to a retry in time only delays the error message.
      const betweenAttempts = async () => {
        if (timeLeft() < STREAM_RETRY_DELAY_MS + minAttemptMs()) {
          console.error('[chat] reply deadline reached, skipping the retry')
          return false
        }
        await new Promise(r => setTimeout(r, STREAM_RETRY_DELAY_MS))
        sendReplace('')
        return true
      }

      // One stream's events to the visitor, through `reply`. With `toolsOn`
      // (the first call), a tool_use block ends the forwarding: text already
      // shown is cleared at once (before the "searching" status), and the rest
      // of the message is read, within `drainUntil`, for the tool call itself.
      const pump = async (race, reply, state = {}, { toolsOn = false, drainUntil = 0 } = {}) => {
        let drainTimer = null
        try {
          for await (const event of race.events) {
            if (toolsOn && !state.toolAt && isToolStart(event)) {
              state.toolAt = Date.now()
              state.preamble = Boolean(reply.visible)
              if (state.preamble) sendReplace('')
              drainTimer = setTimeout(() => race.winner()?.abort(), Math.max(0, drainUntil - Date.now()))
            }
            if (state.toolAt || !isText(event)) continue
            const r = reply.push(event.delta.text)
            if (r.leak) return { leak: true }
            sendText(r.out)
          }
        } finally {
          clearTimeout(drainTimer)
        }
        return { leak: false }
      }
      // The answer's end: what the emitter still held goes out; no visible
      // text at all is a failure, not a reply (a thinking model can spend its
      // whole budget), so the retry/fallback/error path runs instead of an
      // empty bubble.
      const ending = (reply, msg, emptyMessage = `empty output (stop_reason=${msg?.stop_reason})`) => {
        const end = reply.end()
        if (!end.text.trim()) throw new Error(emptyMessage)
        sendText(end.out)
        return end
      }

      let reply = null
      let answerSystem = systemBlocks
      let answerMessages = messages
      let fallbackMessages = messages
      let lastResortText = null
      let lastError = null
      let firstAttempt = 0
      let skipRetries = false
      let result = null // { msg, end }: the answer that was given

      try {
        // ---- Phase 0: the first call, tools on ------------------------------
        if (tools?.length) {
          const decisionStart = Date.now()
          const until = decisionStart + decisionTimeoutMs()
          const toolDecisionSpan = trace?.span({ name: 'tool_decision' })
          let committedAt = 0
          let race = null
          race = firstToSpeak(() => opened(client.messages.stream({
            model: CHAT_MODEL,
            max_tokens: CHAT_MAX_TOKENS, // it may BE the answer
            system: systemBlocks,
            messages,
            tools,
          }, { maxRetries: 0 })), {
            hedgeMs: decisionHedgeMs(),
            idleMs: () => (race?.committedOn() ? attemptIdleMs() : decisionTimeoutMs()),
            onHedge: (ms) => console.error(`[chat] tool decision slow (${ms}ms), racing a second request`),
            commit: (event, text) => {
              const kind = isToolStart(event) ? 'tool' : isText(event) && /\S/.test(text) ? 'text' : null
              if (kind) committedAt = Date.now()
              return kind
            },
            until,
            quickRetry: {
              withinMs: quickFailureMs(),
              delayMs: STREAM_RETRY_DELAY_MS,
              onRetry: (status) => console.error(`[chat] tool decision failed (HTTP ${status}), retrying once`),
            },
            signal,
          })
          reply = newReply()
          const state = { toolAt: 0, preamble: false }
          let outcome
          try {
            const res = await pump(race, reply, state, { toolsOn: true, drainUntil: until })
            if (res.leak) {
              t.commit = race.committedOn() || 'text'
              blockLeak(reply)
              return
            }
            const msg = await race.winner().finalMessage()
            outcome = state.toolAt
              ? (msg.content.some((b) => b.type === 'tool_use') ? { tool: msg } : { failed: new Error('tool decision without a tool call') })
              : { answered: msg }
          } catch (err) {
            // Before it committed, or while reading a tool call: the decision
            // failed. After committing to text: the answer broke off midway.
            outcome = !race.committedOn() || state.toolAt ? { failed: err } : { broke: err }
          }
          t.call1 = (committedAt || Date.now()) - decisionStart
          t.hedge1 = race.hedged() ? 1 : 0
          t.retry1 = race.retried() ? 1 : 0
          if (gone()) return

          if (!outcome.tool && !outcome.failed) {
            toolDecisionSpan?.end({ metadata: { toolUsed: false, answeredDirectly: true, latencyMs: Date.now() - decisionStart } })
          }
          if (outcome.answered) {
            t.commit = 'text'
            const u = usageOf(outcome.answered)
            t.in1 = u.in
            t.cached1 = u.cached
            t.attempt = 0
            result = { msg: outcome.answered, end: ending(reply, outcome.answered) }
          } else if (outcome.broke) {
            // Attempt 0 of the answer failed midway: attempt 1 is a plain
            // stream (no tools), then the fallback. Words written before a
            // tool call look like an answer until the tool_use block arrives,
            // so the broken text may have been "Let me look that up": the
            // retry runs without tools and is told so, like a failed decision
            // (no claimed search, no offered or booked times).
            t.commit = 'text'
            lastError = outcome.broke
            logFailure(0, lastError)
            firstAttempt = 1
            answerSystem = [...systemBlocks, { type: 'text', text: toolsUnavailableNote(persona) }]
            if (!(await betweenAttempts())) skipRetries = true
          } else if (outcome.tool) {
            t.commit = state.preamble ? 'preamble' : 'tool'
            const msg = outcome.tool
            const u = usageOf(msg)
            t.in1 = u.in
            t.cached1 = u.cached
            toolDecisionMs = Date.now() - decisionStart
            tdInputTokens = msg.usage?.input_tokens || 0
            tdOutputTokens = msg.usage?.output_tokens || 0
            toolDecisionSpan?.end({
              metadata: {
                stopReason: msg.stop_reason,
                toolUsed: true,
                preamble: state.preamble,
                inputTokens: tdInputTokens,
                outputTokens: tdOutputTokens,
                latencyMs: toolDecisionMs,
                cost: calcCost(CHAT_MODEL, tdInputTokens, tdOutputTokens),
              },
            })
            const search0 = Date.now()
            const ran = await runTools(msg.content, status)
            // The search can take seconds: a visitor who left meanwhile gets no answer.
            if (gone()) return
            if (ran.ragResult) {
              ragUsed = true
              ragSources = ran.ragResult.sources
              ragMetrics = ran.ragResult.metrics || {}
              ragUsage = ran.ragResult.usage || ragUsage
              t.search = Date.now() - search0
              t.embed = ragMetrics.embeddingMs
              t.retrieve = ragMetrics.retrievalMs
              t.rerank = ragMetrics.rerankMs
              t.chunks = ran.ragResult.chunks?.length || 0
              if (ran.ragResult.degraded) degraded(ran.ragResult.degradedReason)
            }
            answerMessages = [
              ...messages,
              { role: 'assistant', content: msg.content },
              { role: 'user', content: ran.toolResults },
            ]
            // The fallback normally drops the tool results (it retries without
            // retrieval). A booking result must survive it: a call may already
            // be on Joe's calendar, and a reply that doesn't know would mislead.
            fallbackMessages = ran.bookingRan ? answerMessages : messages
            // ...and if every attempt fails, the visitor still hears what
            // happened to their call instead of a generic error.
            lastResortText = ran.bookingRan ? bookingFallbackText(ran.bookingResults, persona) : null
          } else {
            // No decision: the reply is written without tools. The runtime
            // notes may still describe tools this reply does not have (search;
            // in-chat booking once configured), so a note says they are off.
            t.commit = 'failed'
            lastError = outcome.failed
            console.error(`[chat] tool decision failed, answering without tools: ${lastError?.constructor?.name || 'Error'}: ${String(lastError?.message || '').slice(0, 200)}`)
            toolDecisionSpan?.end({ metadata: { error: lastError?.message } })
            degraded('tool_decision_failed')
            answerSystem = [...systemBlocks, { type: 'text', text: toolsUnavailableNote(persona) }]
          }
        }

        // ---- The answer: attempts 0-1 (fresh streams, no tools) ---------------
        if (!result) {
          answerStartedAt = Date.now()
          for (let attempt = firstAttempt; attempt <= MAX_RETRIES && !skipRetries; attempt++) {
            if (gone()) return
            // A retry that cannot finish in time only delays the error message.
            if (attempt > 0 && timeLeft() < minAttemptMs()) {
              console.error('[chat] reply deadline reached, skipping the retry')
              break
            }
            if (attempt > 0) status('retrying')
            reply = newReply()
            try {
              // An answer that came back EMPTY (its budget spent thinking) is
              // retried with twice the budget.
              const budget = emptyOutput(lastError) ? CHAT_MAX_TOKENS * 2 : CHAT_MAX_TOKENS
              const race = firstToSpeak(() => opened(client.messages.stream({
                model: CHAT_MODEL,
                max_tokens: budget,
                system: answerSystem,
                messages: answerMessages,
              })), {
                hedgeMs: answerHedgeMs(),
                idleMs: attemptIdleMs,
                mayRace: () => timeLeft() >= minAttemptMs(),
                onHedge: (ms) => console.error(`[chat] reply silent for ${ms}ms, racing a second stream`),
              })
              const res = await pump(race, reply)
              if (res.leak) {
                blockLeak(reply)
                return
              }
              const msg = await race.winner().finalMessage()
              result = { msg, end: ending(reply, msg) }
              const u = usageOf(msg)
              t.in2 = u.in
              t.cached2 = u.cached
              t.attempt = attempt
              lastError = null
              break
            } catch (err) {
              lastError = err
              logFailure(attempt, err)
              if (attempt < MAX_RETRIES && !(await betweenAttempts())) break
            }
          }
          if (!result) throw lastError || new Error('the visitor left')
        }

        // ---- Success ------------------------------------------------------------
        const { msg, end } = result
        const answer = end.text
        replyForLead = answer
        t.stop = String(msg?.stop_reason || '').split('_')[0] || undefined
        const genIn = msg?.usage?.input_tokens || 0
        const genOut = msg?.usage?.output_tokens || 0
        generationCost = calcCost(CHAT_MODEL, genIn, genOut)
        generationSpan?.end({
          metadata: {
            outputTokens: genOut,
            inputTokens: genIn,
            latencyMs: Date.now() - t0,
            attempt: t.attempt,
            commit: t.commit,
            cost: generationCost,
          },
        })

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
        if (process.env.ENABLE_ONLINE_SCORING === 'true' && langfuse && trace && answer) {
          waitUntil(scoreTrace(trace.id, lastUserMessage, answer, ragUsed, langfuse))
        }

        // Send source badges AFTER response
        // 1. RAG sources filtered to mentioned articles (deep-links to sections)
        // 2. Keyword-detected articles not covered by RAG (links to article root)
        // 3. Home fallback only if RAG was used but no specific articles matched
        // 4. No badges at all for greetings/simple questions (ragUsed=false, no articles detected)
        let finalSources
        if (persona.rag.articleBadges) {
          finalSources = ragSources.length > 0
            ? filterSourcesByResponse(ragSources, answer)
            : []

          // Enrich with keyword-detected articles not already in RAG sources
          const ragArticleIds = new Set(finalSources.map(s => s.article_id))
          const detected = detectMentionedArticles(answer)
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
          finalSources = filterSiteSources(ragSources, answer)
        }

        if (finalSources.length > 0) {
          emit(`event: rag-sources\ndata: ${JSON.stringify(finalSources)}\n\n`)
        }
        // A contact address the visitor already saw in another case is
        // corrected in place (reply-text.js). Both widgets render a replace
        // event as the whole answer, badging it with the sources received so
        // far, so it is sent after rag-sources.
        if (end.replace) sendReplace(end.replace)

        if (langfuse) waitUntil(langfuse.flushAsync())
        finish()
      } catch (error) {
        // The visitor left: nothing to answer, and nothing went wrong.
        if (gone()) return
        generationSpan?.end({ metadata: { error: error.message } })
        trace?.update({ tags: [...intentTags, 'rag:fallback'], metadata: { streamingError: error.message } })

        // Graceful degradation: one more answer without retrieval (just the
        // system prompt), unless the last attempt's words are on screen.
        const fallbackInTime = timeLeft() >= FALLBACK_DELAY_MS + minAttemptMs()
        if (!onScreen && !fallbackInTime) {
          console.error('[chat] reply deadline reached, skipping the fallback')
        }
        if (!onScreen && fallbackInTime) {
          console.error(`[chat] reply failed, running the fallback: ${String(error?.message || '').slice(0, 200)}`)
          status('retrying')
          await new Promise(r => setTimeout(r, FALLBACK_DELAY_MS))
          if (gone()) return
          try {
            const fallbackRace = firstToSpeak(() => opened(client.messages.stream({
              model: CHAT_MODEL,
              max_tokens: emptyOutput(error) ? CHAT_MAX_TOKENS * 2 : CHAT_MAX_TOKENS,
              system: answerSystem,
              messages: fallbackMessages,
            })), {
              hedgeMs: answerHedgeMs(),
              idleMs: attemptIdleMs,
              mayRace: () => timeLeft() >= minAttemptMs(),
              onHedge: (ms) => console.error(`[chat] fallback silent for ${ms}ms, racing a second stream`),
            })

            // Send degraded status so frontend knows RAG failed
            degraded('streaming_fallback')
            t.fallback = 1
            answerStartedAt = answerStartedAt || Date.now()
            reply = newReply()
            const res = await pump(fallbackRace, reply)
            if (res.leak) {
              blockLeak(reply, 'fallback')
              return
            }
            const msg = await fallbackRace.winner().finalMessage()
            // Same guard as the main stream: no text at all is a failure, not a reply.
            const end = ending(reply, msg, 'empty fallback output')
            if (end.replace) sendReplace(end.replace)
            replyForLead = end.text
            t.stop = String(msg?.stop_reason || '').split('_')[0] || undefined

            finish()
            if (langfuse) waitUntil(langfuse.flushAsync())
            return
          } catch (fallbackErr) {
            // fall through to the last-resort error message
            console.error(`[chat] fallback failed too: ${String(fallbackErr?.message || '').slice(0, 200)}`)
            trace?.update({ metadata: { fallbackError: fallbackErr?.message } })
          }
        }

        // Last resort. Only the error message is an error. A booking result
        // (lastResortText) is real information: the visitor keeps it as the
        // answer and the model must see it in later turns, so it is never
        // flagged.
        if (lastResortText) sendReplace(lastResortText)
        else emit(errorEvent(persona.errorMessage))
        finish()
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

  return new Response(readableStream, { headers: SSE_HEADERS })
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
