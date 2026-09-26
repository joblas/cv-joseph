/* eslint-disable @typescript-eslint/no-explicit-any --
 * Drives the real /api/chat handler with globalThis.fetch replaced, and
 * inspects the raw model requests and the SSE the visitor receives.
 */
// Two defects a MatrAIx simulation against the live agent found (2026-09-26):
//
// 1. A reply gave Joe's address as "joe@joestsolutions.com". Every reply path —
//    the live stream, a precomputed reply, the fallback — now corrects a near
//    miss of the contact address, and the widget receives the corrected text.
// 2. One visitor's first reply failed outright ("Sorry, something went
//    wrong"): the stream, its retry 500ms later and the fallback all failed
//    within about a second. The retry now waits long enough to ride out a
//    short provider hiccup, retries an EMPTY reply with twice the budget, and
//    every failure is logged so the next one is diagnosable.
//
// Also: lead capture now waits for the agent's reply before writing Joe's
// brief, so the brief includes the answer and never competes with it.
for (const k of ['LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY', 'LANGFUSE_BASEURL', 'LANGFUSE_HOST', 'ANTHROPIC_AUTH_TOKEN', 'PROMPT_REGRESSION_SECRET',
  'GOOGLE_SA_EMAIL', 'GOOGLE_SA_PRIVATE_KEY', 'BOOKING_SECRET', 'CHAT_MAX_TOKENS']) delete process.env[k]
process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:9'
process.env.ANTHROPIC_API_KEY = 'stub-anthropic'
process.env.SUPABASE_URL = 'https://stub-cj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service'
process.env.JTS_SUPABASE_URL = 'https://stub-jts.supabase.co'
process.env.JTS_SUPABASE_ANON_KEY = 'stub-anon'
process.env.VOYAGE_API_KEY = 'stub-voyage'
process.env.RESEND_API_KEY = 're_test'
process.env.ALERT_EMAIL = 'owner@example.test'

let failed = 0
// Bound now: console.error is swapped below to capture the handler's logs, and
// a failing check must still reach stderr.
const report = console.error.bind(console)
function check(name: string, cond: boolean) {
  if (!cond) { report(`  ✗ ${name}`); failed++ }
}
const JOE = 'joe@joestechsolutions.com'
const TYPO = 'Email joe@joestsolutions.com and he replies within 24 hours.'

type Plan = { decision: 'text' | 'tool'; decisionText?: string; streams: Array<'typo' | 'ok' | 'empty' | 'fail'> }
let plan: Plan = { decision: 'tool', streams: ['ok'] }
const modelCalls: { at: number; body: any }[] = []
const emails: any[] = []

const ev = (type: string, data: any) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`
const sse = (text: string | null, stop = 'end_turn') => new Response(
  ev('message_start', { message: { id: 'm', type: 'message', role: 'assistant', model: 'stub', content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 0 } } })
  + (text === null ? '' : ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }) + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } }) + ev('content_block_stop', { index: 0 }))
  + ev('message_delta', { delta: { stop_reason: stop }, usage: { output_tokens: 5 } }) + ev('message_stop', {}),
  { headers: { 'content-type': 'text/event-stream' } })
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } })

;(globalThis as any).fetch = async (url: any, init: any = {}) => {
  const u = String(url instanceof Request ? url.url : url)
  const raw = init.body ?? (url instanceof Request ? await url.clone().text() : undefined)
  let body: any = raw
  try { body = JSON.parse(raw) } catch { /* not JSON */ }
  if (u.startsWith('http://127.0.0.1:9/v1/messages')) {
    modelCalls.push({ at: Date.now(), body })
    const isBrief = typeof body?.system === 'string' && body.system.includes('handoff brief')
    if (isBrief) return json({ id: 'b', type: 'message', role: 'assistant', model: 'stub', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Who: Pat\nNeed: a website\nTimeline: soon' }], usage: { input_tokens: 1, output_tokens: 1 } })
    if (!body?.stream) {
      // The tool decision: either a plain answer (precomputed path) or a search call.
      if (plan.decision === 'text') return json({ id: 'd', type: 'message', role: 'assistant', model: 'stub', stop_reason: 'end_turn', content: [{ type: 'text', text: plan.decisionText || TYPO }], usage: { input_tokens: 1, output_tokens: 1 } })
      return json({ id: 'd', type: 'message', role: 'assistant', model: 'stub', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu', name: 'search_portfolio', input: { query: 'x' } }], usage: { input_tokens: 1, output_tokens: 1 } })
    }
    const next = plan.streams.shift() || 'ok'
    if (next === 'fail') return json({ type: 'error', error: { type: 'invalid_request_error', message: 'stub failure' } }, 400)
    if (next === 'empty') return sse(null, 'max_tokens')
    return sse(next === 'typo' ? TYPO : 'Thanks — Joe will be in touch.')
  }
  if (u.startsWith('https://stub-cj.supabase.co/rest/v1/rpc/check_chat_rate_limit')) return json(true)
  if (u.startsWith('https://stub-cj.supabase.co/rest/v1/chat_leads')) return (init.method || 'GET') === 'GET' ? json([]) : new Response(null, { status: 201 })
  if (u.startsWith('https://stub-cj.supabase.co/') || u.startsWith('https://stub-jts.supabase.co/')) return json([])
  if (u.includes('voyageai.com')) return json({ data: [] })
  if (u === 'https://api.resend.com/emails') { emails.push(body); return json({ id: 'e' }) }
  throw new Error(`unexpected fetch ${u}`)
}

const background: Promise<unknown>[] = []
;(globalThis as any).__cfCtxStore = { getStore: () => ({ waitUntil: (p: Promise<unknown>) => { background.push(p) } }) }
const logged: string[] = []
const realError = console.error
console.error = (...a: unknown[]) => { logged.push(a.map(String).join(' ')) }

const { default: handler } = await import('../functions/api-src/chat.js')
async function chat(messages: any[], p: Plan) {
  plan = p; modelCalls.length = 0; emails.length = 0; logged.length = 0; background.length = 0
  const res = await handler(new Request('https://cloudyjoe.com/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://www.joestechsolutions.com', 'cf-connecting-ip': '203.0.113.6' },
    body: JSON.stringify({ persona: 'jts', messages, lang: 'en', sessionId: `s-${Math.random()}`, currentPage: '/' }),
  }))
  const out = await res.text()
  await Promise.all(background)
  // What the widget shows: stream deltas, with a replace event swapping the whole answer.
  let shown = ''
  for (const line of out.split('\n')) {
    if (!line.startsWith('data: ') || line.includes('[DONE]')) continue
    try { const d = JSON.parse(line.slice(6)); if (typeof d.text === 'string') shown = d.replace ? d.text : shown + d.text } catch { /* not JSON */ }
  }
  return { out, shown, streams: modelCalls.filter((c) => c.body?.stream) }
}
const ask = [{ role: 'user', content: 'How do I reach Joe?' }]

// --- 1. The contact address is corrected on every path ---------------------------
{
  const r = await chat(ask, { decision: 'tool', streams: ['typo'] })
  check('live stream: the visitor ends up seeing the right address', r.shown.includes(JOE) && !r.shown.includes('joestsolutions'))
}
{
  const r = await chat(ask, { decision: 'text', streams: [] })
  check('precomputed reply: the typo never reaches the visitor at all', r.shown.includes(JOE) && !r.out.includes('joestsolutions'))
}
{
  const r = await chat(ask, { decision: 'tool', streams: ['fail', 'fail', 'typo'] })
  check('fallback reply: corrected too', r.shown.includes(JOE) && !r.shown.includes('joestsolutions') && /streaming_fallback/.test(r.out))
}
{
  const r = await chat(ask, { decision: 'tool', streams: ['ok'] })
  check('a reply with no address is streamed untouched (no replace event)', r.shown === 'Thanks — Joe will be in touch.' && !r.out.includes('"replace":true'))
}

// --- 2. A failed reply gets a real second chance --------------------------------------
{
  const r = await chat(ask, { decision: 'tool', streams: ['fail', 'ok'] })
  const gap = r.streams[1].at - r.streams[0].at
  check('the retry waits long enough to ride out a short provider hiccup (≥1.4s)', r.streams.length === 2 && gap >= 1400)
  check('...and the visitor gets the reply, not the error', r.shown === 'Thanks — Joe will be in touch.')
  check('the failure is logged, with its reason', logged.some((l) => /\[chat\] reply stream attempt 1 failed: .*stub failure/.test(l)))
}
{
  const r = await chat(ask, { decision: 'tool', streams: ['empty', 'ok'] })
  check('an EMPTY reply (budget spent thinking) is retried with twice the budget',
    r.streams.length === 2 && r.streams[1].body.max_tokens === r.streams[0].body.max_tokens * 2 && r.shown === 'Thanks — Joe will be in touch.')
}
{
  const r = await chat(ask, { decision: 'tool', streams: ['fail', 'fail', 'ok'] })
  const gap = r.streams[2].at - r.streams[1].at
  check('the fallback waits too (≥0.9s after the retry fails), and is logged', gap >= 900 && logged.some((l) => /\[chat\] reply failed, running the fallback/.test(l)))
}

// --- 3. Joe's brief waits for the agent's answer -----------------------------------------
{
  const r = await chat([{ role: 'user', content: 'We need a new website. My email is pat@example.com' }], { decision: 'tool', streams: ['ok'] })
  const briefAt = modelCalls.findIndex((c) => typeof c.body?.system === 'string' && c.body.system.includes('handoff brief'))
  const streamAt = modelCalls.findIndex((c) => c.body?.stream)
  const mail = emails.find((e) => /^Lead from/.test(e?.subject || ''))
  check('the brief is written only after the reply (never alongside it)', briefAt > streamAt && streamAt >= 0)
  check('...and Joe’s transcript includes the agent’s answer to the lead message', !!mail && mail.text.includes('Agent: Thanks — Joe will be in touch.'))
  check('...ahead of the notice being sent at all', r.shown === 'Thanks — Joe will be in touch.')
}
{
  const L = await import('../functions/api-src/_shared/leads.js')
  check('the wait for the reply is bounded', L.REPLY_WAIT_MS > 0 && L.REPLY_WAIT_MS <= 60_000)
}

console.error = realError
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1) }
console.log('ok — the contact address is right on every path; a failed reply gets a real retry; the brief waits for the answer')
