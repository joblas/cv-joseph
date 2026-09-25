// ---------------------------------------------------------------------------
// Google Calendar for the booking concierge — service account + domain-wide
// delegation, raw HTTP, Workers-safe (WebCrypto + fetch, no SDK, no Node APIs).
//
// WHY DELEGATION. Google's own events.insert reference: service accounts "need
// to use domain-wide delegation of authority to populate the attendee list".
// Sharing a calendar with a plain service account would create the event but
// could not invite the visitor to it. So the service account impersonates the
// calendar owner (JWT `sub`), which a Workspace super admin authorises once in
// Admin console > Security > Access and data control > API controls > Domain
// wide delegation, using the service account's CLIENT ID and the two scopes
// below.
//
// Verified against Google's docs 2026-09-25 (not recalled):
//   token:    POST https://oauth2.googleapis.com/token
//             grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
//             JWT {"alg":"RS256","typ":"JWT"}; claims iss, sub, scope, aud, iat,
//             exp (<= iat + 3600); signed RSASSA-PKCS1-v1_5 / SHA-256
//   freeBusy: POST https://www.googleapis.com/calendar/v3/freeBusy
//             scope calendar.freebusy (among others)
//   insert:   POST .../calendars/{id}/events?conferenceDataVersion=1&sendUpdates=all
//             scope calendar.events; Meet via conferenceData.createRequest
//             {requestId, conferenceSolutionKey:{type:"hangoutsMeet"}} — created
//             ASYNCHRONOUSLY, so the link may be absent from the response
//
// Every request is bounded. A booking turn is in the chat's request path, and
// an unbounded await there hangs the visitor's reply (learned in #27).
// ---------------------------------------------------------------------------

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/calendar/v3'
export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
].join(' ')
export const GOOGLE_TIMEOUT_MS = 4000

export function calendarId() {
  return process.env.BOOKING_CALENDAR_ID || 'joe@joestechsolutions.com'
}

export function googleConfigured() {
  return !!(process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY)
}

// --- encoding helpers ------------------------------------------------------
const enc = new TextEncoder()
function b64url(bytes) {
  let bin = ''
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const b64urlJson = (obj) => b64url(enc.encode(JSON.stringify(obj)))

// A PEM pasted into an env var often arrives with literal "\n" sequences
// instead of newlines (that is how it sits inside the downloaded JSON key).
export function pemToPkcs8(pem) {
  const body = String(pem || '')
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  if (!body) throw new Error('GOOGLE_SA_PRIVATE_KEY is empty or not a PKCS#8 PEM')
  const bin = atob(body)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out.buffer
}

async function bounded(url, init) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// --- the access token --------------------------------------------------------
let cached = null // { token, expiresAt }

export function _resetTokenCache() { cached = null }

export async function signJwt({ email, key, sub, scope, now = Math.floor(Date.now() / 1000) }) {
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = { iss: email, sub, scope, aud: TOKEN_URL, iat: now, exp: now + 3600 }
  const input = `${b64urlJson(header)}.${b64urlJson(claims)}`
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', pemToPkcs8(key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(input))
  return `${input}.${b64url(sig)}`
}

export async function accessToken(now = Date.now()) {
  // Reuse until a minute before expiry; one token serves many turns.
  if (cached && cached.expiresAt - 60_000 > now) return cached.token
  const assertion = await signJwt({
    email: process.env.GOOGLE_SA_EMAIL,
    key: process.env.GOOGLE_SA_PRIVATE_KEY,
    sub: calendarId(),
    scope: SCOPES,
    now: Math.floor(now / 1000),
  })
  const res = await bounded(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    // `unauthorized_client` here almost always means domain-wide delegation
    // has not been granted (or not for these scopes) in the Admin console.
    throw new Error(`Google token exchange failed: ${res.status} ${data.error || ''}`.trim())
  }
  cached = { token: data.access_token, expiresAt: now + (Number(data.expires_in) || 3600) * 1000 }
  return cached.token
}

// --- free/busy ---------------------------------------------------------------
// Returns [{ start, end }] in ms. Throws if Google reports an error for the
// calendar — a calendar we cannot read must never look like an empty one, or
// every slot would appear free.
export async function freeBusy(timeMinMs, timeMaxMs) {
  const id = calendarId()
  const res = await bounded(`${API}/freeBusy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin: new Date(timeMinMs).toISOString(), timeMax: new Date(timeMaxMs).toISOString(), items: [{ id }] }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Google freeBusy failed: ${res.status}`)
  const cal = data.calendars?.[id]
  if (!cal) throw new Error('Google freeBusy returned no entry for the calendar')
  if (Array.isArray(cal.errors) && cal.errors.length) {
    throw new Error(`Google freeBusy error: ${cal.errors.map((e) => e.reason).join(', ')}`)
  }
  return (cal.busy || []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end))
}

// --- create the event ---------------------------------------------------------
export async function insertEvent({ startMs, endMs, summary, description, attendee, requestId }) {
  const id = encodeURIComponent(calendarId())
  const res = await bounded(`${API}/calendars/${id}/events?conferenceDataVersion=1&sendUpdates=all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: new Date(startMs).toISOString() },
      end: { dateTime: new Date(endMs).toISOString() },
      attendees: [{ email: attendee.email, ...(attendee.name ? { displayName: attendee.name } : {}) }],
      conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      reminders: { useDefault: true },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.id) throw new Error(`Google events.insert failed: ${res.status}`)
  return {
    id: data.id,
    htmlLink: data.htmlLink || null,
    // Meet links are created asynchronously and may not exist yet. Google's
    // own invite email carries the link once it does, so never promise one.
    meetLink: data.hangoutLink || data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri || null,
  }
}
