/* eslint-disable @typescript-eslint/no-explicit-any --
 * Replaces globalThis.fetch and inspects the raw requests sent to Google.
 */
// The Google Calendar client for the booking concierge. Nothing here talks to
// Google: the network is stubbed, and the one thing most likely to be subtly
// wrong — the RS256 service-account JWT — is verified cryptographically against
// a key pair generated in this test, so a correct signature is proven rather
// than assumed.
process.env.GOOGLE_SA_EMAIL = 'booking@jts-test.iam.gserviceaccount.com'
delete process.env.BOOKING_CALENDAR_ID

let failed = 0
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`  ✗ ${name}`); failed++ }
}
const b64urlDecode = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0))
const jsonPart = (s: string) => JSON.parse(new TextDecoder().decode(b64urlDecode(s)))

// A real RSA key pair, exported as the PKCS#8 PEM Google's JSON key contains.
const pair = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true, ['sign', 'verify'],
)
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
const pemBody = btoa(String.fromCharCode(...pkcs8)).match(/.{1,64}/g)!.join('\n')
const PEM = `-----BEGIN PRIVATE KEY-----\n${pemBody}\n-----END PRIVATE KEY-----\n`
// How it arrives when pasted from the downloaded JSON: literal backslash-n.
const PEM_ESCAPED = PEM.replace(/\n/g, '\\n')
process.env.GOOGLE_SA_PRIVATE_KEY = PEM_ESCAPED

const G = await import('../functions/api-src/_shared/google-calendar.js')

const verify = async (jwt: string) => {
  const [h, c, sig] = jwt.split('.')
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey, b64urlDecode(sig), new TextEncoder().encode(`${h}.${c}`))
}

// --- 1. The service-account JWT -----------------------------------------------
{
  const jwt = await G.signJwt({ email: process.env.GOOGLE_SA_EMAIL, key: PEM, sub: 'joe@joestechsolutions.com', scope: G.SCOPES, now: 1_790_000_000 })
  const [h, c] = jwt.split('.')
  const header = jsonPart(h), claims = jsonPart(c)
  check('JWT header is exactly {alg: RS256, typ: JWT}', JSON.stringify(header) === '{"alg":"RS256","typ":"JWT"}')
  check('iss is the service account', claims.iss === process.env.GOOGLE_SA_EMAIL)
  check('sub impersonates the calendar owner (domain-wide delegation)', claims.sub === 'joe@joestechsolutions.com')
  check('aud is Google’s token endpoint', claims.aud === 'https://oauth2.googleapis.com/token')
  check('scope is exactly events + freebusy', claims.scope === 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy')
  check('exp is iat + 3600 (Google’s maximum)', claims.iat === 1_790_000_000 && claims.exp === 1_790_003_600)
  check('the signature VERIFIES against the matching public key', await verify(jwt))
  const tampered = jwt.slice(0, -4) + (jwt.endsWith('AAAA') ? 'BBBB' : 'AAAA')
  check('...and a tampered signature does not', !(await verify(tampered)))
}
{
  // Must FAIL cleanly if normalisation breaks, not crash the file: an uncaught
  // throw here once hid the result of every check after it.
  let ok = false
  try { ok = await verify(await G.signJwt({ email: 'x', key: PEM_ESCAPED, sub: 's', scope: 'y', now: 1 })) } catch { ok = false }
  check('a PEM with literal \\n (as pasted from the JSON key) signs correctly', ok)
}
{
  let threw = false
  try { await G.signJwt({ email: 'x', key: '', sub: 's', scope: 'y' }) } catch { threw = true }
  check('an empty key throws rather than signing garbage', threw)
}

// --- a stub for Google ---------------------------------------------------------
const calls: { url: string; init: any }[] = []
let tokenStatus = 200, tokenBody: any = { access_token: 'ya29.stub', expires_in: 3600, token_type: 'Bearer' }
let fbBody: any = null, fbStatus = 200, insertBody: any = null, insertStatus = 200, hang = false
let getBody: any = null, getStatus = 200, tokenBodyStall = false
;(globalThis as any).fetch = async (url: string, init: any) => {
  calls.push({ url: String(url), init })
  if (hang) return new Promise((_r, rej) => init?.signal?.addEventListener('abort', () => { const e: any = new Error('aborted'); e.name = 'AbortError'; rej(e) }))
  const json = (b: any, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } })
  if (String(url).startsWith('https://oauth2.googleapis.com/token') && tokenBodyStall) {
    // Headers arrive; the body never does, until the caller aborts.
    return new Response(new ReadableStream({
      start(c) { init?.signal?.addEventListener('abort', () => { const e: any = new Error('aborted'); e.name = 'AbortError'; c.error(e) }) },
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (String(url).startsWith('https://oauth2.googleapis.com/token')) return json(tokenBody, tokenStatus)
  if (String(url).endsWith('/freeBusy')) return json(fbBody, fbStatus)
  if (String(url).includes('/events?')) return json(insertBody, insertStatus)
  if (String(url).includes('/events/')) return json(getBody, getStatus)
  return json({}, 404)
}
const reset = () => { calls.length = 0; G._resetTokenCache(); tokenStatus = 200; tokenBody = { access_token: 'ya29.stub', expires_in: 3600 }; hang = false; tokenBodyStall = false }

// --- 2. The token exchange -----------------------------------------------------
{
  reset()
  let t = ''
  try { t = await G.accessToken(1_790_000_000_000) } catch (e: any) { check(`token exchange succeeds with the service-account key (${e.message})`, false) }
  const req = calls[0]
  const form = new URLSearchParams(req?.init?.body)
  check('token exchange POSTs a form to the token endpoint', req?.url === 'https://oauth2.googleapis.com/token' && req.init.method === 'POST'
    && /x-www-form-urlencoded/.test(req.init.headers['Content-Type']))
  check('grant_type is the JWT-bearer grant', form.get('grant_type') === 'urn:ietf:params:oauth:grant-type:jwt-bearer')
  check('the assertion is a signed JWT that verifies', !!form.get('assertion') && await verify(form.get('assertion')!))
  check('returns the access token', t === 'ya29.stub')
  const claims = jsonPart(form.get('assertion')!.split('.')[1])
  check('the token impersonates Joe (JWT sub = the calendar owner)', claims.sub === 'joe@joestechsolutions.com' && claims.iss === process.env.GOOGLE_SA_EMAIL)
  await G.accessToken(1_790_000_000_000 + 30 * 60_000).catch(() => {})
  check('a token is reused while fresh (no second exchange)', calls.length === 1)
  await G.accessToken(1_790_000_000_000 + 3600_000).catch(() => {})
  check('...and refreshed when it expires', calls.length === 2)
}
{
  reset(); tokenStatus = 401; tokenBody = { error: 'unauthorized_client' }
  let msg = ''
  try { await G.accessToken() } catch (e: any) { msg = e.message }
  check('a rejected exchange throws, surfacing Google’s reason (delegation not granted)', /unauthorized_client/.test(msg))
}

// --- 3. Free/busy ---------------------------------------------------------------
{
  reset()
  fbBody = { calendars: { 'joe@joestechsolutions.com': { busy: [{ start: '2026-09-29T01:15:00Z', end: '2026-09-29T01:45:00Z' }] } } }
  const busy = await G.freeBusy(Date.parse('2026-09-26T00:00:00Z'), Date.parse('2026-10-10T00:00:00Z'))
  const req = calls.find((c) => c.url.endsWith('/freeBusy'))
  const body = JSON.parse(req?.init?.body)
  check('freeBusy asks about Joe’s calendar over the window', body.items?.[0]?.id === 'joe@joestechsolutions.com'
    && body.timeMin === '2026-09-26T00:00:00.000Z' && body.timeMax === '2026-10-10T00:00:00.000Z')
  check('freeBusy is authorised with the bearer token', req?.init?.headers?.Authorization === 'Bearer ya29.stub')
  check('busy intervals come back as ms', busy.length === 1 && busy[0].start === Date.parse('2026-09-29T01:15:00Z'))
}
for (const [label, body, status] of [
  ['a per-calendar error (e.g. notFound) THROWS — an unreadable calendar must not look free', { calendars: { 'joe@joestechsolutions.com': { errors: [{ domain: 'global', reason: 'notFound' }] } } }, 200],
  ['a response with no entry for the calendar throws', { calendars: {} }, 200],
  ['a non-2xx throws', { error: 'x' }, 500],
] as const) {
  reset(); fbBody = body; fbStatus = status as number
  let threw = false
  try { await G.freeBusy(0, 1) } catch { threw = true }
  check(label as string, threw)
}
fbStatus = 200

// --- 4. Creating the event ------------------------------------------------------
{
  reset()
  insertBody = { id: 'evt1', htmlLink: 'https://calendar.google.com/x', hangoutLink: 'https://meet.google.com/abc-defg-hij' }
  const out = await G.insertEvent({ startMs: Date.parse('2026-09-29T01:00:00Z'), endMs: Date.parse('2026-09-29T01:30:00Z'),
    summary: 'Call with Ada', description: 'd', attendee: { email: 'ada@example.com', name: 'Ada' }, requestId: 'req-123' })
  const req = calls.find((c) => c.url.includes('/events?'))
  const body = JSON.parse(req?.init?.body)
  check('inserts into Joe’s calendar', req?.url.includes('/calendars/joe%40joestechsolutions.com/events'))
  check('with conferenceDataVersion=1 (or the Meet request is ignored)', /conferenceDataVersion=1/.test(req?.url))
  check('and sendUpdates=all, so the visitor gets Google’s invite', /sendUpdates=all/.test(req?.url))
  check('the visitor is the attendee', body.attendees?.[0]?.email === 'ada@example.com' && body.attendees[0].displayName === 'Ada')
  check('a Google Meet link is requested with our requestId',
    body.conferenceData?.createRequest?.conferenceSolutionKey?.type === 'hangoutsMeet' && body.conferenceData.createRequest.requestId === 'req-123')
  check('times are exact ISO instants', body.start?.dateTime === '2026-09-29T01:00:00.000Z' && body.end?.dateTime === '2026-09-29T01:30:00.000Z')
  check('returns the event id and Meet link', out.id === 'evt1' && out.meetLink === 'https://meet.google.com/abc-defg-hij')
}
{
  reset(); insertBody = { id: 'evt2', conferenceData: { entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/xyz' }] } }
  const out = await G.insertEvent({ startMs: 0, endMs: 1, summary: 's', description: 'd', attendee: { email: 'a@b.co' }, requestId: 'r' })
  check('Meet link falls back to the video entry point', out.meetLink === 'https://meet.google.com/xyz')
}
{
  reset(); insertBody = { id: 'evt3', conferenceData: { createRequest: { status: { statusCode: 'pending' } } } }
  const out = await G.insertEvent({ startMs: 0, endMs: 1, summary: 's', description: 'd', attendee: { email: 'a@b.co' }, requestId: 'r' })
  check('a still-pending Meet link is null, never invented', out.meetLink === null && out.id === 'evt3')
}
{
  reset(); insertStatus = 403; insertBody = { error: { message: 'forbidden' } }
  let threw = false
  try { await G.insertEvent({ startMs: 0, endMs: 1, summary: 's', description: 'd', attendee: { email: 'a@b.co' }, requestId: 'r' }) } catch { threw = true }
  check('a failed insert throws', threw)
  insertStatus = 200
}
const ev = { startMs: 0, endMs: 1, summary: 's', description: 'd', attendee: { email: 'a@b.co' }, requestId: 'r', eventId: 'abcdef0123456789abcdef0123456789' }
const insertError = async () => { try { await G.insertEvent(ev); return null } catch (e: any) { return e } }
{
  reset(); insertStatus = 200; insertBody = { id: ev.eventId }
  await G.insertEvent(ev)
  const body = JSON.parse(calls.find((c) => c.url.includes('/events?'))?.init?.body)
  check('the event is created with OUR id, so its outcome can always be checked', body.id === ev.eventId)
}
{
  reset(); insertStatus = 409; insertBody = { error: { code: 409 } }
  const out = await G.insertEvent(ev).catch(() => null)
  check('409 (that id already exists) means an earlier attempt created it: success', out?.id === ev.eventId && out?.existed === true)
}
for (const [status, body, definite, label] of [
  [403, { error: {} }, true, 'a 403 is a definite refusal'],
  [400, { error: {} }, true, 'a 400 is a definite refusal'],
  [503, { error: {} }, false, 'a 503 leaves the outcome UNKNOWN (Google may have created it)'],
  [500, { error: {} }, false, 'a 500 leaves the outcome unknown'],
  [200, null, false, 'a 200 whose body has no event id leaves the outcome unknown'],
] as const) {
  reset(); insertStatus = status; insertBody = body
  const err = await insertError()
  check(label, !!err && err.definite === definite)
}
{
  reset(); hang = true
  const err = await insertError()
  check('a timed-out insert is never a definite refusal', !!err && err.definite !== true)
  insertStatus = 200
}

// --- 4b. Looking an event up ------------------------------------------------------
{
  reset(); getStatus = 200; getBody = { id: ev.eventId, status: 'confirmed', start: { dateTime: '2026-09-29T01:30:00Z' }, end: { dateTime: '2026-09-29T02:00:00Z' } }
  const out = await G.getEvent(ev.eventId)
  const req = calls.find((c) => c.url.includes('/events/'))
  check('getEvent reads the event by id from Joe’s calendar',
    req?.url === `https://www.googleapis.com/calendar/v3/calendars/joe%40joestechsolutions.com/events/${ev.eventId}` && req?.init?.headers?.Authorization === 'Bearer ya29.stub')
  check('an existing event comes back with its current times',
    out.exists === true && out.start === Date.parse('2026-09-29T01:30:00Z') && out.end === Date.parse('2026-09-29T02:00:00Z'))
}
for (const [status, body, label] of [
  [404, { error: {} }, '404 = the event does not exist'],
  [410, { error: {} }, '410 = the event is gone'],
  [200, { id: 'x', status: 'cancelled', start: { dateTime: '2026-09-29T01:30:00Z' }, end: { dateTime: '2026-09-29T02:00:00Z' } }, 'a cancelled event counts as not existing'],
] as const) {
  reset(); getStatus = status; getBody = body
  const out = await G.getEvent('x')
  check(label, out.exists === false)
}
for (const [status, body, label] of [
  [500, { error: {} }, 'a 500 THROWS — "can’t tell" must never read as "gone"'],
  [403, { error: {} }, 'a 403 throws'],
  [200, { id: 'x', status: 'confirmed', start: {}, end: {} }, 'an event with no usable times throws'],
] as const) {
  reset(); getStatus = status; getBody = body
  let threw = false
  try { await G.getEvent('x') } catch { threw = true }
  check(label, threw)
}
getStatus = 200

// --- 5. Every request is bounded --------------------------------------------------
{
  reset(); hang = true
  let guardTimer: any
  const guard = new Promise((res) => { guardTimer = setTimeout(() => res('HUNG'), G.GOOGLE_TIMEOUT_MS + 3000) })
  const out = await Promise.race([G.accessToken().then(() => 'ok', () => 'threw'), guard])
  clearTimeout(guardTimer)
  check('a hung Google request is aborted within the timeout, not awaited forever', out === 'threw')
  check('the timeout stays a few seconds (it sits in a chat reply)', G.GOOGLE_TIMEOUT_MS > 0 && G.GOOGLE_TIMEOUT_MS <= 5000)
}
{
  // The deadline covers the BODY: a token response whose body stalls must not
  // outlast reconcile and then create an event on a released row (review of #30).
  reset(); tokenBodyStall = true
  let guardTimer: any
  const t0 = Date.now()
  const guard = new Promise((res) => { guardTimer = setTimeout(() => res('HUNG'), G.GOOGLE_TIMEOUT_MS + 3000) })
  const out = await Promise.race([G.accessToken().then(() => 'ok', () => 'threw'), guard])
  clearTimeout(guardTimer)
  check('a Google reply whose headers arrive but whose body stalls is cut off at the deadline',
    out === 'threw' && Date.now() - t0 < G.GOOGLE_TIMEOUT_MS + 1500)
}

// --- 6. Config ------------------------------------------------------------------
check('calendar defaults to joe@joestechsolutions.com', G.calendarId() === 'joe@joestechsolutions.com')
{
  // A secondary calendar changes WHICH calendar, never WHO is impersonated:
  // delegation can only be granted to a real Workspace user.
  // Guarded: a regression here must FAIL named checks, not crash the suite.
  process.env.BOOKING_CALENDAR_ID = 'c_bookings@group.calendar.google.com'
  const SECONDARY = 'c_bookings%40group.calendar.google.com'
  reset()
  let sub = '', fbId = '', insertUrl = '', getUrl = ''
  try {
    await G.accessToken(1_790_000_000_000)
    sub = jsonPart(new URLSearchParams(calls[0]?.init?.body).get('assertion')!.split('.')[1]).sub
    fbBody = { calendars: { 'c_bookings@group.calendar.google.com': { busy: [] } } }
    await G.freeBusy(0, 1)
    fbId = JSON.parse(calls.find((c) => c.url.endsWith('/freeBusy'))?.init?.body).items?.[0]?.id
    insertStatus = 200; insertBody = { id: ev.eventId }
    await G.insertEvent(ev)
    insertUrl = calls.find((c) => c.url.includes('/events?'))?.url || ''
    getStatus = 200; getBody = { id: ev.eventId, status: 'confirmed', start: { dateTime: '2026-09-29T01:30:00Z' }, end: { dateTime: '2026-09-29T02:00:00Z' } }
    await G.getEvent(ev.eventId)
    getUrl = calls.find((c) => c.url.includes('/events/'))?.url || ''
  } catch (e: any) {
    check(`the secondary-calendar path runs without throwing (${e.message})`, false)
  }
  check('with a secondary calendar, the JWT still impersonates the owner', sub === 'joe@joestechsolutions.com')
  check('...free/busy reads the secondary calendar', fbId === 'c_bookings@group.calendar.google.com')
  check('...events are created on it', insertUrl.includes(`/calendars/${SECONDARY}/events?`))
  // If lookups read a different calendar than inserts, every lookup 404s and
  // reconcile releases every live booking.
  check('...and events are LOOKED UP on the same calendar they were created on', getUrl.includes(`/calendars/${SECONDARY}/events/`))
  delete process.env.BOOKING_CALENDAR_ID
}
check('configured only when both service-account secrets exist', G.googleConfigured() === true)
{
  const saved = process.env.GOOGLE_SA_PRIVATE_KEY; delete process.env.GOOGLE_SA_PRIVATE_KEY
  check('...and not configured without the key', G.googleConfigured() === false)
  process.env.GOOGLE_SA_PRIVATE_KEY = saved
}

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('ok — JWT verifies cryptographically; token, freeBusy and insert shaped to Google’s spec; every call bounded')
