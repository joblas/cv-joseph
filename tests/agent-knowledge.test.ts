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
// A work item field is a string or { cloudyjoe, jts } (work.js pick()).
const pick = (v: any, id: string): string => (v && typeof v === 'object' ? v[id] ?? v.cloudyjoe : v) ?? ''

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

// The work list is the LAST thing in each text prompt (2026-10-03). Ollama Cloud
// caches a prompt only up to its first changed token, and work.js is the part
// that changes most: placed early (11% into jts, 21% into cloudyjoe) every new
// item threw away most of the cached prompt. At the end, an edit there keeps
// everything before it. Nothing may refer to the list as "above" any more.
for (const id of PERSONAS) {
  const text = persona(id).prompt.trimEnd()
  check(`the ${id} text prompt ends with the work list`, text.endsWith(work.workTextBlock(id).trimEnd()))
  check(`the ${id} prompt file keeps the work marker as its last line`,
    read(id === 'cloudyjoe' ? 'chatbot-prompt.txt' : 'jts-prompt.txt').trimEnd().endsWith(work.WORK_MARKER))
}
for (const file of ['chatbot-prompt.txt', 'jts-prompt.txt']) {
  check(`${file} never calls the work list "above"`, !/(?:work list|shipped projects|one-line details)\s+above\b/i.test(read(file)))
}

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
  'openclaw-migration': ['that Joe built OpenClaw', 'zero downtime'],
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
// Case-insensitive with letter boundaries, so a name inside a lowercase URL
// slug ("nick-cleaning-assistant", "/van-setup-guide.html") counts as naming,
// and so does its possessive or plural form, with or without the apostrophe
// ("Van's", "vans-archive-hair-salon-questionaire", "joblas/vans-app").
const word = (w: string) => new RegExp(`(?<![A-Za-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:['’]?s)?(?![A-Za-z])`, 'i')
for (const [text, name] of [
  ['Links: https://joestechsolutions.github.io/vans-archive-hair-salon-questionaire/', 'Van'],
  ['https://github.com/joblas/vans-app', 'Van'],
  ["Van's salon", 'Van'],
  ['/van-setup-guide.html', 'Van'],
  ['nick-cleaning-assistant', 'Nick'],
] as const) check(`the naming check catches "${name}" in "${text}"`, word(name).test(text))
for (const [text, name] of [['caravans', 'Van'], ['vanilla', 'Van'], ['Nickel', 'Nick']] as const) {
  check(`the naming check does not fire on "${text}"`, !word(name).test(text))
}
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
    // Each part too, so "ryan-adams" or "zw-home" in a slug counts.
    const hit = word(n).test(s.text) || n.split(' ').length > 1 && word(n.replace(/ /g, '-')).test(s.text)
    check(`${s.label} never names ${n}`, !hit)
  }
}
// JTS: no day job, no Career-Ops, no first names. Every JTS surface the model
// is handed, the search tool's own strings included.
for (const s of namingSurfaces.filter((x) => x.id === 'jts')) {
  check(`${s.label} never names Joe's employer`, !/quadient/i.test(s.text))
  check(`${s.label} never mentions Career-Ops`, !/career[- ]?ops/i.test(s.text))
}
// EXCLUDE items never appear in any work list.
const EXCLUDED = ['Self-Healing Chatbot', 'Semantic Galaxy', 'Wiki Graph', 'Maps Growth', 'Hermes Forge', 'Bootloader',
  'College Selector', 'Fairway', 'Sellerdoor', 'Gibbon', 'SyncLyst', 'ZenFu', 'jts-mail', 'cold-email', 'Cloud Infrastructure']
for (const id of PERSONAS) {
  const blocks = work.workTextBlock(id) + work.workVoiceBlock(id)
  for (const x of EXCLUDED) check(`${id} work list never lists ${x}`, !blocks.toLowerCase().includes(x.toLowerCase()))
}
// ...nor in the copy this change edits (prompts, llms.txt, the articles and
// their registry). Two names stay, by decision: the Self-Healing Chatbot
// article's related links and registry entry (its fate is Joe's call) and the
// "Cloud Infrastructure" card (out of scope, Joe's call).
const COPY_FILES = ['chatbot-prompt.txt', 'jts-prompt.txt', 'public/llms.txt', 'api/_shared/personas.js', 'api/voice-token.js',
  'src/turnover-agent-i18n.ts', 'src/archive-beta-loop-i18n.ts', 'src/cbarrgs-agent-i18n.ts', 'src/skate-workshop-loop-i18n.ts',
  'src/openclaw-i18n.ts', 'src/career-ops-i18n.ts', 'src/about-i18n.ts', 'src/articles/registry.ts']
const KEPT_BY_DECISION = ['Self-Healing Chatbot', 'Cloud Infrastructure']
for (const rel of COPY_FILES) {
  const text = read(rel).toLowerCase()
  for (const x of [...EXCLUDED.filter((n) => !KEPT_BY_DECISION.includes(n)), 'hermes-forge', 'ai-platform-bootloader']) {
    check(`${rel} never points at the EXCLUDE item ${x}`, !text.includes(x.toLowerCase()))
  }
}
check("work.js copy has no em dash (Joe's rule for new copy)", !read('api/_shared/work.js').includes('—'))
// An item's own copy never says what its own wording rule forbids (the Archive
// line once could say "iOS and Android" next to a note banning exactly that).
// Literal phrases only: a leading "that " is dropped ("that Joe built
// OpenClaw" -> "Joe built OpenClaw"); descriptive rules ("any traffic figure")
// never match literally and are covered by BANNED below.
for (const item of work.WORK_ITEMS) {
  const copy = PERSONAS.flatMap((id) => [pick(item.name, id), pick(item.line, id), pick(item.short, id)]).join('\n').toLowerCase()
  for (const a of item.avoid || []) {
    const phrase = a.replace(/^that\s+/i, '').toLowerCase()
    // A negated mention ("not on the App Store") states the rule, not the claim.
    const asserted = [...copy.matchAll(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))]
      .filter((m) => !/\b(?:not|never|no|nor)\s+$/.test(copy.slice(Math.max(0, m.index! - 8), m.index)))
    check(`${item.id}'s own copy never says its banned "${phrase}"`, asserted.length === 0)
  }
}

// --- (ii) the Shopify / Cbarrgs merch fact, both personas, both modes -------------
// The store's catalogue, not its stock: on 2026-10-02 the pin and the sticker
// pack were sold out, so the spoken line says "with", never "selling".
{
  const shopItem = work.WORK_ITEMS.find((i: any) => i.id === 'cbarrgs-shop')
  for (const id of PERSONAS) {
    // The spoken line only: the text line's "a musician selling t-shirts" is the visitor's case.
    check(`cbarrgs-shop (${id} voice) does not say the store is selling its items today`, !/\b(?:selling|sells|in stock)\b/i.test(pick(shopItem?.short, id)))
  }
}
for (const c of consumers) {
  for (const fact of ['Shopify', 'shopify.cbarrgs.com', 't-shirts', 'sticker', 'Cbarrgs', 'set up']) {
    check(`${c.id} ${c.mode} knows the merch store: "${fact}"`, c.text.includes(fact))
  }
}
// "Yes" on the Shopify line itself: both text prompts say "yes" elsewhere, so
// a whole-prompt check could not see the line lose it.
{
  const shopItem = work.WORK_ITEMS.find((i: any) => i.id === 'cbarrgs-shop')
  for (const c of consumers) {
    const line = shopItem ? (c.mode === 'text' ? work.renderTextLine(shopItem, c.id) : work.renderVoiceLine(shopItem, c.id)) : ''
    check(`${c.id} ${c.mode} answers the musician question with yes, on the Shopify line`,
      c.text.includes(line) && /musician/.test(line) && /\byes\b/i.test(line))
  }
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
  [/\b33 (?:outbound )?(?:sms|texts)\b|outbound sms to cleaners|plain sms (?:for|to|through)|cleaners get (?:ordinary |plain )?text messages/i, 'the 33-SMS figure / plain SMS to cleaners'],
  [/career[- ]?ops\s*(?:—|–|-|:)\s*ai job[- ]search pipeline/i, "Career-Ops listed as Joe's own project"],
  // Who wrote what (audit #0 Career-Ops, #1 Hermes, #6 OpenClaw), with any
  // verb of authorship, in either order. Joe ran a setup on the open-source
  // OpenClaw runtime, configures Nous Research's Hermes runtime and runs a fork
  // of santifer's Career-Ops; he wrote none of the three.
  [/\b(?:joe|joseph|he|i)\s+(?:(?:first|originally|personally|single-handedly|himself|myself)\s+)?(?:built|created|wrote|authored|developed|coded|made)\s+(?:(?:the|his|my|an?)\s+)?(?:open[- ]source\s+)?(?:openclaw|hermes(?:[- ]agent)?(?:\s+runtime)?\s+(?:himself|myself|from scratch)|hermes(?:[- ]agent)?\s+runtime|hermes-agent|hermes\b(?!\s+(?:back office|setup|install|agent setup|agent for|agent on))|career[- ]?ops)/i,
    'authorship of OpenClaw, the Hermes runtime or Career-Ops (Joe runs them; he did not write them)'],
  [/\b(?:openclaw|hermes(?:[- ]agent)? runtime|hermes-agent|career[- ]?ops)\b[^.\n]{0,60}\b(?:i|he|joe|joseph)\s+(?:(?:first|originally|personally)\s+)?(?:built|created|wrote|authored|developed|coded)\b|built and operated openclaw|systems i built from scratch/i,
    'authorship of OpenClaw, the Hermes runtime or Career-Ops, claim after the name'],
  [/\b(?:tool|system|pipeline|platform|runtime|framework)\s+(?:that\s+)?(?:i|he|joe|joseph)\s+(?:built|created|wrote|authored|developed|coded)\b/i,
    '"the tool / system / pipeline I built" (the phrasing that claimed Career-Ops; write "I run", "I configured", or name the item)'],
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
  [/agentic observability with langfuse|every autonomous pipeline decision traced|custom operations dashboard|openai[^\n]{0,20}\(?realtime/i, 'Langfuse / OpenAI Realtime self-description (production has neither)'],
  [/github\.com\/joblas\/mempalace/i, 'the MemPalace link (404; MemPalace is not his)'],
  [/deepseek-v4-flash/i, 'the retired deepseek-v4-flash model'],
  [/dall-e[^\n]{0,80}\bproduction\b|production ai image generation|dall-e[^\n]{0,40}live web application/i, 'DALL-E as a production app (a 2023 tutorial demo)'],
  [/lurkr \((?:me|himself)\)|\bi operate as cto\b/i, '"Lurkr (me)" (Lurkr is Joe\'s orchestrator agent)'],
  [/crm automation, invoicing|email routing, crm automation|invoicing and payments/i, 'CRM automation and invoicing (records show neither)'],
  [/local-first on his own hardware|all self-hosted/i, '"local-first" / "all self-hosted" (models run mostly on Ollama Cloud)'],
  [/\b(?:three|3) live client deployments/i, '"three live client deployments" (three active builds, one in beta)'],
  [/production web and mobile (?:apps|applications)/i, 'production mobile apps (every mobile app is TestFlight beta)'],
  [/private ai deployment/i, '"private AI deployment" as delivered work (no delivery on record)'],
  [/your words about your projects|airtable structures|content you retrieve with search_portfolio was written by joe/i, 'first-person attribution of retrieved text'],
  [/no discovery calls/i, '"no discovery calls" (JTS offers a booking link)'],
  [/\bfaires?\b[^.\n]{0,40}\bacross the (?:us|u\.s\.|united states|country)\b/i, 'RenFaireGuide as US-only (about 650 of its 700+ faires are in the US, the rest abroad)'],
  [/\bopenclaw\s+(?:was|is)\s+(?:his|my|joe'?s|joseph'?s)\b|\b(?:his|my|joe'?s|joseph'?s)\s+(?:own\s+)?openclaw\s+(?:system|platform|framework|runtime)\b/i, 'OpenClaw as Joe\'s own system (it is the open-source runtime his setup ran on)'],
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
// --- (iii-b) Joe's 2026-10-02 decisions on contact and AV wording, bot surfaces only ---
// Joe's own answers (2026-10-02): no phone number anywhere the bot speaks from
// (email only); "part of the team that built Firefly", never "built Firefly
// from the ground up", and Firefly never dated to 2009 (the vehicle came later);
// Otto's October 2016 run is an "autonomous beer delivery in Colorado", with no
// Guinness record, no "driverless" and no "world's first commercial delivery";
// Pronto's demo is "cross-country, San Francisco to New York", with no mileage
// figure; Pronto's founder is never named.
// Scope: what the bot is handed or retrieves. The prompts, the voice prompt
// file, personas and the work list raw; public/llms.txt (written for AI
// agents); every article source the registry marks ragReady; and the composed
// prompts, search-tool strings and fact cards. NOT src/i18n.ts or
// src/about-i18n.ts: the visible homepage and About copy are Joe's separate
// call, and they still carry some of these phrases on purpose.
let decidedSummary = ''
{
  const { articleRegistry }: any = await import('../src/articles/registry.ts')
  const ragSources: string[] = articleRegistry.filter((a: any) => a.ragReady && a.i18nFile).map((a: any) => a.i18nFile)
  check(`the registry still marks the article sources ragReady (got ${ragSources.length}; none would pass every ban vacuously)`, ragSources.length >= 7)
  const BOT_FILES = ['chatbot-prompt.txt', 'jts-prompt.txt', 'api/voice-token.js', 'api/_shared/personas.js', 'api/_shared/work.js',
    'public/llms.txt', ...ragSources]
  for (const rel of ['src/i18n.ts', 'src/about-i18n.ts']) check(`${rel} (visible site copy) is not a bot surface here`, !BOT_FILES.includes(rel))
  const botSurfaces: { label: string; text: string }[] = [
    ...BOT_FILES.map((rel) => ({ label: rel, text: read(rel) })),
    ...consumers.map((c) => ({ label: `${c.id} ${c.mode} (composed)`, text: c.text })),
    ...PERSONAS.map((id) => {
      const t = persona(id).searchTool
      return { label: `${id} search tool`, text: [t.description, t.voiceDescription, t.noResults, t.voiceRule].join('\n') }
    }),
    { label: 'fact cards', text: factCardChunks().map((c: any) => c.content).join('\n') },
  ]
  const DECIDED: [RegExp, string][] = [
    [/\(?\b408\)?[\s.-]*401[\s.-]*9943\b|\b4084019943\b/, "Joe's phone number (email only)"],
    [/guinness/i, 'a Guinness World Record for the Otto delivery (no source)'],
    [/\b2,900\b|\b2900[\s-]*miles?\b/i, 'the 2,900-mile Pronto figure (say cross-country, San Francisco to New York)'],
    [/levandowsk|\banthony\s+l\b/i, "Pronto.ai's founder by name"],
    [/firefly[^.\n]{0,80}\bground[- ]up\b|\bground[- ]up\b[^.\n]{0,80}firefly/i, '"built Firefly from the ground up" (part of the team that built Firefly)'],
    [/world['’]?s first commercial/i, '"world\'s first commercial delivery" for the Otto run'],
    [/\b(?:otto|budweiser|beer|truck)\b[^.\n]{0,80}\bdriverless\b|\bdriverless\b[^.\n]{0,80}\b(?:otto|budweiser|beer|truck)/i, 'the Otto delivery as driverless (a driver was aboard)'],
  ]
  // Sentence-scoped: the line before a bullet, or a "2009-2016" span, does
  // not date Firefly; "started in 2009 working on the Firefly vehicle" does.
  const sentencesOf = (text: string) => text.split(/(?<=[.;!?])\s+|\n/)
  const DATED_2009 = /\b2009\b(?!\s*(?:-|–|—|to)\s*(?:20)?\d\d\b)/
  for (const { label, text } of botSurfaces) {
    for (const [re, what] of DECIDED) {
      const m = text.match(re)
      check(`${label}: no ${what}${m ? ` (found "${m[0]}")` : ''}`, !m)
    }
    for (const s of sentencesOf(text).filter((x) => /firefly/i.test(x) && DATED_2009.test(x))) {
      check(`${label}: Firefly is not dated to 2009: "${s.trim().slice(0, 90)}"`, false)
    }
    // Who built Firefly: a team Joe was part of, never Joe alone.
    for (const m of text.matchAll(/\bbuilt\s+(?:google['’]?s\s+|the\s+)?firefly\b/gi)) {
      check(`${label}: "${m[0]}" is credited to the team ("part of the team that built")`,
        /part of the team that\s+$/i.test(text.slice(Math.max(0, m.index! - 30), m.index)))
    }
  }
  // Fixed, not dropped: the cloudyjoe agent still knows the three highlights,
  // in Joe's wording.
  const cjText = consumers.find((c) => c.id === 'cloudyjoe' && c.mode === 'text')?.text ?? ''
  const cjVoice = consumers.find((c) => c.id === 'cloudyjoe' && c.mode === 'voice')?.text ?? ''
  for (const phrase of ["Part of the team that built Google's Firefly", "Otto's October 2016 autonomous beer delivery in Colorado", 'cross-country (San Francisco to New York)']) {
    check(`cloudyjoe text still says "${phrase}"`, cjText.includes(phrase))
  }
  for (const phrase of ["part of the team that built Google's Firefly", 'cross-country autonomous demo, San Francisco to New York']) {
    check(`cloudyjoe voice still says "${phrase}"`, cjVoice.includes(phrase))
  }
  // The model added "driverless" to the Otto run by itself on 2026-10-03, so
  // both cloudyjoe surfaces carry Joe's rule in so many words.
  for (const [where, text] of [['text', cjText], ['voice', cjVoice]] as const) {
    check(`cloudyjoe ${where} tells the model never to call the Otto run driverless`,
      text.includes('Never use the word "driverless" for it, and never call it a world first or a record.'))
  }
  decidedSummary = `; ${DECIDED.length + 2} wording decisions hold on ${botSurfaces.length} bot surfaces (${ragSources.length} ragReady articles)`
  check('the cloudyjoe fallback line gives the email only',
    /the safe default is: "That's a great question for Joe directly — you can reach him at blasj408@gmail\.com\."/.test(read('chatbot-prompt.txt')))
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
// OpenClaw is the open-source runtime; the 22 agents were Joe's setup ON it.
// A sentence that ties OpenClaw to the 22 agents must say so (or the sentence
// before it must): "OpenClaw (22-agent system, 2024-2026)" and "OpenClaw
// worked. It was 22 specialized agents" both pass the authorship bans and
// both say OpenClaw is the 22-agent system. registry.ts carries the article's
// SEO description, so it is scanned here too.
const AGENTS_22 = /\b22[- ](?:specialized |specialised )?agents?\b|\b22-agent\b/i
// "runtime", or OpenClaw itself as what it ran on: "it ran on his own
// machine" or "he ran it on a Mac mini" does not scope it.
const ON_RUNTIME = /runtime|\bran\b[^.!?\n]{0,80}\bon\b[^.!?\n]{0,30}\bopenclaw\b/i
for (const { label, text } of [...scanned, { label: 'src/articles/registry.ts', text: read('src/articles/registry.ts') }]) {
  // The window is the sentence and the one before it on the same line (one
  // field, one paragraph): an h1 under a kicker that names OpenClaw is not a claim.
  for (const line of text.split('\n')) {
    const sentences = line.split(/(?<=[.!?])\s+/)
    sentences.forEach((sentence, i) => {
      if (!AGENTS_22.test(sentence)) return
      const window = [sentences[i - 1] || '', sentence]
      if (!window.some((x) => /openclaw/i.test(x))) return
      check(`${label}: OpenClaw's 22 agents are scoped as a setup on the runtime: "${sentence.trim().slice(0, 90)}"`, window.some((x) => ON_RUNTIME.test(x)))
    })
  }
}
// Money stays out of agent knowledge (prices, fees, pro-bono terms): Joe sets
// those per conversation, and the client-pricing stance is not public.
{
  const MONEY = /\$\s?\d|\bpro[- ]bono\b|\bfree until\b|\bper month\b|\/mo\b|\busd\b/i
  for (const { label, text } of [
    ...consumers.map((c) => ({ label: `${c.id} ${c.mode} (composed)`, text: c.text })),
    ...PERSONAS.map((id) => ({ label: `${id} work blocks`, text: work.workTextBlock(id) + '\n' + work.workVoiceBlock(id) })),
    ...PERSONAS.map((id) => {
      const t = persona(id).searchTool
      return { label: `${id} search tool`, text: [t.description, t.voiceDescription, t.noResults, t.voiceRule].join('\n') }
    }),
    { label: 'fact cards', text: factCardChunks().map((c: any) => c.content).join('\n') },
  ]) {
    const m = text.match(MONEY)
    check(`${label}: no money, price or pro-bono detail${m ? ` (found "${m[0]}")` : ''}`, !m)
  }
}
// The Self-Healing Chatbot article is an EXCLUDE item (santifer's history and
// numbers in Joe's first person). Its fate (ragReady, production rows) is
// Joe's call, but no prompt and no llms.txt entry may point at it.
for (const { label, text } of [
  { label: 'chatbot-prompt.txt', text: read('chatbot-prompt.txt') },
  { label: 'jts-prompt.txt', text: read('jts-prompt.txt') },
  { label: 'public/llms.txt', text: read('public/llms.txt') },
  ...consumers.map((c) => ({ label: `${c.id} ${c.mode} (composed)`, text: c.text })),
]) {
  check(`${label}: never lists the Self-Healing Chatbot`, !/self-healing chatbot/i.test(text))
}
// A section ABOUT Cbarrgs never calls it Next.js, even split across lines (the
// one-line BANNED pattern cannot see "Stack: Next.js" on the next line). The
// prompt files are markdown with the same headings.
for (const rel of ['public/llms.txt', 'chatbot-prompt.txt', 'jts-prompt.txt']) {
  for (const sec of read(rel).split(/^(?=#{1,6} )/m).filter((x) => /^#{1,6} [^\n]*cbarrgs/i.test(x))) {
    check(`${rel} "${sec.split('\n')[0]}" never says Next.js`, !/next\.?js/i.test(sec))
  }
}
{
  const llms = read('public/llms.txt')
  const sections = llms.split(/^(?=#{2,3} )/m)
  // Credit where it is due, where a reader meets the item: a section headed by
  // Hermes or Whisper Walkie, and every non-heading line naming Whisper Walkie
  // or OpenClaw.
  for (const sec of sections.filter((x) => /^#{2,3} (?:Key Achievement: )?Hermes\b/.test(x))) {
    check(`llms.txt "${sec.split('\n')[0]}" credits Nous Research`, /Nous Research/.test(sec))
  }
  for (const sec of sections.filter((x) => /^#{2,3} Whisper Walkie/.test(x))) {
    check(`llms.txt "${sec.split('\n')[0]}" credits the Whisper models and faster-whisper`, /Whisper models/.test(sec) && /faster-whisper/.test(sec))
  }
  for (const line of llms.split('\n').filter((l) => !/^#/.test(l))) {
    if (/whisper walkie/i.test(line)) check(`llms.txt Whisper Walkie line credits faster-whisper: "${line.slice(0, 70)}"`, /faster-whisper/.test(line))
    if (/openclaw/i.test(line)) check(`llms.txt OpenClaw line says it is a runtime he ran a setup on: "${line.slice(0, 70)}"`, /runtime/i.test(line))
  }
}
{
  const about = read('src/about-i18n.ts').split('\n')
  const card = (name: string) => about.find((l) => l.includes(`name: '${name}'`)) || ''
  check('About: the Whisper Walkie card credits the Whisper models and faster-whisper', /Whisper models/.test(card('Whisper Walkie')) && /faster-whisper/.test(card('Whisper Walkie')))
  check('About: the Hermes card credits Nous Research', /Nous Research/.test(card('Hermes')))
  check('About: the "What is Hermes?" answer credits Nous Research', /Nous Research/.test(about.find((l) => l.includes("q: 'What is Hermes?'")) || ''))
  check('About: the bio\'s "That stack is Hermes" credits Nous Research', /Nous Research/.test(about.find((l) => l.includes('That stack is Hermes')) || ''))
  for (const line of about.filter((l) => /openclaw/i.test(l))) {
    check(`About: OpenClaw line says it is a runtime he ran a setup on: "${line.trim().slice(0, 70)}"`, /runtime/i.test(line))
  }
}
// Career-Ops screenshots are santifer's: every caption on the page says so.
{
  const captions = [...read('src/CareerOps.tsx').matchAll(/caption=\{'((?:[^'\\]|\\.)*)'\}/g)].map((m) => m[1])
  check(`CareerOps.tsx has its screenshot captions (found ${captions.length})`, captions.length >= 7)
  for (const c of captions) check(`CareerOps.tsx caption credits santifer: "${c.slice(0, 60)}"`, /santifer/.test(c))
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
  check("CareerOps.tsx no longer renders santifer's score distribution and callout as the page's results",
    !/scoring\.distribution|scoring\.callout/.test(read('src/CareerOps.tsx')))
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
  check(`${id} voice tool rule no longer says "answer ONLY from its result" (it contradicts the fallback)`,
    !/answer ONLY from (?:its|the) result/i.test(p.searchTool.voiceRule) && !/answer ONLY from (?:its|the) result/i.test(voiceInstructions(p)))
  check(`${id} text prompt carries the no-result rule`, p.prompt.includes(work.NO_RESULT_RULE.text))
  check(`${id} text noResults points at the work list, inside its lines`,
    p.searchTool.noResults.includes(`"${work.WORK_TEXT_HEADING}" list`) && /staying inside its lines/.test(p.searchTool.noResults))
  check(`${id} text noResults still forbids fabrication`, /MUST NOT/.test(p.searchTool.noResults))
}
// Every voice line that mentions the empty-search reply sends it to the list
// first, and none tells the model to repeat it ("say exactly that" was the
// incident's wording, in the cloudyjoe tool-result rule 5).
for (const id of PERSONAS) {
  const p = persona(id)
  for (const line of (p.searchTool.voiceRule + '\n' + voiceInstructions(p)).split('\n').filter((l: string) => /No relevant content found|don't have that detail/.test(l))) {
    check(`${id} voice: "${line.trim().slice(0, 60)}" does not say to repeat it`, !/say exactly/i.test(line))
    if (/No relevant content found/.test(line)) {
      check(`${id} voice: "${line.trim().slice(0, 60)}" falls back to the work list`, /no-result rule|(?:this|that) list/i.test(line))
    }
  }
}
check('cloudyjoe voice no longer parrots "I don\'t have that detail" without checking the list',
  !/If it says "I don't have that detail", say exactly that/.test(voiceInstructions(persona('cloudyjoe'))))
check('jts voice: "not on the site" only after an empty search AND the list does not cover it',
  /No relevant content found" THIS turn and that list does not cover it either/.test(persona('jts').voicePrompt))
check('cloudyjoe text fallback line checks the work list first',
  /If search_portfolio finds nothing on point, answer from the work list at the end of these instructions/.test(read('chatbot-prompt.txt')))

// --- (v) retrieval: the cloudyjoe query bridge ---------------------------------------
// The bridge feeds the EMBEDDING only. The keyword leg keeps the visitor's
// words (see the wiring checks and scripts/rag-keyword-rank.test.sql).
const MUST_MAP: [string, string][] = [
  ['Can he do a Shopify store?', 'Cbarrgs'],
  ['Can Joe build a store for a musician selling t-shirts and stickers?', 'Cbarrgs'],
  ['I want to sell merch online', 'Cbarrgs'],
  ['does he do e-commerce', 'Cbarrgs'],
  ['can he set up an online shop for my band', 'Cbarrgs'],
  ['can it text my cleaners when a guest checks out', 'turnover'],
  ['vacation rental turnovers', 'cleaner'],
  ['Airbnb cleaning automation', 'turnover'],
  ['VRBO turnovers', 'cleaner'],
  ['has he built anything for a hair salon', 'Archive'],
  ['an inventory app for colorists', 'Archive'],
  ['a coaching app for skaters', 'athlete'],
  ['an app where athletes upload clips for their coach', 'skate'],
  // Only the explicit Shopify trigger matches these two.
  ['Does he know Shopify?', 'Cbarrgs'],
  ['any shopify experience', 'Cbarrgs'],
  ['Can Joe build websites for musicians?', 'Cbarrgs'],
  // The artist / band / DJ branch, which needs a site, store or music word.
  ['Can Joe build a website for my band?', 'Cbarrgs'],
  ['does he make sites for DJs', 'Cbarrgs'],
  ['Has he worked with artists on their websites?', 'Cbarrgs'],
  ['Has Joe built a directory site?', 'RenFaire'],
  // Apparel and stickers with a selling word.
  ['I sell hoodies and stickers, can he help?', 'Cbarrgs'],
  ['Can he set me up to sell t-shirts?', 'Cbarrgs'],
]
for (const [q, term] of MUST_MAP) {
  const e = rag.expandDocumentsQuery(q)
  check(`expands "${q}" toward ${term}`, e.semantic.includes(term) && e.terms.includes(term))
  check(`  ...keeps the visitor's words in front`, e.semantic.startsWith(q))
  check(`  ...offers no keyword form (the keyword leg gets the original)`, !('keyword' in e))
}
for (const q of ['when will it be on the App Store', 'how do you store my data', 'is it on the Play Store', 'what is his background', 'hello']) {
  const e = rag.expandDocumentsQuery(q)
  check(`leaves "${q}" alone`, e.semantic === q && e.terms.length === 0)
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
  ['How many athletes did the self-driving car team have?', 'skate-workshop-app'],
  ['Does he know Active Directory?', 'renfaire-guide'],
  ['GitHub directory of projects', 'renfaire-guide'],
  ['Is the skate app in the store yet?', 'cbarrgs-shop'],
  ['Is the app on the store?', 'cbarrgs-shop'],
  ['Is Archive in the store?', 'cbarrgs-shop'],
  ['coffee shop', 'cbarrgs-shop'],
  ['repair shop', 'cbarrgs-shop'],
  ['Can he build a site for a coffee shop?', 'cbarrgs-shop'],
  ['Can he build a store locator?', 'cbarrgs-shop'],
  ['Can he make a shop finder for my city?', 'cbarrgs-shop'],
  ['Can he build a store hours page?', 'cbarrgs-shop'],
  ['Is Joe an artist?', 'cbarrgs-site'],
  ['What kind of music does Joe like?', 'cbarrgs-site'],
  ['sensor bands', 'cbarrgs-site'],
  ['Tell me about his work with sensor bands and calibration', 'cbarrgs-site'],
  ['a band of sensors he built for calibration', 'cbarrgs-site'],
  ['the beauty of composable agents', 'archive-salon-app'],
  ['Is Joe a stylist?', 'archive-salon-app'],
  ['Is Joe a colorist?', 'archive-salon-app'],
  ['Has Joe worked on sticker detection for perception?', 'cbarrgs-shop'],
  ['Did Joe do T-shirt cannons at Google?', 'cbarrgs-shop'],
]
for (const [q, id] of LEAVE_ALONE) {
  const e = work.expandWorkQuery(q)
  check(`"${q}" does not pull in ${id}${e.matched.includes(id) ? ` (adds: ${e.terms.join(', ')})` : ''}`, !e.matched.includes(id))
}
// No bridge on chatbot questions: the indexed articles already use those
// words, so added terms would only dilute them.
for (const q of ['self-healing chatbot', 'chatbot prompt injection defense', 'How does this chat work?', 'Can Joe build a voice agent?']) {
  const e = work.expandWorkQuery(q)
  check(`"${q}" is left alone (got: ${e.matched.join(', ') || 'none'})`, e.terms.length === 0)
}
check('no work item has a bridge on the agent backend', !work.WORK_ITEMS.find((i: any) => i.id === 'agent-backend')?.expand)
check('expansion is safe on empty input', rag.expandDocumentsQuery('').semantic === '' && rag.expandDocumentsQuery(undefined).semantic === '')

// The bridge is wired into the real search: the embedding gets the semantic
// form; hybrid_search's query_text and keyword_search get the visitor's own
// words. The fixture shared with scripts/rag-keyword-rank.test.sql (which
// checks what Postgres ranks) must match what the code sends, so changing the
// code without the fixture, or the fixture without passing the SQL test, fails.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}
{
  const [header, ...fixture] = parseCsv(read('tests/fixtures/rag-keyword-leg.csv'))
  check('keyword-leg fixture has the columns the SQL test reads', JSON.stringify(header) === JSON.stringify(['query', 'sent', 'bridge_terms', 'doc']))
  check(`keyword-leg fixture has at least 5 questions (got ${fixture.length})`, fixture.length >= 5)
  const realFetch = globalThis.fetch
  const calls: { url: string; body: any }[] = []
  let keywordReplies: string[] = []
  globalThis.fetch = (async (url: any, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : null
    calls.push({ url: String(url), body })
    if (String(url).includes('voyageai.com')) {
      return new Response(JSON.stringify({ data: [{ embedding: new Array(512).fill(0.01) }], usage: { total_tokens: 5 } }), { status: 200 })
    }
    if (String(url).includes('/rpc/keyword_search')) return new Response(keywordReplies.shift() ?? '[]', { status: 200 })
    return new Response('[]', { status: 200 })
  }) as typeof fetch
  try {
    process.env.VOYAGE_API_KEY = 'stub-voyage'
    for (const [query, sent, bridgeTerms] of fixture) {
      calls.length = 0
      await rag.searchPortfolio(query, null, null, persona('cloudyjoe'))
      const e = work.expandWorkQuery(query)
      const emb = calls.find((c) => c.url.includes('voyageai.com'))
      const hy = calls.find((c) => c.url.includes('/rpc/hybrid_search'))
      check(`fixture "${query}": the bridge fires and its terms match the fixture`, e.terms.length > 0 && e.terms.join(' ') === bridgeTerms)
      check(`fixture "${query}": hybrid_search gets exactly the fixture's query_text`, !!hy && hy.body?.query_text === sent)
      check(`fixture "${query}": that query_text is the visitor's own words`, sent === query)
      check(`fixture "${query}": the embedding sees the added terms`, !!emb && emb.body?.input === e.semantic && emb.body.input !== query)
    }
    delete process.env.VOYAGE_API_KEY
    // Keyword-only mode: the visitor's words first; the bridge only when no row
    // shares a single word with them.
    calls.length = 0
    keywordReplies = [JSON.stringify([{ id: 1, content: 'a row', metadata: { article_id: 'hermes', section_id: 'x' }, similarity: 0.1 }])]
    await rag.searchPortfolio('Can he do a Shopify store?', null, null, persona('cloudyjoe'))
    let kw = calls.filter((c) => c.url.includes('/rpc/keyword_search'))
    check('keyword mode: keyword_search gets the visitor\'s words', kw.length === 1 && kw[0].body?.query_text === 'Can he do a Shopify store?')
    calls.length = 0
    keywordReplies = ['[]', '[]']
    await rag.searchPortfolio('Can he do a Shopify store?', null, null, persona('cloudyjoe'))
    kw = calls.filter((c) => c.url.includes('/rpc/keyword_search'))
    check('keyword mode: an empty result retries once with the bridge terms',
      kw.length === 2 && kw[0].body?.query_text === 'Can he do a Shopify store?' && kw[1].body?.query_text === work.expandWorkQuery('Can he do a Shopify store?').semantic)
    calls.length = 0
    keywordReplies = ['[]']
    await rag.searchPortfolio('what is his background', null, null, persona('cloudyjoe'))
    kw = calls.filter((c) => c.url.includes('/rpc/keyword_search'))
    check('keyword mode: no retry when the bridge has nothing to add', kw.length === 1)
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
  // The links line goes too: the spoken path strips URLs and would read the bare labels.
  const shopSpoken = rag.formatChunksForContext([shop], { spoken: true })
  check('the spoken form drops the links line', /Page: https:/.test(rag.formatChunksForContext([shop])) && !/^\s*(?:Page|Links):/m.test(shopSpoken) && !/https?:\/\//.test(shopSpoken.replace(/^---.*$/m, '')))
  // The ingest's Haiku summary reads a chunk's first 500 chars, which for a
  // card can include its "Do not say or imply" line; cards skip the summary.
  check('ingest skips the contextual summary for fact cards', /articleId === FACT_CARDS_ID\s*\?\s*splitChunks\.map\(c => c\.content\)/.test(read('scripts/ingest-rag.ts')))
  const article = { content: 'Answers questions like: a sentence in an article.', metadata: { article_id: 'hermes', section_id: 'intro' } }
  check('the spoken form leaves article chunks untouched', rag.formatChunksForContext([article], { spoken: true }).includes('Answers questions like: a sentence'))
}

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log(`ok — ${work.WORK_ITEMS.length} work items reach all four consumers; ${BANNED.length} refuted claims absent from ${scanned.length} surfaces${decidedSummary}`)
