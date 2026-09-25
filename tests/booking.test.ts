/* eslint-disable @typescript-eslint/no-explicit-any --
 * Replaces globalThis.fetch and inspects the raw requests the booking tools
 * send to Google, Supabase and Resend.
 */
// The booking concierge's three tools (api/_shared/booking.js), end to end
// against a stubbed network. What each check protects:
//
// - A booking happens ONLY for a time that is open right now, an email this
//   session proved it owns, and a code that matches. Every refusal path
//   asserts the later steps never ran (no code consumed, no row, no event).
// - Every result is honest: a failure says nothing was booked and offers
//   email; nothing but Google's invite ever carries a link.
// - chat.js allows ONE tool call per message, so no result may depend on a
//   second one: a time that isn't open comes back WITH the current times.
// - The widget only resends visible text, so book_call must resolve the time
//   the model wrote to the visitor ("Mon, Sep 28, 6:30 PM PT").
//
// All instants are worked out by hand: Pacific Daylight Time is UTC-7 until
// Nov 1 2026. "Now" is Fri Sep 25 2026 12:00 PDT = 19:00Z.

// A real RSA key, so the Google client signs a real JWT.
const pair = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true, ['sign', 'verify'],
)
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
const PEM = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...pkcs8)).match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`

const ENV: Record<string, string> = {
  GOOGLE_SA_EMAIL: 'booking@jts-test.iam.gserviceaccount.com',
  GOOGLE_SA_PRIVATE_KEY: PEM,
  BOOKING_SECRET: 'test-booking-secret',
  RESEND_API_KEY: 're_test',
  SUPABASE_URL: 'https://stub-cj.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'stub-service',
  ALERT_EMAIL: 'owner@example.test',
}
const setEnv = () => { Object.assign(process.env, ENV); delete process.env.BOOKING_HOURS; delete process.env.BOOKING_CALENDAR_ID }
setEnv()

let failed = 0
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`  ✗ ${name}`); failed++ }
}

const NOW = Date.parse('2026-09-25T19:00:00Z') // Fri Sep 25 2026, 12:00 PDT
const SESSION = '1790362800000-abc1234'
const req = new Request('https://cloudyjoe.com/api/chat', { method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.9' } })

// The Pages shim hands waitUntil work to the request context; give it one so
// the owner's notice is captured (and can be awaited) instead of dropped.
const background: Promise<unknown>[] = []
;(globalThis as any).__cfCtxStore = { getStore: () => ({ waitUntil: (p: Promise<unknown>) => { background.push(p) } }) }
const flush = async () => { await Promise.all(background.splice(0)) }

// --- the stubbed network ------------------------------------------------------
type Call = { url: string; method: string; body: any; hasSignal: boolean }
const calls: Call[] = []
const BOOKING_ID = '11111111-2222-3333-4444-555555555555'
const EVENT_ID = '11111111222233334444555555555555' // the booking id's hex digits
type Insert = 'ok' | 'refused' | '5xx' | 'abort' | '409' | 'garbage'
type Get = 'exists' | 'missing' | 'cancelled' | 'error'
const mode = {
  busy: [] as { start: string; end: string }[],
  freeBusy: 'ok' as 'ok' | 'http' | 'calendar-error',
  issue: 'ok' as string, check: 'ok' as string, reserve: `ok:${BOOKING_ID}` as string,
  rpcStatus: 200, rpcHang: false, insert: 'ok' as Insert, resend: 200,
  get: 'missing' as Get, getTimes: { start: '2026-09-29T01:30:00Z', end: '2026-09-29T02:00:00Z' },
  candidates: [] as any[], candidatesFail: false,
  ownerHold: null as null | Promise<void>,
}
const resetMode = () => {
  Object.assign(mode, {
    busy: [], freeBusy: 'ok', issue: 'ok', check: 'ok', reserve: `ok:${BOOKING_ID}`,
    rpcStatus: 200, rpcHang: false, insert: 'ok', resend: 200,
    get: 'missing', getTimes: { start: '2026-09-29T01:30:00Z', end: '2026-09-29T02:00:00Z' },
    candidates: [], candidatesFail: false, ownerHold: null,
  })
  calls.length = 0
  background.length = 0
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } })
;(globalThis as any).fetch = async (url: string, init: any = {}) => {
  const u = String(url)
  let body: any = init.body
  try { body = JSON.parse(init.body) } catch { /* form-encoded token request */ }
  calls.push({ url: u, method: init.method || 'GET', body, hasSignal: init.signal instanceof AbortSignal })
  if (u === 'https://oauth2.googleapis.com/token') return json({ access_token: 'tok', expires_in: 3600 })
  if (u === 'https://www.googleapis.com/calendar/v3/freeBusy') {
    if (mode.freeBusy === 'http') return json({ error: { code: 403 } }, 403)
    const id = 'joe@joestechsolutions.com'
    return json({ calendars: { [id]: mode.freeBusy === 'calendar-error' ? { errors: [{ reason: 'notFound' }], busy: [] } : { busy: mode.busy } } })
  }
  if (u.startsWith('https://www.googleapis.com/calendar/v3/calendars/') && init.method === 'POST') {
    if (mode.insert === 'abort') { const e: any = new Error('aborted'); e.name = 'AbortError'; throw e }
    if (mode.insert === 'refused') return json({ error: { code: 400 } }, 400)
    if (mode.insert === '5xx') return json({ error: { code: 503 } }, 503)
    if (mode.insert === '409') return json({ error: { code: 409 } }, 409)
    if (mode.insert === 'garbage') return new Response('<html>oops', { status: 200 })
    return json({ id: body?.id, htmlLink: 'https://calendar.google.com/event?eid=x', hangoutLink: 'https://meet.google.com/abc-defg-hij' })
  }
  if (u.startsWith('https://www.googleapis.com/calendar/v3/calendars/')) {
    if (mode.get === 'error') return json({ error: { code: 500 } }, 500)
    if (mode.get === 'missing') return json({ error: { code: 404 } }, 404)
    return json({ id: u.split('/events/')[1], status: mode.get === 'cancelled' ? 'cancelled' : 'confirmed',
      start: { dateTime: mode.getTimes.start }, end: { dateTime: mode.getTimes.end } })
  }
  if (u.startsWith('https://stub-cj.supabase.co/rest/v1/rpc/')) {
    if (mode.rpcHang) {
      return new Promise((_, reject) => init.signal?.addEventListener('abort', () => {
        const e: any = new Error('aborted'); e.name = 'AbortError'; reject(e)
      }))
    }
    if (mode.rpcStatus !== 200) return json({ message: 'db down' }, mode.rpcStatus)
    const fn = u.split('/rpc/')[1]
    if (fn === 'booking_candidates' && mode.candidatesFail) return json({ message: 'db down' }, 500)
    return json({ booking_issue_code: mode.issue, booking_check_code: mode.check, booking_reserve: mode.reserve,
      booking_finalize: 'ok', booking_candidates: mode.candidates, booking_sync: 'ok' }[fn])
  }
  if (u === 'https://api.resend.com/emails') {
    if (mode.ownerHold && JSON.stringify(body?.to) === '["owner@example.test"]') await mode.ownerHold
    return json(mode.resend === 200 ? { id: 'em_1' } : { message: 'nope' }, mode.resend)
  }
  throw new Error(`unexpected fetch ${u}`)
}
const rpcCalls = (fn: string) => calls.filter((c) => c.url.endsWith(`/rpc/${fn}`))
const emails = () => calls.filter((c) => c.url === 'https://api.resend.com/emails')
const inserts = () => calls.filter((c) => c.method === 'POST' && c.url.startsWith('https://www.googleapis.com/calendar/v3/calendars/'))
const gets = () => calls.filter((c) => c.method === 'GET' && c.url.startsWith('https://www.googleapis.com/calendar/v3/calendars/'))
const ownerMail = () => emails().find((e) => JSON.stringify(e.body.to) === '["owner@example.test"]')?.body

// An HMAC computed HERE, not by the module, so a wrong hash can't agree with itself.
async function hmac(message: string) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(ENV.BOOKING_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const B = await import('../functions/api-src/_shared/booking.js')
const { getPersona } = await import('../functions/api-src/_shared/personas.js')
const jts = getPersona('jts')
const cj = getPersona('cloudyjoe')
const run = (name: string, input: any, opts: any = {}) =>
  B.runBookingTool(name, input, { sessionId: SESSION, req, persona: jts, now: NOW, ...opts })
const TIME_RE = /\d{1,2}:\d{2} [AP]M PT/

// --- 1. Off unless fully configured -------------------------------------------
check('JTS is configured for booking once every secret is set', B.bookingConfigured(jts) === true)
check('cloudyjoe never books (no booking config on the persona)', B.bookingConfigured(cj) === false && B.bookingTools(cj).length === 0)
for (const k of Object.keys(ENV).filter((k) => k !== 'ALERT_EMAIL')) {
  const saved = process.env[k]; delete process.env[k]
  check(`booking is OFF without ${k}`, B.bookingConfigured(jts) === false && B.bookingTools(jts).length === 0)
  process.env[k] = saved
}
process.env.BOOKING_HOURS = '{not json'
check('a broken BOOKING_HOURS switches booking OFF rather than guessing', B.bookingConfigured(jts) === false)
setEnv()
{
  resetMode(); delete process.env.BOOKING_SECRET
  const out = await run('check_availability', {})
  check('unconfigured: the tool refuses honestly and touches no network', calls.length === 0 && /isn't available/.test(out) && out.includes('joe@joestechsolutions.com'))
  check('unconfigured: the JTS agent is told plainly booking is not available', /booking a call through this chat is not available/.test(B.bookingContext(jts, NOW)) && !/Today is/.test(B.bookingContext(jts, NOW)))
  check('unconfigured: the voice agent is told nothing about booking', B.bookingVoiceNote(jts) === '')
  setEnv()
}
check('cloudyjoe’s runtime notes say nothing about calls', B.bookingContext(cj, NOW) === '' && B.bookingVoiceNote(cj) === '')
check('configured: the three tools, by name', JSON.stringify(B.bookingTools(jts).map((t: any) => t.name)) === JSON.stringify(['check_availability', 'send_verification_code', 'book_call']))
check('configured: the agent knows today’s date in Pacific time', B.bookingContext(jts, NOW).includes('Today is Friday, September 25, 2026, Pacific time.'))
check('configured: the agent may claim a booking only after book_call confirms it', /only after book_call says "Booked"/.test(B.bookingContext(jts, NOW)))
check('configured: the voice agent hands booking to the text chat', /type in this same chat/.test(B.bookingVoiceNote(jts)))
{
  resetMode()
  const out1 = await run('check_availability', {}, { sessionId: undefined })
  const out2 = await run('check_availability', {}, { sessionId: 'x'.repeat(101) })
  check('no session, or an absurd one: refused before any network call', calls.length === 0 && !TIME_RE.test(out1) && !TIME_RE.test(out2))
}

// --- 2. check_availability ------------------------------------------------------
{
  resetMode()
  mode.busy = [{ start: '2026-09-29T01:00:00Z', end: '2026-09-29T01:30:00Z' }] // Mon Sep 28 18:00-18:30 PDT
  const out = await run('check_availability', {})
  const times = out.split('\n').filter((l: string) => l.startsWith('- ')).map((l: string) => l.slice(2))
  check('offers real open times as labels', times.length >= 3 && times.every((t: string) => TIME_RE.test(t)))
  check('the first offer is the first open slot: Sat Sep 26 12:00 PM (24h notice from Fri noon)', times[0] === 'Sat, Sep 26, 12:00 PM PT')
  check('nothing inside the 24 hours’ notice', !times.includes('Sat, Sep 26, 10:00 AM PT') && !times.includes('Sat, Sep 26, 11:30 AM PT'))
  check('a busy slot is never offered', !times.includes('Mon, Sep 28, 6:00 PM PT'))
  check('offers are spread across at least three days, not bunched on one', new Set(times.map((t: string) => t.split(',').slice(0, 2).join(','))).size >= 3)
  check('the result tells the model what to ask next, not to call another tool', /ask which works, plus their name and email/.test(out) && !/call send_verification_code/i.test(out))
  const fb = calls.find((c) => c.url.endsWith('/freeBusy'))
  check('free/busy is read from now to beyond the 14-day horizon', fb?.body.timeMin === '2026-09-25T19:00:00.000Z' && Date.parse(fb?.body.timeMax) >= NOW + 14 * 86400_000)
}
for (const m of ['http', 'calendar-error'] as const) {
  resetMode(); mode.freeBusy = m
  const out = await run('check_availability', {})
  check(`a calendar that can't be read (${m}) offers NO times and offers email`, !TIME_RE.test(out) && /Do NOT offer/.test(out) && out.includes('joe@joestechsolutions.com'))
}
{
  resetMode()
  // Busy for the whole horizon.
  mode.busy = [{ start: '2026-09-25T00:00:00Z', end: '2026-10-20T00:00:00Z' }]
  const out = await run('check_availability', {})
  check('a full calendar says so and offers email', !TIME_RE.test(out) && /no open call times/.test(out) && out.includes('joe@joestechsolutions.com'))
}

// --- 3. send_verification_code --------------------------------------------------
{
  resetMode()
  const out = await run('send_verification_code', { email: '  Visitor@Example.COM ' })
  const issue = rpcCalls('booking_issue_code')[0]?.body
  const mail = emails()[0]?.body
  const code = /\b(\d{6})\b/.exec(mail?.text || '')?.[1] || ''
  check('one code issued, one email sent', rpcCalls('booking_issue_code').length === 1 && emails().length === 1)
  check('the email goes to the normalised address', JSON.stringify(mail?.to) === '["visitor@example.com"]' && issue?.p_email === 'visitor@example.com')
  check('the code is 6 digits and the subject carries the same one', /^\d{6}$/.test(code) && mail?.subject.includes(code))
  check('the database gets HMAC(secret, session|email|code), never the code',
    issue?.p_code_hash === await hmac(`${SESSION}|visitor@example.com|${code}`) && !JSON.stringify(issue).includes(code))
  check('the rate limiter sees the visitor’s IP and session', issue?.p_ip === '203.0.113.9' && issue?.p_session === SESSION)
  check('sent from the booking address, replies go to Joe', mail?.from === jts.booking.from && mail?.reply_to === 'joe@joestechsolutions.com')
  check('the result tells the visitor to check their inbox', /check their inbox and type the code/.test(out))
}
{
  resetMode()
  const out = await run('send_verification_code', { email: 'visitor@' })
  check('an incomplete email: nothing issued, nothing sent', calls.length === 0 && /incomplete/.test(out))
}
{
  resetMode(); mode.issue = 'rate_limited_email'
  const out = await run('send_verification_code', { email: 'visitor@example.com' })
  check('rate limited: NO email goes out, and the visitor is told', emails().length === 0 && /no code was sent/.test(out) && out.includes('joe@joestechsolutions.com'))
}
{
  resetMode(); mode.issue = 'rate_limited_global'
  const out = await run('send_verification_code', { email: 'visitor@example.com' })
  check('the global daily cap says so — not "in the last hour"', /as many codes as it allows today/.test(out) && !/last hour/.test(out) && emails().length === 0)
}
{
  resetMode(); mode.resend = 500
  const out = await run('send_verification_code', { email: 'visitor@example.com' })
  check('the email provider failing is reported, not hidden', /didn't go out/.test(out))
}
{
  resetMode(); mode.rpcStatus = 500
  const out = await run('send_verification_code', { email: 'visitor@example.com' })
  check('the database failing: no email, an honest failure', emails().length === 0 && /couldn't be completed/.test(out) && out.includes('joe@joestechsolutions.com'))
}

// --- 4. book_call: the happy path -----------------------------------------------
{
  resetMode()
  const out = await run('book_call', { slot: 'Mon, Sep 28, 6:30 PM PT', email: 'Visitor@Example.com', code: '123 456', name: 'Sam', topic: 'automating invoices' })
  const chk = rpcCalls('booking_check_code')[0]?.body
  const res = rpcCalls('booking_reserve')[0]?.body
  const ins = inserts()[0]
  const fin = rpcCalls('booking_finalize')[0]?.body
  check('the code is checked as HMAC(session|email|digits) — "123 456" counts as 123456',
    chk?.p_code_hash === await hmac(`${SESSION}|visitor@example.com|123456`))
  check('the reservation is exactly Mon Sep 28 18:30-19:00 PDT',
    res?.p_start === '2026-09-29T01:30:00.000Z' && res?.p_end === '2026-09-29T02:00:00.000Z' && res?.p_email === 'visitor@example.com')
  check('the Google event invites the visitor, with a Meet request keyed to the booking id',
    ins?.body.attendees?.[0]?.email === 'visitor@example.com'
    && ins?.body.conferenceData?.createRequest?.requestId === '11111111-2222-3333-4444-555555555555'
    && ins?.body.start?.dateTime === '2026-09-29T01:30:00.000Z')
  check('Google sends the invite (sendUpdates=all)', /sendUpdates=all/.test(ins?.url || ''))
  check('the event id is derived from the booking id (so its outcome is always checkable)', ins?.body.id === EVENT_ID && /^[0-9a-v]{5,1024}$/.test(ins?.body.id))
  check('the booking is finalised with the event id', fin?.p_id === BOOKING_ID && fin?.p_event_id === EVENT_ID && fin?.p_status === 'confirmed')
  await flush()
  const owner = ownerMail()
  check('Joe is told, and can reply straight to the visitor', !!owner && owner.reply_to === 'visitor@example.com' && owner.subject.includes('Mon, Sep 28, 6:30 PM PT'))
  check('rows whose truth is in Google are reconciled BEFORE reserving',
    calls.findIndex((c) => c.url.endsWith('/rpc/booking_candidates')) > calls.findIndex((c) => c.url.endsWith('/rpc/booking_check_code'))
    && calls.findIndex((c) => c.url.endsWith('/rpc/booking_candidates')) < calls.findIndex((c) => c.url.endsWith('/rpc/booking_reserve')))
  check('the result confirms the booking with its time', out.startsWith('Booked: Mon, Sep 28, 6:30 PM PT'))
  check('the result carries no link — only Google’s invite may', !/https?:\/\//.test(out))
}
{
  resetMode()
  await run('book_call', { slot: 'Mon, Sep 28, 6:30 PM PT', email: 'visitor@example.com', code: 12345 })
  check('a code relayed as a NUMBER keeps its leading zero (12345 -> 012345)',
    rpcCalls('booking_check_code')[0]?.body.p_code_hash === await hmac(`${SESSION}|visitor@example.com|012345`))
}
for (const [said, label] of [
  ['September 28 at 6:30pm', 'a looser spelling'],
  ['sep 28, 6:30 p.m.', 'lower case with dots'],
  ['2026-09-28 18:30', 'a wall-clock key'],
  ['2026-09-29T01:30:00Z', 'an ISO instant'],
] as const) {
  resetMode()
  await run('book_call', { slot: said, email: 'visitor@example.com', code: '123456' })
  check(`the time resolves from ${label} ("${said}")`, rpcCalls('booking_reserve')[0]?.body.p_start === '2026-09-29T01:30:00.000Z')
}

// --- 5. book_call: every refusal stops before the next step ----------------------
for (const [slot, why] of [
  ['Mon, Sep 28, 6:00 PM PT', 'a busy slot'],
  ['Mon, Sep 28, 10:00 AM PT', 'weekday daytime, outside Joe’s windows'],
  ['Mon, Sep 28, 6:30 AM PT', 'AM where only PM is open'],
  ['Sat, Sep 26, 10:00 AM PT', 'inside the 24 hours’ notice'],
  ['Oct 28, 6:30 PM', 'beyond the horizon'],
  ['Sep 28 13:30 PM', 'an impossible hour'],
  ['tomorrow evening', 'no time at all'],
  // The exact formats skip the free-text parser, so they need their own
  // refusals: an exact time must still be an OPEN one.
  ['2026-09-28 10:00', 'a wall-clock key outside Joe’s windows'],
  ['2026-09-28T17:00:00Z', 'an ISO instant outside Joe’s windows (10:00 PDT)'],
  ['2026-09-28 18:00', 'a wall-clock key for a busy slot'],
] as const) {
  resetMode()
  mode.busy = [{ start: '2026-09-29T01:00:00Z', end: '2026-09-29T01:30:00Z' }]
  const out = await run('book_call', { slot, email: 'visitor@example.com', code: '123456' })
  check(`${why} is refused before the code is even checked`, rpcCalls('booking_check_code').length === 0 && rpcCalls('booking_reserve').length === 0 && inserts().length === 0)
  check(`${why}: the refusal carries the current times, so this same reply can re-offer`, /nothing was booked/.test(out) && TIME_RE.test(out) && !out.includes(`- ${slot}`))
}
{
  resetMode()
  await run('book_call', { slot: 'Tue, Sep 29, 6:30 PM PT', email: 'visitor@example.com', code: '123456' })
  check('month + day + time picks the right day (Tue, not Mon)', rpcCalls('booking_reserve')[0]?.body.p_start === '2026-09-30T01:30:00.000Z')
}
for (const [status, re] of [
  ['mismatch', /doesn't match/], ['expired', /expired/], ['too_many_attempts', /Too many wrong codes/], ['no_code', /No code has been sent/],
] as const) {
  resetMode(); mode.check = status
  const out = await run('book_call', { slot: 'Mon, Sep 28, 6:30 PM PT', email: 'visitor@example.com', code: '999999' })
  check(`code ${status}: no reservation, no event, and the visitor is told`, rpcCalls('booking_reserve').length === 0 && inserts().length === 0 && re.test(out) && /nothing was booked/.test(out))
}
for (const [status, re] of [
  ['already_booked', /already has an upcoming call/], ['daily_cap', /isn't taking more bookings today/], ['not_verified', /not confirmed/],
] as const) {
  resetMode(); mode.reserve = status
  const out = await run('book_call', { slot: 'Mon, Sep 28, 6:30 PM PT', email: 'visitor@example.com', code: '123456' })
  check(`reserve ${status}: no event, and the visitor is told`, inserts().length === 0 && re.test(out) && !out.startsWith('Booked'))
}
{
  // Non-vacuity: with nothing busy, Mon 6:00 PM IS one of the six offered.
  resetMode()
  const offered = await run('check_availability', {})
  resetMode(); mode.reserve = 'slot_taken'
  const out = await run('book_call', { slot: 'Mon, Sep 28, 6:00 PM PT', email: 'visitor@example.com', code: '123456' })
  check('someone else took the slot: no event, and fresh times WITHOUT that one',
    offered.includes('- Mon, Sep 28, 6:00 PM PT')
    && inserts().length === 0 && /Someone else just booked/.test(out) && TIME_RE.test(out) && !out.includes('- Mon, Sep 28, 6:00 PM PT'))
}
{
  resetMode(); mode.insert = 'refused'
  const out = await run('book_call', { slot: 'Mon, Sep 28, 6:30 PM PT', email: 'visitor@example.com', code: '123456' })
  const fin = rpcCalls('booking_finalize')[0]?.body
  await flush()
  check('Google REFUSING the event (a 4xx) releases the slot', fin?.p_status === 'failed' && fin?.p_event_id === null)
  check('...and the visitor hears it was NOT booked', /could NOT be added/.test(out) && !out.startsWith('Booked') && out.includes('joe@joestechsolutions.com'))
  check('...and Joe gets no email', emails().length === 0)
}

// --- 5b. An insert whose outcome is UNKNOWN is never reported as a failure -------
// A timeout or 5xx may mean Google created the event and emailed the invite.
const UNKNOWN_RE = /not known yet whether the call was booked/
for (const ins of ['abort', '5xx', 'garbage'] as const) {
  resetMode(); mode.insert = ins; mode.get = 'exists'
  const out = await run('book_call', { slot: 'Mon, Sep 28, 6:30 PM PT', email: 'visitor@example.com', code: '123456' })
  const fin = rpcCalls('booking_finalize')[0]?.body
  check(`insert ${ins}, but Google has the event: it is a booking`, out.startsWith('Booked: Mon, Sep 28, 6:30 PM PT') && fin?.p_status === 'confirmed' && fin?.p_event_id === EVENT_ID)
  check(`insert ${ins}: Google was asked about OUR event id`, gets().some((g) => g.url.endsWith(`/events/${EVENT_ID}`)))
}
for (const get of ['missing', 'error'] as const) {
  resetMode(); mode.insert = 'abort'; mode.get = get
  const out = await run('book_call', { slot: 'Mon, Sep 28, 6:30 PM PT', email: 'visitor@example.com', code: '123456' })
  await flush()
  check(`insert timed out, event ${get} on the check: the visitor is told it is NOT KNOWN yet`,
    UNKNOWN_RE.test(out) && !out.startsWith('Booked') && !/NOT be added|nothing was booked|could NOT/.test(out) && /inbox/.test(out))
  check(`...the row is left pending for reconcile (no finalize either way) (${get})`, rpcCalls('booking_finalize').length === 0)
  check(`...and Joe is asked to check his calendar (${get})`, /may or may not have gone through/.test(ownerMail()?.subject || ''))
}
{
  resetMode(); mode.insert = '409'
  const out = await run('book_call', { slot: 'Mon, Sep 28, 6:30 PM PT', email: 'visitor@example.com', code: '123456' })
  check('409 (our id already exists) is a booking, not an error', out.startsWith('Booked:') && rpcCalls('booking_finalize')[0]?.body.p_status === 'confirmed')
}

// --- 5c. Reconcile: rows follow their Google events ---------------------------------
{
  resetMode(); mode.check = 'mismatch'
  await run('book_call', { slot: 'Mon, Sep 28, 6:30 PM PT', email: 'visitor@example.com', code: '999999' })
  check('an unverified visitor never triggers reconcile (no Google calls on their behalf)', rpcCalls('booking_candidates').length === 0 && gets().length === 0)
}
{
  resetMode()
  const cand = rpcCalls
  mode.candidates = [{ id: 'aaaaaaaa-0000-0000-0000-000000000001', status: 'pending', google_event_id: null, slot_start: '2026-09-29T01:30:00+00:00', slot_end: '2026-09-29T02:00:00+00:00' }]
  mode.get = 'missing'
  await run('book_call', { slot: 'Mon, Sep 28, 6:30 PM PT', email: 'visitor@example.com', code: '123456' })
  const sync = cand('booking_sync')[0]?.body
  check('the candidates are asked for this email and slot', cand('booking_candidates')[0]?.body.p_email === 'visitor@example.com' && cand('booking_candidates')[0]?.body.p_start === '2026-09-29T01:30:00.000Z')
  check('a stale pending row is checked by its derived event id', gets().some((g) => g.url.endsWith('/events/aaaaaaaa000000000000000000000001')))
  check('...and with no event it is marked failed, freeing the slot and the email (review B-1)', sync?.p_id === 'aaaaaaaa-0000-0000-0000-000000000001' && sync?.p_status === 'failed')
}
{
  resetMode()
  mode.candidates = [{ id: 'aaaaaaaa-0000-0000-0000-000000000002', status: 'pending', google_event_id: null, slot_start: '2026-09-29T01:30:00+00:00', slot_end: '2026-09-29T02:00:00+00:00' }]
  mode.get = 'exists'
  await run('book_call', { slot: 'Mon, Sep 28, 7:00 PM PT', email: 'visitor@example.com', code: '123456' })
  const sync = rpcCalls('booking_sync')[0]?.body
  check('a stale pending row whose event DOES exist is confirmed with that event id',
    sync?.p_status === 'confirmed' && sync?.p_event_id === 'aaaaaaaa000000000000000000000002')
}
{
  resetMode()
  mode.candidates = [{ id: 'bbbbbbbb-0000-0000-0000-000000000003', status: 'confirmed', google_event_id: 'evtjoe', slot_start: '2026-09-29T01:30:00+00:00', slot_end: '2026-09-29T02:00:00+00:00' }]
  mode.get = 'cancelled'
  await run('book_call', { slot: 'Mon, Sep 28, 6:30 PM PT', email: 'visitor@example.com', code: '123456' })
  const sync = rpcCalls('booking_sync')[0]?.body
  check('a confirmed booking Joe cancelled in Google is marked cancelled (checked by its recorded event id)',
    gets().some((g) => g.url.endsWith('/events/evtjoe')) && sync?.p_status === 'cancelled')
}
{
  resetMode()
  mode.candidates = [{ id: 'bbbbbbbb-0000-0000-0000-000000000004', status: 'confirmed', google_event_id: 'evtmoved', slot_start: '2026-09-29T01:30:00+00:00', slot_end: '2026-09-29T02:00:00+00:00' }]
  mode.get = 'exists'; mode.getTimes = { start: '2026-09-30T02:00:00Z', end: '2026-09-30T02:30:00Z' }
  await run('book_call', { slot: 'Mon, Sep 28, 6:30 PM PT', email: 'visitor@example.com', code: '123456' })
  const sync = rpcCalls('booking_sync')[0]?.body
  check('a booking Joe MOVED follows the event to its new time',
    sync?.p_status === 'confirmed' && sync?.p_start === '2026-09-30T02:00:00.000Z' && sync?.p_end === '2026-09-30T02:30:00.000Z')
}
{
  resetMode()
  mode.candidates = [{ id: 'bbbbbbbb-0000-0000-0000-000000000005', status: 'confirmed', google_event_id: 'evtsame', slot_start: '2026-09-29T01:30:00+00:00', slot_end: '2026-09-29T02:00:00+00:00' }]
  mode.get = 'exists'
  await run('book_call', { slot: 'Mon, Sep 28, 7:00 PM PT', email: 'visitor@example.com', code: '123456' })
  check('an unchanged confirmed booking is left alone', rpcCalls('booking_sync').length === 0)
}
{
  resetMode()
  mode.candidates = [{ id: 'bbbbbbbb-0000-0000-0000-000000000006', status: 'confirmed', google_event_id: 'evtx', slot_start: '2026-09-29T01:30:00+00:00', slot_end: '2026-09-29T02:00:00+00:00' }]
  mode.get = 'error'
  const out = await run('book_call', { slot: 'Mon, Sep 28, 7:00 PM PT', email: 'visitor@example.com', code: '123456' })
  check('a row Google can’t confirm either way is left as it is, and booking carries on', rpcCalls('booking_sync').length === 0 && out.startsWith('Booked:'))
}
{
  resetMode(); mode.candidatesFail = true
  const out = await run('book_call', { slot: 'Mon, Sep 28, 6:30 PM PT', email: 'visitor@example.com', code: '123456' })
  check('reconcile failing never blocks a booking', out.startsWith('Booked:') && rpcCalls('booking_reserve').length === 1)
}
{
  resetMode(); mode.reserve = 'in_progress'
  const out = await run('book_call', { slot: 'Mon, Sep 28, 6:30 PM PT', email: 'visitor@example.com', code: '123456' })
  check('a booking still in flight for this email is reported as such — not as an existing call', /still being processed/.test(out) && !/already has/.test(out) && inserts().length === 0)
}

// --- 5d. The owner's notice never delays the visitor -------------------------------
{
  resetMode()
  let release: () => void = () => {}
  mode.ownerHold = new Promise<void>((r) => { release = r })
  const out = await run('book_call', { slot: 'Mon, Sep 28, 6:30 PM PT', email: 'visitor@example.com', code: '123456' })
  check('book_call returns while Joe’s notice is still in flight', out.startsWith('Booked:') && background.length === 1)
  release(); await flush()
}
{
  resetMode(); mode.resend = 500
  const logged: string[] = []
  const realError = console.error
  console.error = (...a: unknown[]) => { logged.push(a.map(String).join(' ')) }
  await run('book_call', { slot: 'Mon, Sep 28, 6:30 PM PT', email: 'visitor@example.com', code: '123456' })
  await flush()
  console.error = realError
  check('a refused owner notice is logged, not silently lost', logged.some((l) => /owner notice refused/.test(l)))
}
{
  resetMode(); mode.freeBusy = 'http'
  const out = await run('book_call', { slot: 'Mon, Sep 28, 6:30 PM PT', email: 'visitor@example.com', code: '123456' })
  check('a calendar that can’t be read at booking time books nothing and touches no database', rpcCalls('booking_check_code').length === 0 && rpcCalls('booking_reserve').length === 0 && /NOT booked/.test(out))
}
{
  resetMode()
  const out = await B.runBookingTool('book_call', null, { sessionId: SESSION, req, persona: jts, now: NOW })
  check('a null input from the model is refused, not thrown', typeof out === 'string' && inserts().length === 0 && !out.startsWith('Booked'))
}

// --- 5e. What the visitor sees if the reply itself fails -------------------------------
{
  const booked = B.bookingFallbackText(['Booked: Mon, Sep 28, 6:30 PM PT, 30 minutes, for v@example.com. Tell the visitor…'], jts)
  check('after a booking, the last-resort message still tells the visitor it is booked', booked === 'Your call with Joe is booked: Mon, Sep 28, 6:30 PM PT. Google Calendar is emailing you the invite with the Google Meet link.')
  const unknown = B.bookingFallbackText(["Google didn't confirm the booking in time, so it is not known yet whether the call was booked. Tell…"], jts)
  check('after an unknown outcome, it says so and offers email', /couldn't confirm whether your call was booked/.test(unknown || '') && (unknown || '').includes('joe@joestechsolutions.com'))
  check('otherwise there is nothing special to say', B.bookingFallbackText(['Joe has open call times.'], jts) === null)
}

// --- 6. Codes ----------------------------------------------------------------------
{
  const codes = Array.from({ length: 500 }, () => B.newCode())
  check('codes are always 6 digits', codes.every((c: string) => /^\d{6}$/.test(c)))
  check('codes vary', new Set(codes).size > 490)
  const real = crypto.getRandomValues.bind(crypto)
  const queue = [4_294_000_000, 5] // first value is in the biased top range and must be discarded
  ;(crypto as any).getRandomValues = (buf: Uint32Array) => { buf[0] = queue.shift() ?? 0; return buf }
  const c = B.newCode()
  ;(crypto as any).getRandomValues = real
  check('a value from the biased top of the range is rejected, and short codes are zero-padded', c === '000005')
}

// --- 7. Every call is bounded ----------------------------------------------------------
check('every outbound request carried an abort signal', calls.length > 0 && calls.every((c) => c.hasSignal))
check('database calls give up within 3s, email within 4s (a chat reply waits on them)', B.RPC_TIMEOUT_MS <= 3000 && B.EMAIL_TIMEOUT_MS <= 4000)
{
  resetMode(); mode.rpcHang = true
  const t0 = Date.now()
  let guard: ReturnType<typeof setTimeout> | undefined
  const out = await Promise.race([
    run('send_verification_code', { email: 'visitor@example.com' }),
    new Promise<string>((r) => { guard = setTimeout(() => r('HUNG'), B.RPC_TIMEOUT_MS + 2000) }),
  ])
  clearTimeout(guard)
  check('a hung database returns an honest failure instead of hanging the chat', out !== 'HUNG' && /couldn't be completed/.test(out) && Date.now() - t0 < B.RPC_TIMEOUT_MS + 1500)
  check('...and no code email went out for a code that was never recorded', emails().length === 0)
}

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1) }
console.log('ok — books only open, verified, matching slots; every refusal stops early and says so; results need no second tool call')
