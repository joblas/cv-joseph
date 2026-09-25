/* eslint-disable @typescript-eslint/no-explicit-any --
 * Drives the real /api/chat handler with globalThis.fetch replaced, and
 * inspects the raw model requests it sends.
 */
// How /api/chat wires the booking tools in (api/chat.js). The handler makes
// one non-streaming "tool decision" call, runs whatever tools the model asked
// for, then streams the reply. What this guards:
//
// - Booking tools are offered ONLY when booking is configured, and only to
//   the JTS persona. Unconfigured, the tool list is exactly what it was.
// - EVERY tool_use gets its own tool_result. The old code answered only the
//   first; with four tools the model may call two at once, and an unanswered
//   tool_use makes the follow-up request malformed.
// - The booking tool runs with the visitor's session from the request body.
// - If the streamed reply fails, the fallback retry keeps the booking result:
//   a call may already be on Joe's calendar, and a reply that doesn't know
//   would mislead the visitor.
// - Booking does not depend on site search being configured.
// - The voice agent (which has no booking tools) is told to hand booking to
//   the text chat — only when booking is live.
for (const k of ['LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY', 'LANGFUSE_BASEURL', 'LANGFUSE_HOST', 'BOOKING_HOURS', 'BOOKING_CALENDAR_ID', 'ANTHROPIC_AUTH_TOKEN', 'PROMPT_REGRESSION_SECRET']) delete process.env[k]
process.env.JTS_SUPABASE_URL = 'https://stub-jts.supabase.co'
process.env.JTS_SUPABASE_ANON_KEY = 'stub-anon'
process.env.SUPABASE_URL = 'https://stub-cj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service'
process.env.VOYAGE_API_KEY = 'stub-voyage'
process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:9'
process.env.ANTHROPIC_API_KEY = 'stub-anthropic'

const pair = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true, ['sign', 'verify'],
)
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
const BOOKING_ENV: Record<string, string> = {
  GOOGLE_SA_EMAIL: 'booking@jts-test.iam.gserviceaccount.com',
  GOOGLE_SA_PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...pkcs8))}\n-----END PRIVATE KEY-----\n`,
  BOOKING_SECRET: 'test-booking-secret',
  RESEND_API_KEY: 're_test',
}
const bookingOn = (on: boolean) => {
  for (const [k, v] of Object.entries(BOOKING_ENV)) { if (on) process.env[k] = v; else delete process.env[k] }
}

let failed = 0
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`  ✗ ${name}`); failed++ }
}

const SITE_MARKER = 'The seventy-five minute session installs private AI'
const STREAMED = 'Here are the times I can offer.'
const siteRows = () => Array.from({ length: 6 }, (_, i) => ({
  id: `r${i}`, source: 'page', url: 'https://www.joestechsolutions.com/private-ai-setup',
  title: `Private AI Setup ${i}`, content: `${SITE_MARKER}. Detail ${i}.`, priority: 1, score: 0.9 - i * 0.01,
}))

// What the tool-decision call returns this case, and how many streamed calls fail.
const mode = { decision: [] as any[], streamFailures: 0 }
const modelCalls: any[] = []
const geminiTokenBodies: any[] = []
const rpcs: { fn: string; body: any }[] = []

const sse = (text: string) => {
  const ev = (type: string, data: any) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`
  return ev('message_start', { message: { id: 'msg_s', type: 'message', role: 'assistant', model: 'stub', content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 0 } } })
    + ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
    + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } })
    + ev('content_block_stop', { index: 0 })
    + ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } })
    + ev('message_stop', {})
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } })

;(globalThis as any).fetch = async (url: any, init: any = {}) => {
  const u = String(url instanceof Request ? url.url : url)
  const raw = init.body ?? (url instanceof Request ? await url.clone().text() : undefined)
  let body: any = raw
  try { body = JSON.parse(raw) } catch { /* not JSON */ }
  if (u.startsWith('http://127.0.0.1:9/v1/messages')) {
    modelCalls.push(body)
    if (!body.stream) {
      // The tool decision, or any other non-streaming call (reranking etc.).
      if (body.tools) {
        return json({ id: 'msg_d', type: 'message', role: 'assistant', model: 'stub',
          stop_reason: mode.decision.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
          content: mode.decision, usage: { input_tokens: 1, output_tokens: 1 } })
      }
      return json({ type: 'error', error: { type: 'invalid_request_error', message: 'stub' } }, 400)
    }
    if (mode.streamFailures > 0) {
      mode.streamFailures--
      return json({ type: 'error', error: { type: 'invalid_request_error', message: 'stream stub failure' } }, 400)
    }
    return new Response(sse(STREAMED), { headers: { 'content-type': 'text/event-stream' } })
  }
  if (u === 'https://generativelanguage.googleapis.com/v1beta/auth_tokens') {
    geminiTokenBodies.push(body)
    return json({ name: 'auth_tokens/stub' })
  }
  if (u.startsWith('https://stub-cj.supabase.co/rest/v1/voice_rate_limits')) return json([])
  if (u === 'https://oauth2.googleapis.com/token') return json({ access_token: 'tok', expires_in: 3600 })
  if (u === 'https://www.googleapis.com/calendar/v3/freeBusy') return json({ calendars: { 'joe@joestechsolutions.com': { busy: [] } } })
  if (u.includes('voyageai.com/v1/embeddings')) return json({ data: [{ embedding: Array(1024).fill(0.01) }], usage: { total_tokens: 6 } })
  if (u.includes('voyageai.com/v1/rerank')) return json({ data: [0, 1, 2, 3, 4, 5].map((index, r) => ({ index, relevance_score: 0.9 - r * 0.1 })) })
  if (u.startsWith('https://stub-jts.supabase.co/rest/v1/rpc/')) return json(siteRows())
  if (u.startsWith('https://stub-cj.supabase.co/rest/v1/rpc/')) {
    const fn = u.split('/rpc/')[1]
    rpcs.push({ fn, body })
    if (fn === 'check_chat_rate_limit') return json(true)
    if (fn === 'booking_issue_code') return json('ok')
    return json([])
  }
  if (u.startsWith('https://stub-cj.supabase.co/rest/v1/')) return json([])
  if (u === 'https://api.resend.com/emails') return json({ id: 'em_1' })
  throw new Error(`unexpected fetch ${u}`)
}

const { default: handler } = await import('../functions/api-src/chat.js')
const SESSION = 'sess-chat-booking-1'
async function chat(text: string, persona = 'jts', origin = 'https://www.joestechsolutions.com') {
  modelCalls.length = 0; rpcs.length = 0
  const res = await handler(new Request('https://cloudyjoe.com/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'cf-connecting-ip': '203.0.113.7' },
    body: JSON.stringify({ persona, messages: [{ role: 'user', content: text }], lang: 'en', sessionId: SESSION, currentPage: '/' }),
  }))
  const out = await res.text()
  const decision = modelCalls.find((c) => !c.stream && c.tools)
  const streams = modelCalls.filter((c) => c.stream)
  const system = (decision?.system || streams[0]?.system || []).map((b: any) => b.text).join('\n')
  return { res, out, decision, streams, system }
}
const toolNames = (d: any) => (d?.tools || []).map((t: any) => t.name)
const toolResults = (msgs: any[] = []) => {
  const last = msgs[msgs.length - 1]
  return Array.isArray(last?.content) ? last.content.filter((b: any) => b.type === 'tool_result') : []
}

// --- 1. Unconfigured: exactly the old tool list ------------------------------
{
  bookingOn(false)
  mode.decision = [{ type: 'text', text: 'Hi there.' }]
  const r = await chat('can I book a call with Joe?')
  check('booking unconfigured: the only tool is search_portfolio', JSON.stringify(toolNames(r.decision)) === '["search_portfolio"]')
  check('booking unconfigured: the agent is told plainly it cannot book', /booking a call through this chat is not available/.test(r.system))
}

// --- 2. Configured: booking tools, and a single booking call ------------------
bookingOn(true)
{
  mode.decision = [{ type: 'tool_use', id: 'tu_avail', name: 'check_availability', input: {} }]
  const r = await chat('can I book a call with Joe?')
  check('configured: search plus the three booking tools are offered',
    JSON.stringify(toolNames(r.decision)) === '["search_portfolio","check_availability","send_verification_code","book_call"]')
  check('configured: the agent is told how booking works, with today’s date', /Calls: you can book a free 30-minute video call/.test(r.system) && /Today is \w+day, /.test(r.system))
  const results = toolResults(r.streams[0]?.messages)
  check('the availability result is answered to its own tool_use', results.length === 1 && results[0].tool_use_id === 'tu_avail')
  check('...carrying real open times', /\d{1,2}:\d{2} [AP]M PT/.test(String(results[0]?.content)))
  check('the streamed reply reaches the visitor', r.res.status === 200 && r.out.includes(STREAMED))
}

// --- 3. Two tools at once: both answered ---------------------------------------
{
  mode.decision = [
    { type: 'tool_use', id: 'tu_search', name: 'search_portfolio', input: { query: 'private ai setup' } },
    { type: 'tool_use', id: 'tu_avail', name: 'check_availability', input: {} },
  ]
  const r = await chat('what is the private AI setup, and when can I talk to Joe?')
  const results = toolResults(r.streams[0]?.messages)
  const byId = Object.fromEntries(results.map((b: any) => [b.tool_use_id, String(b.content)]))
  check('two tool_use blocks get two tool_results, matched by id', results.length === 2 && 'tu_search' in byId && 'tu_avail' in byId)
  check('...the search one carries the site’s content', (byId.tu_search || '').includes(SITE_MARKER))
  check('...the availability one carries open times', /\d{1,2}:\d{2} [AP]M PT/.test(byId.tu_avail || ''))
}
{
  mode.decision = [
    { type: 'tool_use', id: 'tu_a', name: 'search_portfolio', input: { query: 'a' } },
    { type: 'tool_use', id: 'tu_b', name: 'search_portfolio', input: { query: 'b' } },
    { type: 'tool_use', id: 'tu_c', name: 'make_coffee', input: {} },
  ]
  const r = await chat('search twice')
  const results = toolResults(r.streams[0]?.messages)
  check('a second search and an unknown tool are still answered (never left dangling)',
    results.length === 3 && results.map((b: any) => b.tool_use_id).join() === 'tu_a,tu_b,tu_c')
}

// --- 4. The booking tool gets the visitor's session ------------------------------
{
  mode.decision = [{ type: 'tool_use', id: 'tu_code', name: 'send_verification_code', input: { email: 'sam@example.com' } }]
  await chat('Monday 6:30pm works, I am Sam, sam@example.com')
  const issue = rpcs.find((r) => r.fn === 'booking_issue_code')?.body
  check('the code is scoped to the session from the request body', issue?.p_session === SESSION && issue?.p_email === 'sam@example.com')
}

// --- 5. The fallback retry keeps a booking result ----------------------------------
{
  mode.decision = [{ type: 'tool_use', id: 'tu_avail', name: 'check_availability', input: {} }]
  // The primary stream and its one retry fail; the fallback then succeeds.
  mode.streamFailures = 2
  const r = await chat('when can I talk to Joe?')
  const fallback = r.streams[r.streams.length - 1]
  check('the fallback ran (primary stream failed twice)', r.streams.length === 3 && /streaming_fallback/.test(r.out))
  check('...and it still carries the booking tool_result', toolResults(fallback?.messages).some((b: any) => b.tool_use_id === 'tu_avail'))
  check('...so the visitor gets a reply that knows the booking state', r.out.includes(STREAMED))
}
{
  mode.decision = [{ type: 'tool_use', id: 'tu_search', name: 'search_portfolio', input: { query: 'private ai' } }]
  mode.streamFailures = 2
  const r = await chat('what is the private AI setup?')
  const fallback = r.streams[r.streams.length - 1]
  check('a search-only fallback still retries WITHOUT retrieval (unchanged behaviour)', r.streams.length === 3 && toolResults(fallback?.messages).length === 0)
}

// --- 6. cloudyjoe never gets booking ------------------------------------------------
{
  mode.decision = [{ type: 'text', text: 'Hello.' }]
  const r = await chat('can I book a call?', 'cloudyjoe', 'https://cloudyjoe.com')
  check('cloudyjoe: no booking tools, no booking notes', !toolNames(r.decision).some((n: string) => n !== 'search_portfolio') && !/Calls:/.test(r.system))
}

// --- 7. Booking without site search --------------------------------------------------
{
  const saved = process.env.JTS_SUPABASE_URL
  delete process.env.JTS_SUPABASE_URL
  mode.decision = [{ type: 'tool_use', id: 'tu_avail', name: 'check_availability', input: {} }]
  const r = await chat('can I book a call?')
  process.env.JTS_SUPABASE_URL = saved
  check('with site search unconfigured, booking still works (its tools alone are offered)',
    JSON.stringify(toolNames(r.decision)) === '["check_availability","send_verification_code","book_call"]'
    && toolResults(r.streams[0]?.messages)[0]?.tool_use_id === 'tu_avail')
}

// --- 8. The voice agent is told where booking lives ------------------------------------
{
  process.env.GEMINI_API_KEY = 'stub-gemini'
  delete process.env.VOICE_PROVIDER
  const { default: voiceToken } = await import('../functions/api-src/voice-token.js')
  const mint = async () => {
    geminiTokenBodies.length = 0
    const res = await voiceToken(new Request('https://cloudyjoe.com/api/voice-token', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://www.joestechsolutions.com', 'x-forwarded-for': '203.0.113.8' },
      body: JSON.stringify({ lang: 'en', sessionId: SESSION, persona: 'jts' }),
    }))
    const instruction = geminiTokenBodies[0]?.bidiGenerateContentSetup?.systemInstruction?.parts?.[0]?.text || ''
    return { status: res.status, instruction }
  }
  bookingOn(true)
  const on = await mint()
  check('voice, booking live: the system instruction sends callers to the text chat to book',
    on.status === 200 && /## Booking a call/.test(on.instruction) && /type in this same chat/.test(on.instruction))
  bookingOn(false)
  const off = await mint()
  check('voice, booking off: no booking note (so it never promises one)', off.status === 200 && off.instruction.length > 500 && !/Booking a call/.test(off.instruction))
  bookingOn(true)
}

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1) }
console.log('ok — booking tools only when configured; every tool call answered; the booking result survives the fallback')
