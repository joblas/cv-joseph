// ---------------------------------------------------------------------------
// Personas — one Cloudy-Joe Agent, several faces. A persona selects the system
// prompt, the retrieval corpus, the lead sink, the contact address and the
// browser origins allowed to call the shared API. Requests name their persona
// in the body (`persona`); the default keeps cloudyjoe.com's behaviour intact.
// ---------------------------------------------------------------------------
import CLOUDYJOE_PROMPT from '../../chatbot-prompt.txt'
import JTS_PROMPT from '../../jts-prompt.txt'

// Condensed spoken-mode persona for joestechsolutions.com (the text prompt is
// too long for a voice system instruction; this mirrors VOICE_BASE_PROMPT).
const JTS_VOICE_PROMPT = `You are Cloudy-Joe Agent — the AI agent for Joe Blas and his company Joe's Tech Solutions (joestechsolutions.com), speaking by voice with a visitor who may become a client. You are not Joe, and the caller is not talking to Joe live; say so plainly if asked. Talk about Joe and the company in the third person; first person only for yourself.

## Voice rules (CRITICAL)
- Responses VERY short: max 2-3 punchy sentences. Spoken conversation, not an article.
- No markdown, no lists, no formatting, no URLs in spoken text — when you call search_portfolio, page links appear below the voice orb automatically.
- Direct, warm, plain. Like a sharp assistant on a phone call. No hype, no corporate-speak.
- NEVER invent prices, timelines, hours, client names or results. Pricing is quoted per project by email — say exactly that.
- Contact: joe@joestechsolutions.com (only this address). He replies within 24 hours. No discovery calls, no proposals, no accounts.

## What Joe offers (use search_portfolio for any detail beyond this)
- Private AI Setup: one-time, a 75-minute live session on the client's own machine, server, or fully managed; they own it; no subscription, no API fees, no data leaving. The one product with online checkout.
- Operations retainer: an AI assistant on the client's own server for scheduling, outreach, reporting and daily briefings, tuned monthly.
- Custom Build: mobile and web apps and agent systems in React Native and Next.js, scoped and priced before code; the client owns the code.
- Google Maps Growth: an agent runs a local business's Google Business Profile with human review.
- Free: Whisper Walkie (local dictation) and a 33-prompt library.

## Leads (most important)
- If the caller wants to talk to Joe, has a project, or asks for a quote: ask for their email address so Joe can reply, or tell them to email joe@joestechsolutions.com. One sentence, then keep helping.

## Voice affect
- Natural American English, SoCal, relaxed and specific. Pacing punchy. Filler allowed (so, look, honestly, basically, yeah).
- Uncertainty: "I don't have that on the site, but leave your email and Joe will answer that himself."
- Meta-command refusal: "I can't do that, but you can close and reopen voice mode."`

const LOCAL_ORIGINS = [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/]

export const PERSONAS = {
  cloudyjoe: {
    id: 'cloudyjoe',
    site: 'https://cloudyjoe.com',
    contactEmail: 'blasj408@gmail.com',
    origins: [/^https:\/\/(www\.)?cloudyjoe\.com$/, /^https:\/\/[a-z0-9-]+\.cloudyjoe\.pages\.dev$/, ...LOCAL_ORIGINS],
    prompt: CLOUDYJOE_PROMPT,
    // Langfuse-managed prompt (label "production") takes precedence when configured
    langfusePrompt: 'chatbot-system',
    rag: {
      kind: 'documents', // api/_shared/rag.js hybrid_search / keyword_search
      supabaseUrl: () => process.env.SUPABASE_URL,
      supabaseKey: () => process.env.SUPABASE_SERVICE_ROLE_KEY,
      articleBadges: true, // keyword-detected article badges + HOME fallback
    },
    leads: {
      table: 'chat_leads',
      from: 'cloudyjoe.com <leads@subscribe.joestechsolutions.com>',
      subject: (email) => (email ? `Lead from cloudyjoe.com: ${email}` : 'Someone on cloudyjoe.com wants to get in touch'),
    },
    rateLimitMessage: "That's a lot of messages in one hour. Email Joe directly at blasj408@gmail.com and he'll pick it up.",
    errorMessage: 'Sorry, something went wrong. Try again or reach out at blasj408@gmail.com.',
  },
  jts: {
    id: 'jts',
    site: 'https://www.joestechsolutions.com',
    contactEmail: 'joe@joestechsolutions.com',
    origins: [/^https:\/\/(www\.)?joestechsolutions\.com$/, /^https:\/\/[a-z0-9-]+\.joestechsolutions\.pages\.dev$/, ...LOCAL_ORIGINS],
    prompt: JTS_PROMPT,
    langfusePrompt: null,
    rag: {
      kind: 'site_chunks', // JTS Supabase: search_site_chunks_public (anon key, read-only)
      supabaseUrl: () => process.env.JTS_SUPABASE_URL,
      supabaseKey: () => process.env.JTS_SUPABASE_ANON_KEY,
      articleBadges: false,
    },
    leads: {
      table: 'chat_leads', // same table as cloudyjoe; `page` carries the full JTS URL
      from: 'joestechsolutions.com <leads@subscribe.joestechsolutions.com>',
      subject: (email) => (email ? `Lead from the site chat: ${email}` : 'Someone on the site chat asked for Joe'),
    },
    rateLimitMessage: "That's a lot of messages for one hour. Email Joe directly at joe@joestechsolutions.com and he'll pick it up.",
    errorMessage: 'Sorry, something went wrong. Try again or email joe@joestechsolutions.com.',
    voicePrompt: JTS_VOICE_PROMPT,
  },
}

export const DEFAULT_PERSONA = 'cloudyjoe'

export function getPersona(id) {
  return PERSONAS[typeof id === 'string' && PERSONAS[id] ? id : DEFAULT_PERSONA]
}

export function personaAllowsOrigin(persona, origin) {
  if (!origin) return true // same-origin / non-browser callers
  return persona.origins.some((re) => re.test(origin))
}

// Resolve the persona for a request: the body's `persona` when the calling
// origin is allowed to use it, else the default. Never throws.
export function resolvePersona(body, req) {
  const requested = body && typeof body.persona === 'string' ? body.persona : DEFAULT_PERSONA
  const persona = getPersona(requested)
  const origin = req?.headers?.get?.('origin') || null
  return personaAllowsOrigin(persona, origin) ? persona : getPersona(DEFAULT_PERSONA)
}

// CORS: an origin is allowed if any persona lists it. Same-origin requests
// carry no Origin header and get no CORS headers.
export function corsHeaders(req) {
  const origin = req?.headers?.get?.('origin') || null
  if (!origin) return {}
  const allowed = Object.values(PERSONAS).some((p) => p.origins.some((re) => re.test(origin)))
  if (!allowed) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-trace-source, x-prompt-version, x-prompt-auth',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}
