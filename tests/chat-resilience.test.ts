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
// Also: lead capture now records the lead, then waits for the agent's reply
// before writing Joe's brief, so the brief includes the answer and never
// competes with it, and a wait cut short still leaves the lead on record.
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

type Plan = { decision: 'text' | 'tool' | 'fail'; decisionText?: string; sources?: boolean; recordFails?: 'refused' | 'down' | 'hang'; streams: Array<'typo' | 'ok' | 'empty' | 'fail' | { say: string }> }
let plan: Plan = { decision: 'tool', streams: ['ok'] }
const modelCalls: { at: number; body: any }[] = []
const emails: any[] = []
const leadWrites: { method: string; url: string; body: any }[] = []
const order: string[] = []

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
    order.push(body?.stream ? 'reply' : 'model')
    const isBrief = typeof body?.system === 'string' && body.system.includes('handoff brief')
    if (isBrief) return json({ id: 'b', type: 'message', role: 'assistant', model: 'stub', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Who: Pat\nNeed: a website\nTimeline: soon' }], usage: { input_tokens: 1, output_tokens: 1 } })
    if (!body?.stream) {
      if (plan.decision === 'fail') return json({ type: 'error', error: { type: 'invalid_request_error', message: 'stub decision failure' } }, 400)
      // The tool decision: either a plain answer (precomputed path) or a search call.
      if (plan.decision === 'text') return json({ id: 'd', type: 'message', role: 'assistant', model: 'stub', stop_reason: 'end_turn', content: [{ type: 'text', text: plan.decisionText || TYPO }], usage: { input_tokens: 1, output_tokens: 1 } })
      return json({ id: 'd', type: 'message', role: 'assistant', model: 'stub', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu', name: 'search_portfolio', input: { query: 'x' } }], usage: { input_tokens: 1, output_tokens: 1 } })
    }
    const next = plan.streams.shift() || 'ok'
    if (next === 'fail') return json({ type: 'error', error: { type: 'invalid_request_error', message: 'stub failure' } }, 400)
    if (next === 'empty') return sse(null, 'max_tokens')
    return sse(typeof next === 'object' ? next.say : next === 'typo' ? TYPO : 'Thanks — Joe will be in touch.')
  }
  if (u.startsWith('https://stub-cj.supabase.co/rest/v1/rpc/check_chat_rate_limit')) return json(true)
  if (u.startsWith('https://stub-cj.supabase.co/rest/v1/chat_leads')) {
    const method = init.method || 'GET'
    if (method === 'GET') return json([])
    if (method === 'POST' && plan.recordFails === 'refused') return json({ message: 'stub outage' }, 503)
    if (method === 'POST' && plan.recordFails === 'down') throw new Error('stub network down')
    // A stalled database: answers only by honouring the caller's abort.
    if (method === 'POST' && plan.recordFails === 'hang') return new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new Error('stub stalled, aborted'))))
    leadWrites.push({ method, url: u, body }); order.push(`lead ${method}`)
    return method === 'POST' ? json([{ id: 'lead-1' }], 201) : new Response(null, { status: 204 })
  }
  if (u.startsWith('https://stub-jts.supabase.co/rest/v1/rpc/search_site_chunks') && plan.sources) {
    return json([{ id: 1, source: 'page', title: 'Contact | Joe’s Tech Solutions', content: 'Email Joe or book a call.', url: 'https://www.joestechsolutions.com/contact', score: 0.8 }])
  }
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
  plan = p; modelCalls.length = 0; emails.length = 0; logged.length = 0; background.length = 0; leadWrites.length = 0; order.length = 0
  const t = Date.now()
  const res = await handler(new Request('https://cloudyjoe.com/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://www.joestechsolutions.com', 'cf-connecting-ip': '203.0.113.6' },
    body: JSON.stringify({ persona: 'jts', messages, lang: 'en', sessionId: `s-${Math.random()}`, currentPage: '/' }),
  }))
  const out = await res.text()
  await Promise.all(background)
  const ms = Date.now() - t
  // What the widget shows: stream deltas, with a replace event swapping the whole answer.
  let shown = ''
  for (const line of out.split('\n')) {
    if (!line.startsWith('data: ') || line.includes('[DONE]')) continue
    try { const d = JSON.parse(line.slice(6)); if (typeof d.text === 'string') shown = d.replace ? d.text : shown + d.text } catch { /* not JSON */ }
  }
  // SSE events in order, "[DONE]" included, for checks on where an event falls.
  const events = out.split('\n\n').filter(Boolean)
  return { out, shown, events, ms, status: res.status, streams: modelCalls.filter((c) => c.body?.stream) }
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
  const r = await chat(ask, { decision: 'tool', sources: true, streams: ['typo'] })
  const at = (re: RegExp) => r.events.findIndex((e) => re.test(e))
  const fix = at(/"replace":true/)
  check('the correction comes after the source badges (a replace renders with the sources received so far)',
    at(/^event: rag-sources/) >= 0 && fix > at(/^event: rag-sources/) && r.events[fix + 1] === 'data: [DONE]')
}
{
  const said = 'joe@joestechsolution.com'
  const r = await chat([{ role: 'user', content: `I’m Joe too — my email is ${said}. What’s yours?` }], { decision: 'tool', streams: [{ say: `Noted: ${said}. Joe is at ${JOE}.` }] })
  check('an address the visitor typed is theirs: never "corrected", however close', r.shown === `Noted: ${said}. Joe is at ${JOE}.` && !r.out.includes('"replace":true'))
  const earlier = await chat([
    { role: 'user', content: `Write to me at ${said}` }, { role: 'assistant', content: 'Will do.' }, { role: 'user', content: 'What address did I give you?' },
  ], { decision: 'tool', streams: [{ say: `You gave ${said}.` }] })
  check('...including one typed earlier in the conversation', earlier.shown === `You gave ${said}.`)
  // The echo most likely comes as a plain answer with no search (the precomputed
  // path), and the fallback must behave the same.
  const plain = await chat([{ role: 'user', content: `My email is ${said}` }], { decision: 'text', decisionText: `Thanks — I have ${said}.`, streams: [] })
  check('...on a plain answer with no search too', plain.shown === `Thanks — I have ${said}.` && !plain.out.includes(JOE))
  const viaFallback = await chat([{ role: 'user', content: `My email is ${said}` }], { decision: 'tool', streams: ['fail', 'fail', { say: `Thanks — I have ${said}.` }] })
  check('...and on the fallback reply', viaFallback.shown === `Thanks — I have ${said}.` && /streaming_fallback/.test(viaFallback.out) && !viaFallback.out.includes(JOE))
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
  const post = leadWrites.find((w) => w.method === 'POST')
  const patch = leadWrites.find((w) => w.method === 'PATCH')
  check('the lead is recorded before the wait (a cut-short wait still leaves it on record)',
    !!post && post.body.notified === false && order.indexOf('lead POST') < order.indexOf('reply'))
  check('...and updated afterwards with the notice and the agent’s answer',
    !!patch && /chat_leads\?id=eq\.lead-1/.test(patch.url) && patch.body.notified === true && patch.body.assistant_reply === 'Thanks — Joe will be in touch.')
}
{
  // The handler itself fails (here the tool decision): no reply will ever come,
  // so the brief must not sit out the whole wait for one.
  const r = await chat([{ role: 'user', content: 'We need a new website. My email is pat@example.com' }], { decision: 'fail', streams: [] })
  const L = await import('../functions/api-src/_shared/leads.js')
  check('a failed request releases the lead at once (no full reply wait)', r.status === 500 && r.ms < 3000 && L.REPLY_WAIT_MS > 3000)
  check('...and the lead is still recorded and Joe still told', leadWrites.some((w) => w.method === 'PATCH' && w.body.notified === true) && emails.some((e) => /^Lead from/.test(e?.subject || '')))
}
{
  const r = await chat([{ role: 'user', content: 'We need a new website. My email is pat@example.com' }], { decision: 'tool', recordFails: 'refused', streams: ['ok'] })
  check('a lead the database refuses still reaches Joe, and the failure is logged',
    r.shown === 'Thanks — Joe will be in touch.' && emails.some((e) => /^Lead from/.test(e?.subject || '')) && logged.some((l) => /\[lead\] record failed: HTTP 503/.test(l))
    && !leadWrites.some((w) => w.method === 'PATCH'))
  await chat([{ role: 'user', content: 'We need a new website. My email is pat@example.com' }], { decision: 'tool', recordFails: 'down', streams: ['ok'] })
  check('...and so does one the database cannot be reached for',
    emails.some((e) => /^Lead from/.test(e?.subject || '')) && logged.some((l) => /\[lead\] record failed: stub network down/.test(l)))
  const L = await import('../functions/api-src/_shared/leads.js')
  const stalled = await chat([{ role: 'user', content: 'We need a new website. My email is pat@example.com' }], { decision: 'tool', recordFails: 'hang', streams: ['ok'] })
  check('...and a stalled database costs seconds, not the notice',
    emails.some((e) => /^Lead from/.test(e?.subject || '')) && stalled.ms < L.LEADS_DB_TIMEOUT_MS + 3000 && L.LEADS_DB_TIMEOUT_MS <= 8000)
}
{
  const L = await import('../functions/api-src/_shared/leads.js')
  check('the wait for the reply ends well inside the ~30s a worker may run after its response', L.REPLY_WAIT_MS > 0 && L.REPLY_WAIT_MS <= 25_000)
}

console.error = realError
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1) }
console.log('ok — the contact address is right on every path and the visitor’s own is never touched; a failed reply gets a real retry; the lead is recorded, then the brief waits for the answer')
