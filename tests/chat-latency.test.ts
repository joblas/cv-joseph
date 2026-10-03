/* eslint-disable @typescript-eslint/no-explicit-any --
 * Drives the real /api/chat and /api/rag-search handlers against a scripted
 * fake world (tests/fixtures/fake-model.ts) and reads the visitor's side
 * through the real widget parser (src/agent-stream.ts).
 */
// THE OFFLINE LATENCY HARNESS (2026-10-02). Joe: "I want the users to be able
// to have instant response." Measured as the time to the FIRST VISIBLE WORDS
// in text chat, and to the voice agent's answer after a search.
//
// Every outside call answers after a fixed delay: the rate limiter 20ms, a
// Voyage embed 80ms, a Voyage rerank 60ms, the site search 300ms (jts) or
// 150ms (cloudyjoe); a model call 30ms to its headers, then its scripted
// thinking, then one word every 15ms. So the visitor's timeline depends on the
// handlers' ORDER of work alone.
//
// What CI checks is structure, never a wall-clock budget (a loaded runner
// would flake): the first words arrive before the first call has finished
// writing; how many model calls ran; that no LLM rerank ran; that a visitor
// who leaves stops every call; that nothing is shown the model did not write.
// And no added wait: each step starts within 100ms of the event it waits on
// in the fake world (the rate limit, the first call's end, the search's last
// answer, the model's first word), measured against that world's own clock,
// so a slow runner stretches both sides alike.
// LATENCY_REPORT=1 prints the milliseconds for the PR (and LATENCY_SCALE
// stretches every delay). The same file, copied onto the code before this
// change, is how the "before" numbers were taken; it fails there, by design.
import {
  calls, serviceCalls, setWorld, fakeFetch, delay, JTS_MARKER, CJ_MARKER, SCALE,
  type ModelScript, type Kind, type Services,
} from './fixtures/fake-model'

for (const k of Object.keys(process.env)) {
  if (/^(LANGFUSE_|CHAT_|VOICE_|GOOGLE_SA_|BOOKING_)/.test(k)) delete process.env[k]
}
for (const k of ['ANTHROPIC_AUTH_TOKEN', 'PROMPT_REGRESSION_SECRET', 'RESEND_API_KEY', 'ALERT_EMAIL', 'GEMINI_API_KEY']) delete process.env[k]
Object.assign(process.env, {
  ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', ANTHROPIC_API_KEY: 'stub-anthropic',
  SUPABASE_URL: 'https://stub-cj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'stub-service',
  JTS_SUPABASE_URL: 'https://stub-jts.supabase.co', JTS_SUPABASE_ANON_KEY: 'stub-anon',
  VOYAGE_API_KEY: 'stub-voyage',
})
;(globalThis as any).fetch = fakeFetch
const background: Promise<unknown>[] = []
;(globalThis as any).__cfCtxStore = { getStore: () => ({ waitUntil: (p: Promise<unknown>) => { background.push(p) } }) }
const logged: string[] = []
const report = console.error.bind(console)
console.error = (...a: unknown[]) => { logged.push(a.map(String).join(' ')) }
console.warn = () => {}

const { default: chatHandler } = await import('../functions/api-src/chat.js')
const { default: ragSearch } = await import('../functions/api-src/rag-search.js')
const { getPersona } = await import('../functions/api-src/_shared/personas.js')
const { askAgent } = await import('../src/agent-stream')

let failed = 0
function check(name: string, cond: boolean, detail = '') {
  if (!cond) { report(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); failed++ }
}

const ORIGIN = { jts: 'https://www.joestechsolutions.com', cloudyjoe: 'https://cloudyjoe.com' } as const
type Persona = keyof typeof ORIGIN

type ChatRun = {
  connected: number; searching: number; firstWords: number; done: number; firstWordsAt: number
  shown: string; replaced: boolean; timing: Record<string, string>; outcome: any; leftAt: number; t0: number
}
// One visitor turn through the real widget parser. Times are ms from the click.
async function chatTurn(persona: Persona, question: string, scripts: Partial<Record<Kind, ModelScript>>,
  { leaveAtMs = 0, services = {} as Partial<Services> } = {}): Promise<ChatRun> {
  setWorld(scripts, services)
  background.length = 0
  logged.length = 0
  const t0 = Date.now()
  const run: ChatRun = { connected: -1, searching: -1, firstWords: -1, done: -1, firstWordsAt: 0, shown: '', replaced: false, timing: {}, outcome: null, leftAt: 0, t0 }
  let wire = ''
  const stop = new AbortController()
  if (leaveAtMs) setTimeout(() => { run.leftAt = Date.now(); stop.abort() }, leaveAtMs * SCALE)
  // fetch for the widget: the real handler, with a byte tap and the abort wired
  // to the response body the way a browser's fetch does.
  const fetchImpl = (async (_url: string, init: any) => {
    const res: Response = await chatHandler(new Request('https://www.joestechsolutions.com/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN[persona], 'cf-connecting-ip': '203.0.113.9' }, body: init.body,
    }))
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    let outer: ReadableStreamDefaultController<Uint8Array>
    init.signal?.addEventListener('abort', () => { reader.cancel().catch(() => {}); try { outer.error(new DOMException('aborted', 'AbortError')) } catch { /* closed */ } })
    return new Response(new ReadableStream<Uint8Array>({
      start(c) { outer = c },
      async pull(c) {
        const { done, value } = await reader.read()
        if (done) return c.close()
        if (run.connected < 0) run.connected = Date.now() - t0
        wire += dec.decode(value, { stream: true })
        c.enqueue(value)
      },
      cancel() { reader.cancel().catch(() => {}) },
    }), { status: res.status, headers: res.headers })
  }) as unknown as typeof fetch
  run.outcome = await askAgent({
    url: '/api/chat',
    body: { persona, messages: [{ role: 'user', content: question }], lang: 'en', sessionId: `lat-${Math.random()}`, currentPage: '/' },
    fetchImpl,
    isOnline: () => true,
    signal: stop.signal,
    onEvent: (e) => {
      const at = Date.now() - t0
      if (e.type === 'status' && e.phase === 'searching' && run.searching < 0) run.searching = at
      if (e.type === 'text') {
        if (run.firstWords < 0) { run.firstWords = at; run.firstWordsAt = Date.now() }
        run.shown += e.text
      }
      if (e.type === 'replace') {
        run.shown = e.text
        run.replaced = true
      }
    },
  })
  run.done = Date.now() - t0
  if (leaveAtMs) await delay(400)
  await Promise.race([Promise.all(background), delay(5000)])
  const line = wire.split('\n').find((l) => l.startsWith(': timing ')) || ''
  run.timing = Object.fromEntries(line.slice(9).split(' ').filter(Boolean).map((f) => f.split('=')))
  return run
}

type VoiceRun = { total: number; endAt: number; status: number; context: string; tier: string; serverTiming: string }
async function voiceSearch(persona: Persona, query: string, scripts: Partial<Record<Kind, ModelScript>>, services: Partial<Services> = {}): Promise<VoiceRun> {
  setWorld(scripts, services)
  const t0 = Date.now()
  const res: Response = await ragSearch(new Request('https://www.joestechsolutions.com/api/rag-search', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN[persona], 'cf-connecting-ip': '203.0.113.9' },
    body: JSON.stringify({ query, traceId: null, currentPage: '/', persona }),
  }))
  const body: any = await res.json()
  const endAt = Date.now()
  const total = endAt - t0
  const context = String(body.context ?? '')
  return { total, endAt, status: res.status, context, tier: context.includes('REASONED-MARKER') ? 'reasoned' : context ? 'chunks' : 'none', serverTiming: res.headers.get('Server-Timing') || '' }
}

const words = (n: number, tag: string) => `${tag} ${Array.from({ length: n - 1 }, (_, i) => `w${i}`).join(' ')}`
const answerScript = (text: string): ModelScript => ({ hdr: 30, think: 400, tok: 15, text })
const firstText = (n: number, tag: string): ModelScript => ({ hdr: 30, think: 300, tok: 15, text: words(n, tag) })
const firstTool = (query: string, preamble?: string): ModelScript => ({ hdr: 30, think: 300, tok: 15, tool: { query }, ...(preamble ? { preamble } : {}) })
const ofKind = (k: Kind) => calls.filter((c) => c.kind === k)
const systemText = (c: any) => (Array.isArray(c?.body?.system) ? c.body.system[0]?.text : c?.body?.system) ?? ''
const toolResultText = (c: any) => JSON.stringify(c?.body?.messages?.[c.body.messages.length - 1]?.content ?? '')
const rows: string[][] = []
const ms = (n: number) => (n < 0 ? '—' : String(Math.round(n / SCALE)))
// No added wait: a step starts within this long of what it waits on (see the header).
const PROMPTLY = 100 * SCALE
// The last fake service answer at or before `at`.
const lastServiceEndBefore = (at: number) => Math.max(0, ...serviceCalls.filter((s) => s.endAt && s.endAt <= at).map((s) => s.endAt))

// --- S1/S2: no search. The first call IS the answer. -------------------------------
for (const [id, persona, question, n] of [
  ['S1', 'jts', 'Hi there', 40], ['S2', 'cloudyjoe', 'What did Joe do at Google?', 120],
] as const) {
  const script = firstText(n, `${id}-ANSWER`)
  const r = await chatTurn(persona, question, { first: script })
  const first = ofKind('first')[0]
  rows.push([id, `${persona}, no search, ${n} words`, ms(r.connected), ms(r.searching), ms(r.firstWords), ms(r.done), String(calls.length)])
  check(`${id}: the visitor gets the model's answer, exactly as written (no filler)`, r.outcome?.ok === true && r.shown === script.text, r.shown.slice(0, 80))
  check(`${id}: the first words arrive while the first call is still writing (before it ends)`,
    r.firstWordsAt > 0 && !!first?.endAt && r.firstWordsAt < first.endAt - 150 * SCALE,
    `first words ${r.firstWordsAt - (first?.endAt ?? 0)}ms relative to the first call's end`)
  check(`${id}: never before the model wrote them`, !!first?.firstTextAt && r.firstWordsAt >= first.firstTextAt)
  check(`${id}: ...and as soon as it wrote them (nothing held back)`, r.firstWordsAt - first.firstTextAt < PROMPTLY,
    `${r.firstWordsAt - first.firstTextAt}ms after the model's first word`)
  const limiter = serviceCalls.find((s) => s.url.includes('check_chat_rate_limit'))
  check(`${id}: the first call starts right after the rate limit (no wait before it)`,
    !!limiter?.endAt && !!first?.startAt && first.startAt - limiter.endAt < PROMPTLY, `${first?.startAt - (limiter?.endAt ?? 0)}ms after the rate limit answered`)
  check(`${id}: one model call, and no search`, calls.length === 1 && r.searching < 0, `${calls.length} calls`)
  check(`${id}: the model got the persona's own prompt`, systemText(first) === getPersona(persona).prompt)
  check(`${id}: the timing line agrees with the visitor's clock`,
    r.timing.commit === 'text' && Math.abs(Number(r.timing.first) - r.firstWords) <= 250 * SCALE, JSON.stringify(r.timing))
}

// --- S3/S4: a search turn ----------------------------------------------------------
for (const [id, persona, question, marker] of [
  ['S3', 'jts', "What's the Private AI Setup?", JTS_MARKER], ['S4', 'cloudyjoe', 'Tell me about the Hermes system.', CJ_MARKER],
] as const) {
  const answer = answerScript(words(60, `${id}-ANSWER`))
  const r = await chatTurn(persona, question, { first: firstTool(question), answer })
  const answerCall = ofKind('answer')[0]
  rows.push([id, `${persona}, search`, ms(r.connected), ms(r.searching), ms(r.firstWords), ms(r.done), String(calls.length)])
  check(`${id}: the visitor gets the answer written after the search, exactly`, r.outcome?.ok === true && r.shown === answer.text, r.shown.slice(0, 80))
  check(`${id}: "searching" is shown before the first words`, r.searching >= 0 && r.searching < r.firstWords)
  check(`${id}: the answer call holds the corpus the search found (truth)`, toolResultText(answerCall).includes(marker.slice(0, 20)))
  check(`${id}: never before the model wrote them`, !!answerCall?.firstTextAt && r.firstWordsAt >= answerCall.firstTextAt)
  const first = ofKind('first')[0]
  const searchStart = Math.min(...serviceCalls.filter((s) => s.at >= (first?.startAt ?? 0)).map((s) => s.at))
  check(`${id}: the search starts as soon as the first call has asked for it`, !!first?.endAt && searchStart - first.endAt < PROMPTLY,
    `${searchStart - (first?.endAt ?? 0)}ms after the first call ended`)
  check(`${id}: the answer call starts as soon as the search is done`, !!answerCall?.startAt && answerCall.startAt - lastServiceEndBefore(answerCall.startAt) < PROMPTLY,
    `${answerCall?.startAt - lastServiceEndBefore(answerCall?.startAt ?? 0)}ms after the search's last answer`)
  check(`${id}: the answer streams: its first words arrive while it is still writing, as soon as written`,
    !!answerCall?.endAt && r.firstWordsAt < answerCall.endAt - 150 * SCALE && r.firstWordsAt - answerCall.firstTextAt < PROMPTLY,
    `first words ${r.firstWordsAt - (answerCall?.endAt ?? 0)}ms relative to the answer call's end, ${r.firstWordsAt - (answerCall?.firstTextAt ?? 0)}ms after its first word`)
  check(`${id}: the search makes no model call (Voyage ranks; no LLM rerank)`, ofKind('rerank').length === 0 && calls.length === 2,
    calls.map((c) => c.kind).join(','))
  check(`${id}: Voyage reranked the candidates once`, serviceCalls.filter((s) => s.url.includes('/v1/rerank')).length === 1)
  check(`${id}: the timing line names the search`, r.timing.commit === 'tool' && Number(r.timing.search) > 0 && Number(r.timing.chunks) > 0, JSON.stringify(r.timing))
}

// --- S6: the visitor leaves at 100ms: everything behind the reply stops ---------------
{
  const r = await chatTurn('cloudyjoe', 'What did Joe do at Google?', { first: { ...firstText(120, 'S6'), think: 2000 } }, { leaveAtMs: 100 })
  rows.push(['S6', 'cloudyjoe, visitor leaves at 100ms', ms(r.connected), ms(r.searching), ms(r.firstWords), ms(r.done), String(calls.length)])
  const late = calls.filter((c) => !c.abortedAt || c.abortedAt - r.leftAt > 250 * SCALE)
  check('S6: every model call in flight is cancelled within 250ms of the visitor leaving', calls.length >= 1 && late.length === 0,
    calls.map((c) => `${c.kind}:${c.abortedAt ? c.abortedAt - r.leftAt : 'never'}`).join(','))
  check('S6: the widget reports a stop, not an answer', r.outcome?.ok === false && r.outcome.reason === 'stopped')
}

// --- S9: words, then a decision to search -------------------------------------------
{
  const answer = answerScript(words(60, 'S9-ANSWER'))
  const r = await chatTurn('jts', "What's the Private AI Setup?", { first: firstTool('Private AI Setup', 'Let me look that up.'), answer })
  rows.push(['S9', 'jts, words then a search', ms(r.connected), ms(r.searching), ms(r.firstWords), ms(r.done), String(calls.length)])
  check('S9: the visitor ends with the answer only (the words before the search are cleared)', r.outcome?.ok === true && r.shown === answer.text)
  check('S9: "searching" is shown, and the search ran', r.searching >= 0 && toolResultText(ofKind('answer')[0]).includes(JTS_MARKER.slice(0, 20)))
}

// --- V1-V3: voice, the dead air between the caller's question and the answer ---------
const vrows: string[][] = []
// The voice budget is real time: stretch it with the world (LATENCY_SCALE),
// or keep the production defaults.
if (SCALE !== 1) Object.assign(process.env, { VOICE_SEARCH_BUDGET_MS: String(2500 * SCALE), VOICE_REASON_MIN_MS: String(1500 * SCALE) })
{
  const v1 = await voiceSearch('jts', 'private AI setup', {})
  vrows.push(['V1', 'jts, fast retrieval', ms(v1.total), v1.tier])
  check('V1: a fast search is answered by the reasoning model', v1.status === 200 && v1.tier === 'reasoned')
  check('V1: and says where its time went (Server-Timing)', /tier;desc=reasoned/.test(v1.serverTiming), v1.serverTiming)
  const reasonV1 = ofKind('reason')[0]
  check('V1: reasoning starts as soon as retrieval is done, and the answer goes back as soon as it is written',
    !!reasonV1?.endAt && reasonV1.startAt - lastServiceEndBefore(reasonV1.startAt) < PROMPTLY && v1.endAt - reasonV1.endAt < PROMPTLY,
    `reasoning ${reasonV1?.startAt - lastServiceEndBefore(reasonV1?.startAt ?? 0)}ms after retrieval, answer ${v1.endAt - (reasonV1?.endAt ?? 0)}ms after reasoning`)

  const v2 = await voiceSearch('cloudyjoe', 'Hermes', {})
  vrows.push(['V2', 'cloudyjoe', ms(v2.total), v2.tier])
  check('V2: cloudyjoe retrieval makes no model call (no LLM rerank), so the answer can be reasoned',
    ofKind('rerank').length === 0 && v2.tier === 'reasoned', `${calls.map((c) => c.kind).join(',')} tier=${v2.tier}`)

  const v3 = await voiceSearch('jts', 'private AI setup', { reason: { hdr: 30, think: 3000, tok: 15, text: 'REASONED-MARKER too slow' } })
  vrows.push(['V3', 'jts, reasoning slower than the budget', ms(v3.total), v3.tier])
  const reason = ofKind('reason')[0]
  check('V3: reasoning that outlasts the budget is cancelled, and the caller hears the excerpts',
    v3.tier === 'chunks' && v3.context.includes(JTS_MARKER.slice(0, 20)) && !!reason?.abortedAt, `tier=${v3.tier} aborted=${Boolean(reason?.abortedAt)}`)
  check('V3: ...inside the 2.5s budget (structure, generous margin)', v3.total < (2500 + 1000) * SCALE, `${v3.total}ms`)
}

if (process.env.LATENCY_REPORT) {
  console.log(`\nChat (ms from the click; LATENCY_SCALE=${SCALE})\n`)
  console.log('| scenario | turn | connected | searching | first words | done | model calls |')
  console.log('|---|---|---|---|---|---|---|')
  for (const r of rows) console.log(`| ${r.join(' | ')} |`)
  console.log('\nVoice search (ms from the request)\n')
  console.log('| scenario | search | answered in | tier |')
  console.log('|---|---|---|---|')
  for (const r of vrows) console.log(`| ${r.join(' | ')} |`)
}

console.error = report
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1) }
console.log('ok — first words stream from the first call, searches make no model call, a visitor who leaves stops every call, and voice answers inside its budget')
