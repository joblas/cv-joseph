// Voice relay (2026-10-02). The voice widgets used to open Gemini Live
// straight from the browser to Google. On a VPN (Joe's phone, a datacenter
// exit flagged as a proxy) that connection failed with "Connection error",
// while the same phone reached this site without trouble. Now the browser can
// talk only to this site: /api/voice-token still mints Google's single-use
// ephemeral token, with the model, persona and tools locked in by Google, but
// a page that asks for the relay is pointed here, and this relay pipes the
// session to Google unchanged. Google sees Cloudflare's address, not the
// visitor's, so a VPN, or a network that blocks Google's API domain, no
// longer matters.
//
// Not an open proxy: the token must carry this server's signature
// (voice-ticket.js), and the upstream is fixed to Google's constrained Live
// endpoint. The socket Google answers with is handed straight back to the
// browser, so the Workers runtime pipes the frames itself and no code here runs
// per frame. A voice session is thousands of audio frames: a JavaScript pipe
// could exhaust the 10ms of CPU Workers Free allows per request, and on this
// compatibility date it would receive Google's binary frames as Blobs.
/* global WebSocketPair -- a Cloudflare Workers runtime global */
import { verifyVoiceTicket } from './_shared/voice-ticket.js'

export const GOOGLE_LIVE =
  'https://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained'

// A close code a socket may send (the reserved ones become 1011; "no status"
// is a normal end), with the reason capped at the protocol's 123 bytes.
const enc = new TextEncoder()
export function closeWith(ws, code, reason = '') {
  const sendable = code === 1000 || (code >= 1001 && code <= 1014 && ![1004, 1005, 1006].includes(code)) || (code >= 3000 && code <= 4999)
  const c = sendable ? code : code === 1005 ? 1000 : 1011
  let r = String(reason || '')
  while (enc.encode(r).length > 123) r = r.slice(0, -1)
  try {
    ws.close(c, r)
  } catch {
    // already closed
  }
}

export default async function handler(req) {
  if ((req.headers.get('upgrade') || '').toLowerCase() !== 'websocket') {
    return new Response('Expected a WebSocket upgrade', { status: 426 })
  }
  // A failure still completes the handshake, then closes with a reason the
  // widget can show; a refused handshake would reach it as a bare 1006.
  const refuse = (code, reason) => {
    const [client, server] = Object.values(new WebSocketPair())
    server.accept()
    closeWith(server, code, reason)
    return new Response(null, { status: 101, webSocket: client })
  }

  const token = await verifyVoiceTicket(new URL(req.url).searchParams.get('access_token') || '')
  if (!token) return refuse(1008, 'invalid voice ticket')
  let res
  try {
    res = await fetch(`${GOOGLE_LIVE}?access_token=${encodeURIComponent(token)}`, { headers: { Upgrade: 'websocket' } })
  } catch (err) {
    console.error('[voice] relay: Google unreachable:', err?.message)
    return refuse(1011, 'the voice service is unreachable')
  }
  if (!res.webSocket) {
    console.error(`[voice] relay: Google refused the connection (HTTP ${res.status})`)
    return refuse(1011, `the voice service refused the connection (HTTP ${res.status})`)
  }
  // Never accepted here: returning it unaccepted is what makes the runtime pipe it.
  return new Response(null, { status: 101, webSocket: res.webSocket })
}
