import { getPersona, DEFAULT_PERSONA } from './personas.js'
import { FAST_MODEL, scaleTokens } from './models.js'
// ---------------------------------------------------------------------------
// Lead capture for the cloudyjoe.com chatbot.
//
// The bot used to answer a visitor who wanted to hire Joe and then drop them:
// no record, no notification, nothing but an email address rendered in the
// reply. This records the intent in Supabase (public.chat_leads) and emails
// Joe, mirroring what joestechsolutions.com does.
//
// Edge-runtime safe: fetch only, no SDKs, no Node APIs (the one model call, for
// the handoff brief, uses the client chat.js passes in). Every function here
// swallows its own errors — a lead-capture failure must never break a reply.
//
// THE HANDOFF (2026-09-26, Joe: "handle as much as possible before I need to be
// contacted"). Joe used to get one bare message — "They said: <last line>" —
// and start every lead from zero. Now the notice carries a brief of the whole
// conversation (who, business, need, timeline, what the agent already
// answered, what is open for Joe) plus the transcript it was written from. The
// brief is a model summary, so the transcript travels with it as the source of
// truth; if the summary fails or times out, the transcript alone still goes.
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
//
// Bounded, because "fails open" only covered an ERROR. A Supabase call that
// hangs is neither an error nor an answer, and this runs before every chat
// message and every voice search — so an unbounded await here would stall the
// whole agent on both sites. On timeout it fails open like any other outage.
export const RATE_LIMIT_TIMEOUT_MS = 1500
export async function checkRateLimit(req, limit = 40) {
  if (!supabaseConfigured()) return true
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RATE_LIMIT_TIMEOUT_MS)
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/check_chat_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_ip: clientIp(req), p_limit: limit }),
      signal: controller.signal,
    })
    if (!res.ok) return true
    return (await res.json()) !== false
  } catch {
    return true
  } finally {
    clearTimeout(timer)
  }
}

export const BRIEF_TIMEOUT_MS = 8000
const TRANSCRIPT_MESSAGES = 12
const MESSAGE_CHARS = 600

// The last few visible turns, labelled. Only user/assistant text is ever here —
// chat.js passes the widget's history, never system prompts or tool results.
export function transcriptOf(history) {
  if (!Array.isArray(history)) return ''
  return history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-TRANSCRIPT_MESSAGES)
    .map((m) => {
      const text = m.content.trim().replace(/\s+/g, ' ')
      return `${m.role === 'user' ? 'Visitor' : 'Agent'}: ${text.length > MESSAGE_CHARS ? `${text.slice(0, MESSAGE_CHARS)}…` : text}`
    })
    .join('\n')
}

export const BRIEF_SYSTEM = `You write a short handoff brief for Joe, a solo consultant, about a conversation his website's chat agent had with a visitor. Use ONLY what is in the transcript. Where something was not said, write "not said". Never invent names, companies, budgets, dates, needs or promises. Plain text, exactly these eight lines and nothing else:
Who:
Business:
Need:
Timeline:
Best-fit service: (a service the agent named, or "not clear")
Already answered by the agent:
Open questions for Joe:
Suggested next step:`

// A model summary of the transcript, or null. Bounded, never retried: it runs
// after the reply (waitUntil), and a missing brief must not hold the notice up.
export async function buildBrief(history, client, { timeoutMs = BRIEF_TIMEOUT_MS } = {}) {
  const transcript = transcriptOf(history)
  if (!transcript || !client) return null
  try {
    const res = await client.messages.create({
      model: FAST_MODEL,
      max_tokens: scaleTokens(450),
      system: BRIEF_SYSTEM,
      messages: [{ role: 'user', content: `Transcript:\n${transcript}` }],
    }, { timeout: timeoutMs, maxRetries: 0 })
    const text = (res?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
    // A reply that isn't the template is worse than none: Joe still gets the transcript.
    return /^Who:/m.test(text) && /^Need:/m.test(text) ? text.slice(0, 2500) : null
  } catch (err) {
    console.error('[lead] brief failed:', err?.message)
    return null
  }
}

function oneLine(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

async function notifyOwner({ email, kind, message, page, sessionId, lang, persona, history, client }) {
  const key = process.env.RESEND_API_KEY
  const to = process.env.ALERT_EMAIL
  if (!key || !to) return false
  const transcript = transcriptOf(history)
  const brief = transcript ? await buildBrief(history, client) : null
  const need = brief?.match(/^Need:\s*(.+)$/m)?.[1]
  const subjectNeed = need && !/^not said/i.test(need.trim()) ? ` — ${oneLine(need, 70)}` : ''
  const page_ = persona.booking?.pageUrl
  const bookingOffered = page_ && Array.isArray(history)
    && history.some((m) => m?.role === 'assistant' && typeof m.content === 'string' && m.content.includes(page_))
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: persona.leads.from,
        to: [to],
        ...(email ? { reply_to: email } : {}),
        subject: oneLine(persona.leads.subject(email) + subjectNeed, 150),
        text: [
          email ? `Email: ${email}` : 'Email: (not given)',
          `Type: ${kind}`,
          `Page: ${page || 'unknown'}`,
          `Language: ${lang || 'en'}`,
          `Session: ${sessionId || 'unknown'}`,
          ...(page_ ? [`Booking link offered in chat: ${bookingOffered ? 'yes' : 'no'} (a booking itself shows on your calendar)`] : []),
          '',
          ...(brief
            ? ['BRIEF (written by the agent from the conversation — check it against the transcript below)', brief, '']
            : []),
          ...(transcript
            ? ['CONVERSATION (last messages)', transcript]
            : ['They said:', String(message).slice(0, 1500)]),
        ].join('\n'),
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

// One conversation should not produce a stack of near-identical emails. Every
// matching message is still recorded, but the email is suppressed if this
// session already triggered one and this message adds nothing new (an email
// address arriving after a "wants to talk" turn IS new, so that one sends).
async function alreadyNotified(sessionId, hasEmail) {
  if (!sessionId || !supabaseConfigured()) return false
  try {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
    const q = new URLSearchParams({
      select: 'email',
      session_id: `eq.${sessionId}`,
      notified: 'is.true',
      created_at: `gte.${since}`,
      limit: '5',
    })
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/chat_leads?${q}`, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    })
    if (!res.ok) return false
    const prior = await res.json()
    if (!Array.isArray(prior) || prior.length === 0) return false
    // Suppress unless this message carries an address we have not sent before.
    return !hasEmail || prior.some((r) => r.email)
  } catch {
    return false
  }
}

// Record first, notify second: the row is the durable copy, so a Resend outage
// costs a notification, not the lead. Never throws.
export async function captureLead({ message, page, sessionId, lang, reply, persona = getPersona(), history, client }) {
  const hit = detectLead(message)
  if (!hit) return null
  try {
    const suppress = await alreadyNotified(sessionId, Boolean(hit.email))
    const notified = suppress ? false : await notifyOwner({ ...hit, message, page, sessionId, lang, persona, history, client })
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
          // Shared table: non-default personas store the full site URL so their
          // leads stay distinguishable from cloudyjoe's bare paths.
          page: persona.id === DEFAULT_PERSONA || typeof page !== 'string' || !page.trim() || /^https?:\/\//i.test(page)
            ? page ?? null
            : `${persona.site}${page.startsWith('/') ? '' : '/'}${page}`,
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
