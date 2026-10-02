// The voice relay (api/voice-live.js) pipes only Google tokens this server
// minted: /api/voice-token hands out `<token>~<signature>`, an HMAC of the
// token under a server secret, so the relay cannot be borrowed as a free pipe
// to Google by anyone holding a token of their own. The key is the Gemini API
// key itself (never sent anywhere from here) unless VOICE_RELAY_SECRET is set.
const enc = new TextEncoder()
const secret = () => process.env.VOICE_RELAY_SECRET || process.env.GEMINI_API_KEY || ''

async function signature(token) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(token)))
  return Array.from(mac.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function signVoiceTicket(token) {
  return `${token}~${await signature(token)}`
}

// The Google token inside a ticket this server signed, or null.
export async function verifyVoiceTicket(ticket) {
  if (!secret() || typeof ticket !== 'string') return null
  const cut = ticket.lastIndexOf('~')
  if (cut <= 0) return null
  const token = ticket.slice(0, cut)
  const given = ticket.slice(cut + 1)
  const want = await signature(token)
  if (given.length !== want.length) return null
  let diff = 0
  for (let i = 0; i < want.length; i++) diff |= given.charCodeAt(i) ^ want.charCodeAt(i)
  return diff === 0 ? token : null
}
