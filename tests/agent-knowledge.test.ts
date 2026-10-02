/* eslint-disable @typescript-eslint/no-explicit-any --
 * The modules under test are plain JavaScript (api/_shared/*.js) with no type
 * surface, and the fetch stub inspects JSON request bodies.
 */
// Joe's work reaches every agent surface, and the false claims stay gone.
//
// THE DEFECT THIS GUARDS (2026-10-02). A visitor asked the cloudyjoe voice agent
// whether Joe can build a Shopify store, for a musician selling t-shirts and
// stickers. It said it had no such detail. Joe set up exactly that for the
// artist Cbarrgs (shopify.cbarrgs.com) and builds cbarrgs.com, but the fact was
// in no prompt, no voice instruction and no indexed article. Meanwhile four
// hand-kept project lists had drifted into claims the code and records refute.
//
// THE FIX it pins: one module (api/_shared/work.js) holds the verified work
// items, and every consumer is composed from it at runtime:
//   cloudyjoe text  = chatbot-prompt.txt + work list      (personas.js)
//   jts text        = jts-prompt.txt + work list          (personas.js)
//   cloudyjoe voice = VOICE_BASE_PROMPT + work list       (voice-token.js)
//   jts voice       = JTS_VOICE_PROMPT + work list        (personas.js)
// plus the Langfuse prompt path, the search tool's no-result text, the cloudyjoe
// query expansion and the RAG fact cards.
//
// Loads the cf:prep copies (functions/api-src/), which are what ships to
// Workers; `npm run test:agent-knowledge` runs cf:prep first.
import { readFileSync } from 'node:fs'

for (const k of ['LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY', 'LANGFUSE_BASEURL', 'LANGFUSE_HOST']) delete process.env[k]
process.env.SUPABASE_URL = 'https://stub-cj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service'
process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:9'

const work: any = await import('../functions/api-src/_shared/work.js')
const { getPersona }: any = await import('../functions/api-src/_shared/personas.js')
const { voiceInstructions }: any = await import('../functions/api-src/voice-token.js')
const { getSystemPrompt }: any = await import('../functions/api-src/_shared/prompt.js')
const rag: any = await import('../functions/api-src/_shared/rag.js')
const { factCardChunks }: any = await import('../scripts/export-chunks.ts')

let failed = 0
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`  ✗ ${name}`); failed++ }
}
const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

const PERSONAS = ['cloudyjoe', 'jts'] as const
type PersonaId = typeof PERSONAS[number]
const persona = (id: PersonaId) => getPersona(id)

// The four consumers, exactly as each is handed to a model.
const consumers: { id: PersonaId; mode: 'text' | 'voice'; text: string }[] = []
for (const id of PERSONAS) {
  const p = persona(id)
  consumers.push({ id, mode: 'text', text: p.prompt })
  // Gemini Live's systemInstruction is voiceRule + instructions (voice-token.js).
  consumers.push({ id, mode: 'voice', text: p.searchTool.voiceRule + voiceInstructions(p) })
}
check('four consumers loaded (an empty one would pass every "absent" check vacuously)',
  consumers.length === 4 && consumers.every((c) => c.text.length > 5000))
check('no consumer still carries the unreplaced work marker', consumers.every((c) => !c.text.includes(work.WORK_MARKER)))

// --- (i) every included item reaches all four consumers -----------------------
// Hardcoded on purpose: this list is the spec, not a mirror of the module, so
// dropping an item from work.js (or slipping an unaudited one in) fails here.
// Each fragment is a fact the line must carry, per persona where they differ.
// An array means every fragment must be there. The mobile apps' settled
// release status is part of the spec: TestFlight beta only (the 2026-10-02
// audit checked the v3 repo, EAS builds and the App Store and Play lookups),
// and Skate development is paused. Changing a line to "available on the App
// Store" fails here, not only where a banned phrase happens to match.
type Frag = string | string[]
const SPEC: Record<string, Frag | Record<PersonaId, Frag>> = {
  'cbarrgs-site': { cloudyjoe: 'cbarrgs.com, website for the artist Cbarrgs', jts: 'Cbarrgs Music' },
  'cbarrgs-shop': 'shopify.cbarrgs.com',
  'cbarrgs-site-agent': 'Telegram line to an AI coding agent',
  'cbarrgs-news-worker': 'Cloudflare Worker',
  'turnover-agent': 'Turnover Agent',
  'archive-salon-app': { cloudyjoe: ['Archive salon app', 'TestFlight beta'], jts: ['Archive Salon', 'TestFlight beta'] },
  'archive-beta-loop': 'Archive beta-feedback loop',
  'skate-workshop-app': ['The Skate Workshop', 'TestFlight beta', 'paused'],
  'skate-workshop-loop': 'Skate Workshop agent dev loop',
  'skate-workshop-site': 'theskateworkshop.app',
  'renfaire-guide': { cloudyjoe: 'RenFaire Guide', jts: 'RenFaire Directory' },
  'remote-hermes-install': 'Remote AI agent install',
  'jts-site': 'joestechsolutions.com',
  'agent-backend': 'chat and voice agent on both of his sites',
  'cloudyjoe-site': 'cv-santiago',
  'hermes-back-office': 'Hermes back office',
  'openclaw-migration': 'the OpenClaw setup',
  'agent-playbook': 'playbook',
  'fixbot': 'FixBot',
  'private-ai-setup': 'Private AI Setup',
  'whisper-walkie': 'faster-whisper',
  'prompt-library': 'Prompt Library',
  'dalle-demo': 'DALL-E',
  'jts-company': 'three active client builds',
}
// Low-value items stay out of the voice instructions (Gemini Live bills the
// whole setup every session); they remain in the text prompts and fact cards.
// Pinned, so dropping a client item from voice is a visible test change.
const VOICE_SKIPPED = ['cbarrgs-news-worker', 'jts-site', 'agent-playbook', 'prompt-library', 'dalle-demo']
const ids = work.WORK_ITEMS.map((i: any) => i.id)
check(`work.js holds exactly the audited items (got: ${ids.join(', ')})`,
  JSON.stringify([...ids].sort()) === JSON.stringify(Object.keys(SPEC).sort()))
check('every item is INCLUDE or INCLUDE_WITH_CARE (EXCLUDE items never enter the list)',
  work.WORK_ITEMS.every((i: any) => i.verdict === 'INCLUDE' || i.verdict === 'INCLUDE_WITH_CARE'))
check(`exactly the pinned low-value items skip voice (got: ${ids.filter((id: string) => work.WORK_ITEMS.find((i: any) => i.id === id).voice === false).join(', ')})`,
  JSON.stringify(work.WORK_ITEMS.filter((i: any) => i.voice === false).map((i: any) => i.id).sort()) === JSON.stringify([...VOICE_SKIPPED].sort()))
check('every voice wording rule is one of the item\'s own text rules',
  work.WORK_ITEMS.every((i: any) => (i.voiceAvoid || []).every((a: string) => (i.avoid || []).includes(a))))
for (const item of work.WORK_ITEMS) {
  for (const c of consumers) {
    const line = c.mode === 'text' ? work.renderTextLine(item, c.id) : work.renderVoiceLine(item, c.id)
    if (c.mode === 'voice' && VOICE_SKIPPED.includes(item.id)) {
      check(`${item.id} is left out of ${c.id} voice`, !c.text.includes(line))
      continue
    }
    check(`${item.id} reaches ${c.id} ${c.mode}`, c.text.includes(line))
    const spec = SPEC[item.id]
    const frag = typeof spec === 'string' || Array.isArray(spec) ? spec : spec?.[c.id]
    for (const fragment of ([] as string[]).concat(frag ?? [])) {
      check(`${item.id} in ${c.id} ${c.mode} says "${fragment}"`, line.includes(fragment))
    }
  }
}
// The high-risk wording rules stay in voice even though most notes do not:
// claims the records refute that a caller is likely to prompt.
const VOICE_GUARDS: Record<string, string[]> = {
  'turnover-agent': ['Twilio'],
  'cbarrgs-site': ['Next.js'],
  'archive-salon-app': ['on the App Store'],
  'skate-workshop-app': ['live on the App Store', 'Olympic coach'],
  'openclaw-migration': ['that Joe built OpenClaw'],
  'hermes-back-office': ['that Joe wrote the Hermes runtime'],
  'remote-hermes-install': ["the client's name"],
  'jts-company': ['three live client deployments'],
}
for (const [id, phrases] of Object.entries(VOICE_GUARDS)) {
  const item = work.WORK_ITEMS.find((i: any) => i.id === id)
  for (const c of consumers.filter((x) => x.mode === 'voice')) {
    const line = item ? work.renderVoiceLine(item, c.id) : ''
    for (const ph of phrases) check(`${c.id} voice keeps the "${ph}" rule on ${id}`, /Do not say or imply:/.test(line) && line.includes(`"${ph}"`) && c.text.includes(line))
  }
}
// Size budget for the voice setup: Gemini Live is billed for the whole system
// instruction every session and it is not cacheable. Measured 2026-10-02:
// cloudyjoe 14.3k chars, jts 10.9k (before the work list: 8.0k and 5.4k).
const VOICE_BUDGET: Record<PersonaId, number> = { cloudyjoe: 15000, jts: 12000 }
for (const c of consumers.filter((x) => x.mode === 'voice')) {
  check(`${c.id} voice setup stays within ${VOICE_BUDGET[c.id]} chars (is ${c.text.length})`, c.text.length <= VOICE_BUDGET[c.id])
}

// Per-persona naming. CLIENT_NAMING is pinned here too, so loosening a rule in
// work.js is a visible test change, not a silent one.
const NAMING: Record<string, Record<PersonaId, boolean>> = {
  Cbarrgs: { cloudyjoe: true, jts: true },
  Archive: { cloudyjoe: true, jts: true },
  'Willy Santos': { cloudyjoe: true, jts: false },
  Nick: { cloudyjoe: false, jts: false },
  Van: { cloudyjoe: false, jts: false },
}
check('CLIENT_NAMING matches the naming spec', JSON.stringify(work.CLIENT_NAMING) === JSON.stringify(NAMING))
const word = (w: string) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
// Everything a persona's model is handed: the composed prompts, the search
// tool's schema strings and no-result text, and (cloudyjoe) the fact cards,
// whose `asked` phrasings appear in no prompt.
const namingSurfaces: { id: PersonaId; label: string; text: string }[] = [
  ...consumers.map((c) => ({ id: c.id, label: `${c.id} ${c.mode}`, text: c.text })),
  ...PERSONAS.map((id) => {
    const t = persona(id).searchTool
    return { id, label: `${id} search tool`, text: [t.description, t.voiceDescription, t.noResults, t.voiceRule].join('\n') }
  }),
  { id: 'cloudyjoe', label: 'cloudyjoe fact cards', text: factCardChunks().map((c: any) => c.content).join('\n') },
]
for (const s of namingSurfaces) {
  for (const [name, on] of Object.entries(NAMING)) {
    if (on[s.id]) continue
    for (const part of name.split(' ')) check(`${s.label} never names "${part}"`, !word(part).test(s.text))
  }
}
// Names that are never public on either persona (unlisted pages, prospects, people).
for (const s of namingSurfaces) {
  for (const n of ['Zach', 'ZW Home', 'Ryan Adams', 'Anouk', 'Ciphrix', 'H Brothers', 'Autobody', 'Precision Welding', 'Carlos']) {
    check(`${s.label} never names ${n}`, !s.text.includes(n))
  }
}
// JTS: no day job, no Career-Ops, no first names.
for (const c of consumers.filter((x) => x.id === 'jts')) {
  check(`jts ${c.mode} never names Joe's employer`, !/quadient/i.test(c.text))
  check(`jts ${c.mode} never mentions Career-Ops`, !/career[- ]?ops/i.test(c.text))
}
// EXCLUDE items never appear in any work list.
const EXCLUDED = ['Self-Healing Chatbot', 'Semantic Galaxy', 'Wiki Graph', 'Maps Growth', 'Hermes Forge', 'Bootloader',
  'College Selector', 'Fairway', 'Sellerdoor', 'Gibbon', 'SyncLyst', 'ZenFu', 'jts-mail', 'cold-email', 'Cloud Infrastructure']
for (const id of PERSONAS) {
  const blocks = work.workTextBlock(id) + work.workVoiceBlock(id)
  for (const x of EXCLUDED) check(`${id} work list never lists ${x}`, !blocks.toLowerCase().includes(x.toLowerCase()))
}
check("work.js copy has no em dash (Joe's rule for new copy)", !read('api/_shared/work.js').includes('—'))

// --- (ii) the Shopify / Cbarrgs merch fact, both personas, both modes -------------
for (const c of consumers) {
  for (const fact of ['Shopify', 'shopify.cbarrgs.com', 't-shirts', 'sticker', 'Cbarrgs', 'set up']) {
    check(`${c.id} ${c.mode} knows the merch store: "${fact}"`, c.text.includes(fact))
  }
  check(`${c.id} ${c.mode} answers the musician question with yes`, /musician/.test(c.text) && /yes/i.test(c.text))
}
// The Langfuse path cannot drop it either: a stale copy without the marker gets
// the list appended, and the raw file's marker gets replaced.
{
  const stale = { getPrompt: async () => ({ prompt: 'You are Cloudy-Joe Agent. An old prompt with no work list.', version: 7 }) }
  const r = await getSystemPrompt(stale, persona('cloudyjoe'))
  check('a stale Langfuse prompt still gets the work list', r.version === 7 && r.text.includes('shopify.cbarrgs.com'))
  const raw = { getPrompt: async () => ({ prompt: read('chatbot-prompt.txt'), version: 8 }) }
  const r2 = await getSystemPrompt(raw, persona('cloudyjoe'))
  check('a Langfuse copy of the raw file has its marker replaced', !r2.text.includes(work.WORK_MARKER) && r2.text.includes('shopify.cbarrgs.com'))
  check('composition is idempotent (no second list)',
    work.composeTextPrompt(persona('cloudyjoe').prompt, 'cloudyjoe') === persona('cloudyjoe').prompt)
  const file = await getSystemPrompt(null, persona('jts'))
  check('the file path (production: Langfuse unset) is the composed prompt', file.version === 'file' && file.text === persona('jts').prompt)
  // The X-Prompt-Version regression path (chat.js) pins a version through the
  // same function, so it cannot skip the composition either.
  const asked: any[] = []
  const pinnedStub = { getPrompt: async (...args: any[]) => { asked.push(args); return { prompt: 'An old pinned prompt with no work list.', version: 5 } } }
  const r3 = await getSystemPrompt(pinnedStub, persona('cloudyjoe'), { version: 5 })
  check('a pinned Langfuse version gets the work list', r3.version === 5 && r3.text.includes('shopify.cbarrgs.com'))
  check('...and really asks Langfuse for that version', asked[0]?.[1] === 5)
  const chatSrc = read('api/chat.js')
  check('chat.js takes every system prompt from getSystemPrompt (no direct langfuse.getPrompt)',
    !/langfuse\.getPrompt\(/.test(chatSrc) && /getSystemPrompt\(langfuse, persona, pinned \?/.test(chatSrc))
}

// --- (iii) banned claims ------------------------------------------------------------
// Each pattern is a claim the 2026-10-02 audit refuted against a primary
// record (repo, live site, store lookups, production config). The work list's
// own "Do not say or imply" notes quote some of them on purpose, so exactly
// those notes (work.avoidNote) are removed before scanning composed text.
const BANNED: [RegExp, string][] = [
  [/twilio/i, 'Twilio (the Turnover Agent messages cleaners Telegram-first; no Twilio on the runtime path)'],
  [/\b33 (?:outbound )?(?:sms|texts)\b|outbound sms to cleaners|plain sms (?:for|to|through)/i, 'the 33-SMS figure / plain SMS to cleaners'],
  [/career[- ]?ops\s*(?:—|–|-|:)\s*ai job[- ]search pipeline/i, "Career-Ops listed as Joe's own project"],
  [/\b(?:joe|he|i)\s+(?:first\s+)?built\s+openclaw\b|built and operated openclaw|openclaw[^.\n]{0,60}\b(?:i|he|joe) built\b|systems i built from scratch/i, '"built OpenClaw" (he ran a setup on the open-source OpenClaw runtime)'],
  [/cbarrgs[^\n]{0,200}?next\.?js|next\.?js[^\n]{0,200}?cbarrgs/i, 'cbarrgs.com as Next.js (it is Vite + React)'],
  [/\d+(?:\.\d+)?k monthly (?:spotify )?listeners|monthly spotify listeners/i, 'the Spotify listener figure'],
  [/android builds rolling|live on ios|olympic-level|olympic (?:skateboarding )?coach\b|400\+ trick|multiplayer sessions|19-table/i, 'Skate Workshop overclaims (TestFlight beta only, no Android release, 140 tricks)'],
  [/on the client'?s own server|cleaning[- ]operations company|cleaning company|booking and support lane|\b0 lost messages/i, 'FixBot overclaims'],
  [/under thirty seconds,? (?:with )?zero typing|real formulas captured daily|salon management app/i, 'Archive overclaims'],
  [/unattended for weeks/i, '"unattended for weeks" (the loops run on Joe\'s machine and have had outages)'],
  [/\b(?:available|live|out|launched|released)\s+(?:now\s+)?(?:on|in)\s+(?:the\s+)?(?:app store|play store|google play)/i, 'a store release (every mobile app is TestFlight beta only, never submitted)'],
  [/no data leaving|data never leaves|no data ever leaving|never leaves (?:your|their) (?:hardware|servers?)/i, 'unscoped "no data leaving" for Private AI (only a local install keeps everything on the machine; the server and managed options do not)'],
  [/openclaw development/i, '"OpenClaw development" (he ran a setup on the open-source OpenClaw runtime; he did not develop it)'],
  [/516\+? upvotes|250\+ upvotes|74% of evaluated offers|score distribution/i, "santifer's Career-Ops results and Reddit posts presented as Joe's"],
  [/\bAI Operations\b|\bCustom Builds?\b|Operations retainer|\/services#/, 'retired JTS offers'],
  [/agentic observability with langfuse|every autonomous pipeline decision traced|custom operations dashboard|openai realtime/i, 'Langfuse / OpenAI Realtime self-description (production has neither)'],
  [/github\.com\/joblas\/mempalace/i, 'the MemPalace link (404; MemPalace is not his)'],
  [/deepseek-v4-flash/i, 'the retired deepseek-v4-flash model'],
  [/dall-e[^\n]{0,80}\bproduction\b|production ai image generation|dall-e[^\n]{0,40}live web application/i, 'DALL-E as a production app (a 2023 tutorial demo)'],
  [/lurkr \((?:me|himself)\)/i, '"Lurkr (me)" (Lurkr is Joe\'s orchestrator agent)'],
  [/crm automation, invoicing|email routing, crm automation/i, 'CRM automation and invoicing (records show neither)'],
  [/local-first on his own hardware|all self-hosted/i, '"local-first" / "all self-hosted" (models run mostly on Ollama Cloud)'],
  [/\b(?:three|3) live client deployments/i, '"three live client deployments" (three active builds, one in beta)'],
  [/production web and mobile (?:apps|applications)/i, 'production mobile apps (every mobile app is TestFlight beta)'],
  [/private ai deployment/i, '"private AI deployment" as delivered work (no delivery on record)'],
  [/your words about your projects|airtable structures|content you retrieve with search_portfolio was written by joe/i, 'first-person attribution of retrieved text'],
  [/no discovery calls/i, '"no discovery calls" (JTS offers a booking link)'],
]
// Text notes carry every `avoid` phrase, voice notes only `voiceAvoid`; strip both.
const stripAvoid = (text: string) => work.WORK_ITEMS.reduce((t: string, item: any) => {
  for (const note of [work.avoidNote(item), work.avoidNote(item, 'voice')]) if (note) t = t.split(note).join('')
  return t
}, text)
// Files scanned raw. Not scanned, deliberately: api/_shared/work.js (it declares
// the bans; its rendered output is scanned below with the notes stripped),
// src/chatbot-i18n.ts and its registry entry (the EXCLUDE-verdict Self-Healing
// Chatbot article, whose fate is Joe's call) and src/i18n.ts (the homepage,
// outside this pass). The Turnover Agent's structured data (registry.ts,
// TurnoverAgent.tsx) is scanned for its own claim only.
const RAW_FILES = [
  'chatbot-prompt.txt', 'jts-prompt.txt', 'public/llms.txt', 'api/_shared/personas.js',
  'src/turnover-agent-i18n.ts', 'src/archive-beta-loop-i18n.ts', 'src/cbarrgs-agent-i18n.ts',
  'src/skate-workshop-loop-i18n.ts', 'src/openclaw-i18n.ts', 'src/career-ops-i18n.ts', 'src/about-i18n.ts',
]
for (const rel of ['src/articles/registry.ts', 'src/TurnoverAgent.tsx']) {
  check(`${rel}: the Turnover Agent's structured data names no Twilio`, !/twilio/i.test(read(rel)))
}
const scanned: { label: string; text: string }[] = [
  ...RAW_FILES.map((rel) => ({ label: rel, text: read(rel) })),
  ...consumers.map((c) => ({ label: `${c.id} ${c.mode} (composed)`, text: stripAvoid(c.text) })),
  ...PERSONAS.flatMap((id) => {
    const t = persona(id).searchTool
    return [{ label: `${id} search tool`, text: [t.description, t.voiceDescription, t.noResults, t.voiceRule].join('\n') }]
  }),
  { label: 'fact cards', text: stripAvoid(factCardChunks().map((c: any) => c.content).join('\n')) },
]
for (const { label, text } of scanned) {
  for (const [re, what] of BANNED) {
    const m = text.match(re)
    check(`${label}: no ${what}${m ? ` (found "${m[0]}")` : ''}`, !m)
  }
}
// Credit must be present, not merely the false claim absent.
for (const c of consumers) {
  for (const credit of ['Nous Research', 'cv-santiago', 'faster-whisper', 'did not build OpenClaw']) {
    check(`${c.id} ${c.mode} credits: "${credit}"`, c.text.includes(credit))
  }
}
// "Nothing leaves the machine" is true of a local install (and of Whisper
// Walkie), never of the Private AI server or managed options: every sentence
// that says it must carry its scope.
for (const { label, text } of scanned) {
  for (const s of text.split(/(?<=[.;!?])\s+|\n/).filter((x) => /nothing (?:ever )?leaves?\b|never leaves?\b/i.test(x))) {
    check(`${label}: "nothing leaves" is scoped: "${s.trim().slice(0, 80)}"`, /local install|whisper walkie|this app|transcrib/i.test(s))
  }
}
// The Career-Ops material santifer (the upstream template author) wrote before
// the 2026-04-07 fork stays credited or gone: his own score distribution and
// first-person callout, his Reddit posts under Joe's "Community", the
// article's pre-fork date (git blame 6ef6ceb1, fadcf8e4, da91e144, b19d0b45).
{
  const FORK = '2026-04-07'
  const careerOps = read('src/career-ops-i18n.ts')
  const date = careerOps.match(/date: '([A-Z][a-z]{2} \d{1,2}, \d{4})'/)?.[1]
  check(`career-ops article date is not before the fork (got "${date}")`, !!date && new Date(`${date} UTC`).toISOString().slice(0, 10) >= FORK)
  const registry = read('src/articles/registry.ts')
  const coEntry = registry.slice(registry.indexOf("i18nFile: 'src/career-ops-i18n.ts'"), registry.indexOf("id: 'hermes'"))
  const published = coEntry.match(/datePublished: '(\d{4}-\d{2}-\d{2})'/)?.[1]
  check(`career-ops datePublished is not before the fork (got "${published}")`, !!published && published >= FORK)
  for (const rel of ['src/articles/registry.ts', 'src/about-i18n.ts', 'src/CareerOps.tsx', 'src/career-ops-i18n.ts']) {
    check(`${rel}: no santifer Reddit post presented as Joe's`, !/reddit\.com\/r\/(?:SideProject|ClaudeAI)\/comments\/(?:1rw1lg4|1sd2f37)/.test(read(rel)))
  }
  check("CareerOps.tsx: the hero screenshot is credited to santifer, not captioned as Joe's 516 offers",
    !/516 evaluated offers/.test(read('src/CareerOps.tsx')) && /santifer/.test(read('src/CareerOps.tsx')))
}
// The About page's Career-Ops card: its description itself credits santifer
// and says Joe did not build it (a credit only in the card's name would let
// the description call it Joe's pipeline).
{
  const card = read('src/about-i18n.ts').split('\n').find((l) => /name: 'Career[- ]?Ops/i.test(l)) || ''
  const desc = card.match(/desc: '((?:[^'\\]|\\.)*)'/)?.[1] || ''
  check(`About Career-Ops card description credits santifer: "${desc.slice(0, 70)}"`, /santifer/.test(desc) && /did not build/.test(desc))
}
// On cloudyjoe, every line that names Career-Ops carries its credit.
for (const { label, text } of [
  { label: 'chatbot-prompt.txt', text: read('chatbot-prompt.txt') },
  { label: 'public/llms.txt', text: read('public/llms.txt') },
  { label: 'src/about-i18n.ts', text: read('src/about-i18n.ts') },
  ...consumers.filter((c) => c.id === 'cloudyjoe').map((c) => ({ label: `cloudyjoe ${c.mode}`, text: c.text })),
]) {
  for (const line of text.split('\n').filter((l) => /career[- ]?ops/i.test(l))) {
    check(`${label}: Career-Ops line credits santifer: "${line.trim().slice(0, 70)}"`, /santifer|did not build|not authored/i.test(line))
  }
}
check('llms.txt credits the cv-santiago template on the cv-joseph entry', /### cv-joseph[^\n]*\n[^\n]*cv-santiago/.test(read('public/llms.txt')))
check('llms.txt carries the Shopify merch store', read('public/llms.txt').includes('shopify.cbarrgs.com'))

// --- (iv) a search that finds nothing does not dead-end -------------------------------
// The rule's MEANING is pinned, not only its presence: reverting it to the old
// dead end ("say exactly that you don't have that detail") is the behaviour
// behind the Shopify miss, and a presence check would still pass.
for (const [mode, rule] of Object.entries(work.NO_RESULT_RULE) as [string, string][]) {
  check(`NO_RESULT_RULE.${mode} checks the list before giving up`,
    /first check this list|answer from this list/.test(rule) && /adding nothing/.test(rule))
  check(`NO_RESULT_RULE.${mode} says "don't have that detail" only after the list fails`,
    /Only (?:when|if) [^.]*(?:neither|not cover)[^.]*, say you don't have that detail/.test(rule) &&
    rule.indexOf("don't have that detail") > rule.search(/first check this list|answer from this list/))
  check(`NO_RESULT_RULE.${mode} is not the old dead end`, !/say exactly/i.test(rule))
}
for (const id of PERSONAS) {
  const p = persona(id)
  check(`${id} voice instructions carry the no-result rule`, voiceInstructions(p).includes(work.NO_RESULT_RULE.voice))
  check(`${id} voice tool rule lets an empty search fall back to the work list`,
    /When a search finds nothing on point, answer from the "Joe's work" list if it covers the question, never adding to it/.test(p.searchTool.voiceRule))
  check(`${id} text prompt carries the no-result rule`, p.prompt.includes(work.NO_RESULT_RULE.text))
  check(`${id} text noResults points at the work list, inside its lines`,
    p.searchTool.noResults.includes(`"${work.WORK_TEXT_HEADING}" list`) && /staying inside its lines/.test(p.searchTool.noResults))
  check(`${id} text noResults still forbids fabrication`, /MUST NOT/.test(p.searchTool.noResults))
}
check('cloudyjoe voice no longer parrots "I don\'t have that detail" without checking the list',
  !/If it says "I don't have that detail", say exactly that/.test(voiceInstructions(persona('cloudyjoe'))))
check('jts voice: "not on the site" only after an empty search AND the list does not cover it',
  /No relevant content found" THIS turn and that list does not cover it either/.test(persona('jts').voicePrompt))
check('cloudyjoe text fallback line checks the work list first',
  /If search_portfolio finds nothing on point, answer from the work list above/.test(read('chatbot-prompt.txt')))

// --- (v) retrieval: the cloudyjoe query bridge ---------------------------------------
const MUST_MAP: [string, string][] = [
  ['Can he do a Shopify store?', 'Cbarrgs'],
  ['Can Joe build a store for a musician selling t-shirts and stickers?', 'Cbarrgs'],
  ['I want to sell merch online', 'Cbarrgs'],
  ['does he do e-commerce', 'Cbarrgs'],
  ['can he set up an online shop for my band', 'Cbarrgs'],
  ['can it text my cleaners when a guest checks out', 'turnover'],
  ['vacation rental turnovers', 'turnover'],
  ['has he built anything for a hair salon', 'Archive'],
  ['a coaching app for skaters', 'skate'],
  // Only the explicit Shopify trigger matches these two.
  ['Does he know Shopify?', 'Cbarrgs'],
  ['any shopify experience', 'Cbarrgs'],
  ['Can Joe build websites for musicians?', 'Cbarrgs'],
  ['Has Joe built a directory site?', 'RenFaire'],
]
for (const [q, term] of MUST_MAP) {
  const e = rag.expandDocumentsQuery(q)
  check(`expands "${q}" toward ${term}`, e.keyword.includes(term) && e.semantic.includes(term))
  check(`  ...keeps the visitor's words in front`, e.keyword.startsWith(q) && e.semantic.startsWith(q))
  // websearch_to_tsquery: the visitor's words stay ANDed; added terms are OR alternatives.
  check(`  ...adds terms as OR alternatives for the keyword leg`, e.keyword.slice(q.length).startsWith(' or '))
}
for (const q of ['when will it be on the App Store', 'how do you store my data', 'is it on the Play Store', 'what is his background', 'hello']) {
  const e = rag.expandDocumentsQuery(q)
  check(`leaves "${q}" alone`, e.keyword === q && e.semantic === q)
}
// Ordinary recruiter and visitor questions that share a common word with a
// work item ("clean", "host", "coach", "directory", "artist", "the store") must
// not pull that item's rows into the top results (review, 2026-10-02).
const LEAVE_ALONE: [string, string][] = [
  ['Does Joe write clean code?', 'turnover-agent'],
  ['Who hosts this site?', 'turnover-agent'],
  ['Does he host his own models?', 'turnover-agent'],
  ['What are his short-term goals?', 'turnover-agent'],
  ['Can he build a Stripe checkout?', 'turnover-agent'],
  ['car rental fleets', 'turnover-agent'],
  ['fleet checkouts at Google', 'turnover-agent'],
  ['What was staff turnover like at Uber?', 'turnover-agent'],
  ['Is he coachable?', 'skate-workshop-app'],
  ['Does he coach his team?', 'skate-workshop-app'],
  ['tricks for prompt engineering', 'skate-workshop-app'],
  ['Does he know Active Directory?', 'renfaire-guide'],
  ['GitHub directory of projects', 'renfaire-guide'],
  ['Is the skate app in the store yet?', 'cbarrgs-shop'],
  ['Is the app on the store?', 'cbarrgs-shop'],
  ['Is Archive in the store?', 'cbarrgs-shop'],
  ['coffee shop', 'cbarrgs-shop'],
  ['repair shop', 'cbarrgs-shop'],
  ['Can he build a site for a coffee shop?', 'cbarrgs-shop'],
  ['Is Joe an artist?', 'cbarrgs-site'],
  ['What kind of music does Joe like?', 'cbarrgs-site'],
  ['sensor bands', 'cbarrgs-site'],
  ['the beauty of composable agents', 'archive-salon-app'],
]
for (const [q, id] of LEAVE_ALONE) {
  const e = work.expandWorkQuery(q)
  check(`"${q}" does not pull in ${id}${e.matched.includes(id) ? ` (adds: ${e.terms.join(', ')})` : ''}`, !e.matched.includes(id))
}
check('expansion is safe on empty input', rag.expandDocumentsQuery('').keyword === '' && rag.expandDocumentsQuery(undefined).keyword === '')

// The bridge is wired into the real search, both legs: the embedding gets the
// semantic form, hybrid_search and keyword_search get the keyword form.
{
  const realFetch = globalThis.fetch
  const calls: { url: string; body: any }[] = []
  globalThis.fetch = (async (url: any, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : null
    calls.push({ url: String(url), body })
    if (String(url).includes('voyageai.com')) {
      return new Response(JSON.stringify({ data: [{ embedding: new Array(512).fill(0.01) }], usage: { total_tokens: 5 } }), { status: 200 })
    }
    return new Response('[]', { status: 200 })
  }) as typeof fetch
  try {
    delete process.env.VOYAGE_API_KEY
    await rag.searchPortfolio('Can he do a Shopify store?', null, null, persona('cloudyjoe'))
    const kw = calls.find((c) => c.url.includes('/rpc/keyword_search'))
    check('keyword mode: keyword_search gets the expanded query', !!kw && /or Cbarrgs/.test(kw.body?.query_text || ''))
    calls.length = 0
    process.env.VOYAGE_API_KEY = 'stub-voyage'
    await rag.searchPortfolio('a store for a musician selling t-shirts', null, null, persona('cloudyjoe'))
    const emb = calls.find((c) => c.url.includes('voyageai.com'))
    const hy = calls.find((c) => c.url.includes('/rpc/hybrid_search'))
    check('hybrid mode: the embedding sees the added terms', !!emb && /Cbarrgs/.test(emb.body?.input || ''))
    check('hybrid mode: hybrid_search gets the OR-expanded keyword query', !!hy && /or Cbarrgs/.test(hy.body?.query_text || ''))
  } finally {
    globalThis.fetch = realFetch
    delete process.env.VOYAGE_API_KEY
  }
}

// --- fact cards for the next manual rag:sync ------------------------------------------
{
  const cards = factCardChunks()
  check('one fact card per work item, plus a credits card', cards.length === work.WORK_ITEMS.length + 1)
  check('every card sits under the one fact-card article id', cards.every((c: any) => c.metadata.article_id === work.FACT_CARDS_ID))
  for (const id of Object.keys(SPEC)) check(`a fact card exists for ${id}`, cards.some((c: any) => c.metadata.section_id === id))
  const shop = cards.find((c: any) => c.metadata.section_id === 'cbarrgs-shop')
  check('the Shopify card carries the words visitors use', !!shop && ['Shopify', 'shopify.cbarrgs.com', 't-shirts', 'sticker', 'merch', 'musician'].every((w) => shop.content.includes(w)))
  check('the Shopify card badges to the Cbarrgs article', shop?.metadata.badge_article_id === 'cbarrgs-agent')
  const badged = rag.extractSources([shop])
  check('a fact card badge resolves to its article route', badged.length === 1 && badged[0].article_id === 'cbarrgs-agent' && badged[0].page_path_en === '/cbarrgs-agent')
  const renfaire = cards.find((c: any) => c.metadata.section_id === 'renfaire-guide')
  check('a card with no cloudyjoe article gets no badge', rag.extractSources([renfaire]).length === 0)
  check('fact cards are labelled as curated facts for the model', /\[Curated fact card: cbarrgs-shop\]/.test(rag.formatChunksForContext([shop])))
  // scripts/ingest-rag.ts splits anything over 1,000 chars, and a split card's
  // tail would hold its wording rule without the fact it qualifies.
  const long = cards.filter((c: any) => c.content.length > 1000).map((c: any) => `${c.metadata.section_id} (${c.content.length})`)
  check(`every fact card fits one ingest chunk (over 1,000: ${long.join(', ') || 'none'})`, long.length === 0)
  // The reasoning model sees the whole card; the spoken fallback must not read
  // the guide lines aloud.
  const turnover = cards.find((c: any) => c.metadata.section_id === 'turnover-agent')
  const forModel = rag.formatChunksForContext([turnover])
  const spoken = rag.formatChunksForContext([turnover], { spoken: true })
  check('the model still sees a card\'s wording rule and phrasings', /Wording rule:/.test(forModel) && /Answers questions like:/.test(forModel))
  check('the spoken form drops them, and the provenance line', !/Wording rule:|Answers questions like:|Source: curated fact card/.test(spoken) && /Telegram-first/.test(spoken))
  const article = { content: 'Answers questions like: a sentence in an article.', metadata: { article_id: 'hermes', section_id: 'intro' } }
  check('the spoken form leaves article chunks untouched', rag.formatChunksForContext([article], { spoken: true }).includes('Answers questions like: a sentence'))
}

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log(`ok — ${work.WORK_ITEMS.length} work items reach all four consumers; ${BANNED.length} refuted claims absent from ${scanned.length} surfaces`)
