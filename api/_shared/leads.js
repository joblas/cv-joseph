// ---------------------------------------------------------------------------
// Lead capture for the cloudyjoe.com chatbot.
//
// The bot used to answer a visitor who wanted to hire Joe and then drop them:
// no record, no notification, nothing but an email address rendered in the
// reply. This records the intent in Supabase (public.chat_leads) and emails
// Joe, mirroring what joestechsolutions.com does.
//
// Edge-runtime safe: fetch only, no SDKs, no Node APIs. Every function here
// swallows its own errors — a lead-capture failure must never break a reply.
// ---------------------------------------------------------------------------

const EMAIL_RE = /[^\s@<>()[\],;:]+@[^\s@<>()[\],;:]+\.[a-z]{2,}/i

// Deliberately tighter than the topic:contact intent tag. "What's Joe's email?"
// and "what projects has he built?" are questions, not leads; "I'd like to hire
// him for a project" is a lead. Requires an intent verb, not just a topic word.
const WANTS_HUMAN_RE = new RegExp(
  [
    // English — someone talking about engaging Joe, in first or second person
    /\b(?:i|we|my (?:company|team|startup|business)|our (?:company|team))\b[^.?!]{0,60}\b(?:want|would like|'d like|need|am looking|are looking|looking)\b[^.?!]{0,40}\b(?:to )?(?:hire|work with|talk|speak|chat|connect|engage|contract|discuss|meet)\b/i,
    /\b(?:can|could|would) (?:i|we)\b[^.?!]{0,40}\b(?:hire|work with|talk to|speak (?:to|with)|get in touch|reach)\b/i,
    /\b(?:are you|is he|is joe)\b[^.?!]{0,30}\b(?:available|taking (?:on )?(?:new )?(?:work|clients|projects)|open to (?:work|contract|consulting))\b/i,
    /\b(?:hire|engage|contract) (?:you|him|joe)\b/i,
    /\b(?:get in touch|reach out|put me in touch|connect me|have him (?:call|email|contact) me|have joe (?:call|email|contact) me)\b/i,
    /\b(?:i|we) have a (?:project|job|role|opening|position|opportunity|gig)\b/i,
    /\b(?:job|role|position|opening|opportunity|contract) (?:for|with) (?:you|him|joe)\b/i,
    /\b(?:send|give) (?:me|us) (?:a )?(?:quote|proposal|estimate)\b/i,
    // Spanish — the site is bilingual
    /\b(?:quiero|queremos|me gustaría|nos gustaría|necesito|necesitamos)\b[^.?!]{0,40}\b(?:contratar|trabajar con|hablar|contactar|reunirme|reunirnos)\b/i,
    /\b(?:contratarte|contratarlo|trabajar contigo|ponerme en contacto|tengo un proyecto|tenemos un proyecto)\b/i,
  ].map((r) => `(?:${r.source})`).join('|'),
  'i',
)

export function detectLead(message) {
  const text = String(message || '')
  const email = text.match(EMAIL_RE)?.[0] ?? null
  if (email) return { email, kind: 'lead_with_email' }
  if (WANTS_HUMAN_RE.test(text)) return { email: null, kind: 'wants_human' }
  return null
}

function supabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// Supabase's gateway sets the real client address; validate before it reaches
// an inet column so a malformed header cannot error the whole request.
const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/
const IPV6 = /^[0-9a-f:]+$/i

export function clientIp(req) {
  const raw =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    ''
  const ip = raw.trim()
  return IPV4.test(ip) || (ip.includes(':') && IPV6.test(ip)) ? ip : '0.0.0.0'
}

// Fails OPEN: a limiter outage must not take the chat down with it.
export async function checkRateLimit(req, limit = 40) {
  if (!supabaseConfigured()) return true
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/check_chat_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_ip: clientIp(req), p_limit: limit }),
    })
    if (!res.ok) return true
    return (await res.json()) !== false
  } catch {
    return true
  }
}

async function notifyOwner({ email, kind, message, page, sessionId, lang }) {
  const key = process.env.RESEND_API_KEY
  const to = process.env.ALERT_EMAIL
  if (!key || !to) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'cloudyjoe.com <leads@subscribe.joestechsolutions.com>',
        to: [to],
        ...(email ? { reply_to: email } : {}),
        subject: email
          ? `Lead from cloudyjoe.com: ${email}`
          : 'Someone on cloudyjoe.com wants to get in touch',
        text: [
          email ? `Email: ${email}` : 'Email: (not given)',
          `Type: ${kind}`,
          `Page: ${page || 'unknown'}`,
          `Language: ${lang || 'en'}`,
          `Session: ${sessionId || 'unknown'}`,
          '',
          'They said:',
          String(message).slice(0, 1500),
        ].join('\n'),
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

// Record first, notify second: the row is the durable copy, so a Resend outage
// costs a notification, not the lead. Never throws.
export async function captureLead({ message, page, sessionId, lang, reply }) {
  const hit = detectLead(message)
  if (!hit) return null
  try {
    const notified = await notifyOwner({ ...hit, message, page, sessionId, lang })
    if (supabaseConfigured()) {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/chat_leads`, {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          session_id: sessionId ?? null,
          email: hit.email,
          kind: hit.kind,
          visitor_message: String(message).slice(0, 4000),
          assistant_reply: reply ? String(reply).slice(0, 4000) : null,
          page: page ?? null,
          lang: lang ?? null,
          notified,
        }),
      })
    }
    return { ...hit, notified }
  } catch (err) {
    console.error('[lead] capture failed:', err?.message)
    return null
  }
}
