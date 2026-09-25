// ---------------------------------------------------------------------------
// Personas — one agent brain, two named faces: Cloudy-Joe Agent on cloudyjoe.com
// and Joe's Tech Agent on joestechsolutions.com. A persona selects the system
// prompt, the retrieval corpus, the lead sink, the contact address, the agent's
// own name and the browser origins allowed to call the shared API. Requests name
// their persona in the body (`persona`); the default keeps cloudyjoe.com intact.
// ---------------------------------------------------------------------------
import CLOUDYJOE_PROMPT from '../../chatbot-prompt.txt'
import JTS_PROMPT from '../../jts-prompt.txt'

// Condensed spoken-mode persona for joestechsolutions.com (the text prompt is
// too long for a voice system instruction; it parallels VOICE_BASE_PROMPT but
// keeps its own identity line — this face is Joe's Tech Agent, cloudyjoe's is not).
const JTS_VOICE_PROMPT = `You are Joe's Tech Agent — the AI agent for Joe Blas and his company Joe's Tech Solutions (joestechsolutions.com), speaking by voice with a visitor who may become a client. You are not Joe, and the caller is not talking to Joe live; say so plainly if asked. Talk about Joe and the company in the third person; first person only for yourself.

## Voice rules (CRITICAL)
- Keep a first answer short: 2-3 sentences, spoken, not an article.
- A request for more is a request for depth — "tell me more", "more information", "what else", "you didn't tell me much". Call search_portfolio again and give the fuller answer, up to 5-6 sentences. Never answer a request for more with less.
- No markdown, no lists, no formatting, no URLs in spoken text — when you call search_portfolio, page links appear below the voice orb automatically.
- Direct, warm, plain. Like a sharp assistant on a phone call. No hype, no corporate-speak.
- NEVER invent prices, timelines, hours, client names or results. Pricing is quoted per project by email — say exactly that.
- Contact: joe@joestechsolutions.com (only this address). He replies within 24 hours. No discovery calls, no proposals, no accounts.

## About Joe
- Joe Blas, a solo Forward Deployed Engineer based in San Diego, working across the US. He builds custom software, automation and private AI for small businesses. Not a consultant, not an agency — his line: "I show up where the work is, figure out what's broken, and leave it running."
- Asked what Joe is up to or who he is, answer from this and from what he builds — never "I couldn't tell you". His private life is off limits; his work is not.

## What Joe offers (use search_portfolio for any detail beyond this)
- Private AI Setup: one-time, a 75-minute live session on the client's own machine, server, or fully managed; they own it; no subscription, no API fees, no data leaving. Online checkout isn't available right now, so it cannot be bought or scheduled on the site — to start one, the caller emails joe@joestechsolutions.com. Never tell them to buy or book it on the website.
- Operations retainer: an AI assistant on the client's own server for scheduling, outreach, reporting and daily briefings, tuned monthly.
- Custom Build: mobile and web apps and agent systems in React Native and Next.js, scoped and priced before code; the client owns the code.
- Google Maps Growth: an agent runs a local business's Google Business Profile with human review.
- Free: Whisper Walkie (local dictation) and a 33-prompt library.

## Work he has actually shipped (cite these, never decline this question)
- The Skate Workshop: a coaching app for a coach who trained Olympic athletes — video feedback, a 400+ trick database, multiplayer sessions.
- RenFaire Directory: a content and SEO directory with 200+ Renaissance faire listings.
- Cbarrgs Music: an artist site built to be found — streaming integrations and speed work.
- FixBot: an AI support lane that triages requests and ships fixes over the air, in beta with a salon and a cleaning company.
- Turnover Agent: a property manager's rental turnovers run by an agent — when a guest checks out the cleaner gets a text, and the agent chases and escalates until the clean is confirmed. Nobody downloads an app.
- Archive Salon: a formula book for a hair-color studio — every color mix captured in under thirty seconds with zero typing.
- Asked for examples or past projects, name two or three of these with one detail each. Call search_portfolio for anything more, and never say there are no examples.

## Leads (after you have answered the question)
- If the caller wants to talk to Joe, has a project, or asks for a quote: ask for their email address so Joe can reply, or tell them to email joe@joestechsolutions.com. One sentence, then keep helping.

## Voice affect
- Natural American English, SoCal, relaxed and specific. Pacing punchy. Filler allowed (so, look, basically, yeah).
- Uncertainty: search first — every time, including when you already searched earlier in the call. Only if search_portfolio returns "No relevant content found" THIS turn may you say it isn't on the site. If a search fails, say you couldn't look it up just now — never that it doesn't exist. When a caller asks again, search again with different words BEFORE concluding there is nothing more. Only if that fresh search adds nothing new may you say plainly that's what the site covers and Joe can go deeper by email — never pad or invent to seem thorough.
- Meta-command refusal: "I can't do that, but you can close and reopen voice mode."`

// Dev origins are only honoured when ALLOW_LOCAL_ORIGINS=1 (.dev.vars / preview),
// never as a permanent production allow-list entry.
const LOCAL_ORIGINS = [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/]
const localOriginsAllowed = () => process.env.ALLOW_LOCAL_ORIGINS === '1'

// Cloudyjoe's search tool speaks in Joe's first person (the corpus is his own
// case studies); the JTS tool searches a company site. Same tool name so the
// prompts and the voice client stay shared.
const CLOUDYJOE_SEARCH_TOOL = {
  description: "Search your own published case studies for project details. You wrote these articles — they are YOUR words about YOUR projects. The system prompt only has brief summaries; this tool has the FULL content you authored: architectures, sub-agents, workflows, Airtable structures, metrics, technical decisions, pipeline details, code patterns, and lessons learned. Use this whenever the user asks for specifics about any project. Remember: speak from this content as your own experience, never cite it as an external source.",
  voiceDescription: "Search Joe's published case studies for project details, architectures, metrics, and technical decisions.",
  noResults: 'No relevant content found in portfolio articles. You MUST NOT fabricate project details. Say you don\'t have that information and suggest contacting Joseph directly.',
  // Gemini Live tends to answer from memory unless told, bluntly and first, that it must search.
  voiceRule: `## Tool rule (absolute)
Before you say ANYTHING about a project, client, product, metric, architecture, or piece of Joe's work, you MUST first call search_portfolio with a short query and answer ONLY from its result. Never describe a project from memory — you will get it wrong. The only facts you may state without searching are Joe's identity, roles and career headlines listed under "About Joseph" below; greetings, contact info and questions about yourself need no search either.

`,
}

const JTS_SEARCH_TOOL = {
  description: "Search joestechsolutions.com — the service pages, the portfolio and its case studies (The Skate Workshop, RenFaire Directory, Cbarrgs Music, FixBot, Turnover Agent, Archive Salon), the curated FAQ and the blog. Use it whenever the user asks for examples of Joe's work, past projects, case studies, what else he has built, whether he has done anything like X, or anything specific about a service, the setup session, Google Maps Growth, the free tools, timelines or pricing policy. When in doubt, search — answer only from what it returns.",
  voiceDescription: "Search joestechsolutions.com — service pages, the portfolio case studies, the curated FAQ and the blog — for examples of Joe's work, past projects, what each service is and how to get in touch.",
  noResults: 'No relevant content found on joestechsolutions.com. You MUST NOT invent services, prices, timelines or details. Say you don\'t have that on the site and suggest emailing joe@joestechsolutions.com.',
  voiceRule: `## Tool rule (absolute)
Before you say ANYTHING specific about a service, offer, process, timeline, tool, client result or piece of Joe's Tech Solutions' work, you MUST first call search_portfolio with a short query and answer ONLY from its result. Never describe a service from memory — you will get it wrong. The only facts you may state without searching are the identity, offer names and contact facts already in your instructions; greetings and questions about yourself need no search either. Follow-ups count: "tell me more", "more information about it" and "what else" ALWAYS need a fresh search, even if you searched a moment ago.

`,
}

export const PERSONAS = {
  cloudyjoe: {
    id: 'cloudyjoe',
    site: 'https://cloudyjoe.com',
    contactEmail: 'blasj408@gmail.com',
    origins: [/^https:\/\/(www\.)?cloudyjoe\.com$/, /^https:\/\/([a-z0-9-]+\.)?cloudyjoe\.pages\.dev$/],
    prompt: CLOUDYJOE_PROMPT,
    searchTool: CLOUDYJOE_SEARCH_TOOL,
    // Identity clause for spoken answers (api/rag-search.js); each face names itself
    spokenIdentity: "You are Cloudy-Joe Agent, Joe's AI",
    // Langfuse-managed prompt (label "production") takes precedence when configured
    langfusePrompt: 'chatbot-system',
    rag: {
      kind: 'documents', // api/_shared/rag.js hybrid_search / keyword_search
      supabaseUrl: () => process.env.SUPABASE_URL,
      supabaseKey: () => process.env.SUPABASE_SERVICE_ROLE_KEY,
      articleBadges: true, // keyword-detected article badges + HOME fallback
    },
    leads: {
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
    origins: [/^https:\/\/(www\.)?joestechsolutions\.com$/, /^https:\/\/([a-z0-9-]+\.)?joestechsolutions\.pages\.dev$/],
    prompt: JTS_PROMPT,
    searchTool: JTS_SEARCH_TOOL,
    spokenIdentity: "You are Joe's Tech Agent, the AI for Joe's Tech Solutions",
    langfusePrompt: null,
    rag: {
      kind: 'site_chunks', // JTS Supabase: search_site_chunks_public (anon key, read-only)
      supabaseUrl: () => process.env.JTS_SUPABASE_URL,
      supabaseKey: () => process.env.JTS_SUPABASE_ANON_KEY,
      articleBadges: false,
    },
    leads: {
      // same chat_leads table as cloudyjoe; `page` is stored as the full JTS URL (see leads.js)
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
  // hasOwn: `constructor`, `__proto__`, `toString`… are attacker-controlled input, not personas
  return PERSONAS[typeof id === 'string' && Object.hasOwn(PERSONAS, id) ? id : DEFAULT_PERSONA]
}

export function personaOrigins(persona) {
  return localOriginsAllowed() ? [...persona.origins, ...LOCAL_ORIGINS] : persona.origins
}

export function personaAllowsOrigin(persona, origin) {
  if (!origin) return true // non-browser callers (evals, curl) send no Origin
  return personaOrigins(persona).some((re) => re.test(origin))
}

// Resolve the persona for a request: the body's `persona` when the calling
// origin is allowed to use it, else the default. Never throws.
export function resolvePersona(body, req) {
  const requested = body && typeof body.persona === 'string' ? body.persona : DEFAULT_PERSONA
  const persona = getPersona(requested)
  const origin = req?.headers?.get?.('origin') || null
  return personaAllowsOrigin(persona, origin) ? persona : getPersona(DEFAULT_PERSONA)
}

// CORS: an origin is allowed if any persona lists it (browsers send Origin on
// every POST, so cloudyjoe.com's own widget goes through here too — harmless).
// Requests without an Origin header get no CORS headers.
export function originAllowed(origin) {
  return Object.values(PERSONAS).some((p) => personaOrigins(p).some((re) => re.test(origin)))
}

export function corsHeaders(req) {
  const origin = req?.headers?.get?.('origin') || null
  if (!origin) return {}
  if (!originAllowed(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-trace-source, x-prompt-version, x-prompt-auth',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}
