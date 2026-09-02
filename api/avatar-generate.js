// ---------------------------------------------------------------------------
// /api/avatar-generate — LongCat Video Avatar edge function
//
// Pipeline: text → OpenAI TTS → upload (portrait + audio) to HF Space Gradio
//           → submit generate_avatar → poll SSE → return video URL.
//
// All generation happens on HF's ZeroGPU. We are a thin async proxy. If the
// Space is down, rate-limited, or its ZeroGPU budget is exhausted, we return
// { error: 'avatar_unavailable' } so the client falls back to text-only.
// ---------------------------------------------------------------------------

export const config = {
  runtime: 'edge',
}

const DEFAULT_SPACE_URL = 'https://akhaliq-longcat-video-avatar-1-5.hf.space'
const PROMPT = 'A man speaking naturally to camera, professional lighting, neutral background, looking directly at viewer.'
const RESOLUTION = '480p'
const ACCELERATION = 'distill'
const VOCAL_MODE = 'Studio Portrait Voice'
const MAX_TEXT_CHARS = 2000
const MAX_TOTAL_MS = 110_000 // leave headroom under Vercel's 120s edge limit

// ---------------------------------------------------------------------------
// Rate limiting (mirrors voice-token.js pattern; separate table). Fails open
// if Supabase or the table is unavailable.
// ---------------------------------------------------------------------------
const MAX_SESSIONS_PER_IP = 3
const WINDOW_MS = 24 * 60 * 60 * 1000
const RATE_LIMIT_TABLE = 'avatar_rate_limits'

async function checkRateLimit(ip) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { allowed: true, remaining: MAX_SESSIONS_PER_IP }
  }
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString()
  try {
    const checkRes = await fetch(
      `${url}/rest/v1/${RATE_LIMIT_TABLE}?ip=eq.${encodeURIComponent(ip)}&window_start=gte.${windowStart}&select=count`,
      { headers },
    )
    if (!checkRes.ok) return { allowed: true, remaining: MAX_SESSIONS_PER_IP }
    const rows = await checkRes.json()
    const currentCount = rows[0]?.count || 0
    if (currentCount >= MAX_SESSIONS_PER_IP) return { allowed: false, remaining: 0 }
    await fetch(`${url}/rest/v1/${RATE_LIMIT_TABLE}`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({
        ip,
        count: currentCount + 1,
        window_start: rows.length > 0 ? undefined : new Date().toISOString(),
      }),
    }).catch(() => {})
    return { allowed: true, remaining: MAX_SESSIONS_PER_IP - currentCount - 1 }
  } catch {
    return { allowed: true, remaining: MAX_SESSIONS_PER_IP }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unavailable() {
  return new Response(JSON.stringify({ error: 'avatar_unavailable' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  })
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Gradio FileData object per the Space's /config schema (all 7 fields). */
function fileData(path, origName, mimeType, bytes) {
  return {
    path,
    url: `${process.env.LONGCAT_SPACE_URL || DEFAULT_SPACE_URL}/file=${path}`,
    size: bytes,
    orig_name: origName,
    mime_type: mimeType,
    is_stream: false,
    meta: { _type: 'gradio.FileData' },
  }
}

/** Upload one or more files to the Space's Gradio upload endpoint. */
async function uploadFiles(files) {
  const base = process.env.LONGCAT_SPACE_URL || DEFAULT_SPACE_URL
  const form = new FormData()
  for (const f of files) {
    form.append('files', new Blob([f.bytes], { type: f.mime }), f.name)
  }
  const res = await fetch(`${base}/gradio_api/upload`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`upload failed: ${res.status}`)
  const paths = await res.json()
  if (!Array.isArray(paths) || paths.length < files.length) {
    throw new Error('upload returned unexpected shape')
  }
  return paths
}

/** Submit the generate_avatar job; returns its event_id. */
async function submitAvatar(imageFd, audioFd, seed) {
  const base = process.env.LONGCAT_SPACE_URL || DEFAULT_SPACE_URL
  const res = await fetch(`${base}/gradio_api/call/generate_avatar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [imageFd, audioFd, PROMPT, RESOLUTION, seed, VOCAL_MODE, ACCELERATION],
      event_data: null,
    }),
  })
  if (!res.ok) throw new Error(`submit failed: ${res.status}`)
  const { event_id } = await res.json()
  if (!event_id) throw new Error('no event_id')
  return event_id
}

/**
 * Poll the SSE result stream until the job completes or errors.
 * Returns the video URL string. Throws on error or timeout.
 */
async function pollAvatar(eventId, deadline) {
  const base = process.env.LONGCAT_SPACE_URL || DEFAULT_SPACE_URL
  const res = await fetch(`${base}/gradio_api/call/generate_avatar/${eventId}`)
  if (!res.ok || !res.body) throw new Error(`poll failed: ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = ''

  while (true) {
    if (Date.now() > deadline) throw new Error('timeout')
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let nl
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line) continue
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        const payload = line.slice(5).trim()
        if (currentEvent === 'complete') {
          return extractVideoUrl(payload)
        }
        if (currentEvent === 'error') {
          throw new Error(payload && payload !== 'null' ? `hf: ${payload}` : 'hf_error')
        }
        // generating / heartbeat / progress events — ignore
      }
    }
  }
  throw new Error('stream closed without result')
}

function extractVideoUrl(payload) {
  let parsed
  try { parsed = JSON.parse(payload) } catch { throw new Error('unparseable result') }
  const result = Array.isArray(parsed) ? parsed[0] : parsed
  if (!result) throw new Error('empty result')
  if (typeof result === 'string') return result
  const url = result.url || result.path
  if (!url) throw new Error('no video url in result')
  return url.startsWith('http') ? url : `${process.env.LONGCAT_SPACE_URL || DEFAULT_SPACE_URL}/file=${url}`
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  if (!process.env.OPENAI_API_KEY) return unavailable()
  const base = process.env.LONGCAT_SPACE_URL || DEFAULT_SPACE_URL

  try {
    const body = await req.json().catch(() => null)
    const { text, sessionId, currentPage } = body || {}
    if (typeof text !== 'string' || !text.trim()) {
      return json({ error: 'Missing text' }, 400)
    }
    const speechText = text.slice(0, MAX_TEXT_CHARS)

    // Rate limit
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimit = await checkRateLimit(ip)
    if (!rateLimit.allowed) {
      return json({
        error: 'rate_limited',
        message: 'You have reached the limit of 3 avatar generations per day',
      }, 429)
    }

    const deadline = Date.now() + MAX_TOTAL_MS

    // Step 1: TTS via Hermes gateway (Edge TTS — Joe's configured voice, free)
    // Falls back to OpenAI TTS if Hermes is unavailable.
    let audioBytes
    const ttsUrl = process.env.HERMES_TTS_URL
    const ttsToken = process.env.HERMES_TTS_TOKEN
    if (ttsUrl && ttsToken) {
      try {
        const ttsRes = await fetch(`${ttsUrl}/api/audio/speak`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ttsToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: speechText }),
        })
        if (!ttsRes.ok) throw new Error(`hermes tts ${ttsRes.status}`)
        const ttsData = await ttsRes.json()
        if (!ttsData.ok || !ttsData.data_url) throw new Error('no data_url')
        // data_url is "data:audio/ogg;base64,...." — decode to binary
        const b64 = ttsData.data_url.split(',')[1]
        audioBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      } catch (e) {
        console.error('Hermes TTS failed, falling back to OpenAI:', e.message)
      }
    }
    if (!audioBytes && process.env.OPENAI_API_KEY) {
      const voice = process.env.TTS_VOICE || 'onyx'
      const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'tts-1', voice, input: speechText, response_format: 'mp3' }),
      })
      if (!ttsRes.ok) {
        console.error('OpenAI TTS failed:', ttsRes.status)
        return unavailable()
      }
      audioBytes = new Uint8Array(await ttsRes.arrayBuffer())
    }
    if (!audioBytes) return unavailable()

    // Step 2: fetch Joe's portrait — target must be server-controlled, never
    // derived from request headers (Host/X-Forwarded-* are attacker-settable → SSRF)
    const deployHost = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''
    const imageUrl = process.env.AVATAR_IMAGE_URL || (deployHost ? `${deployHost}/foto-avatar.webp` : `${base}/foto-avatar.webp`)
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) {
      console.error('portrait fetch failed:', imgRes.status, imageUrl)
      return unavailable()
    }
    const imageBytes = new Uint8Array(await imgRes.arrayBuffer())

    // Step 3: upload both files to the Space (audio may be ogg from Hermes or mp3 from OpenAI)
    const audioMime = audioBytes && ttsUrl ? 'audio/ogg' : 'audio/mpeg'
    const audioExt = audioBytes && ttsUrl ? 'tts.ogg' : 'tts.mp3'
    const [imagePath, audioPath] = await uploadFiles([
      { bytes: imageBytes, mime: 'image/webp', name: 'avatar.webp' },
      { bytes: audioBytes, mime: audioMime, name: audioExt },
    ])

    // Step 4: submit + poll
    const seed = Math.floor(Math.random() * 1_000_000)
    const imageFd = fileData(imagePath, 'avatar.webp', 'image/webp', imageBytes.length)
    const audioFd = fileData(audioPath, audioExt, audioMime, audioBytes.length)
    const eventId = await submitAvatar(imageFd, audioFd, seed)
    const videoUrl = await pollAvatar(eventId, deadline)

    return json({ videoUrl, audioUrl: null })
  } catch (err) {
    console.error('avatar-generate error:', err.message || err)
    return unavailable()
  }
}