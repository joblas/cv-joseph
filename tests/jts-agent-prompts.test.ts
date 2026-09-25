// The JTS agent's prompts, pinned against the conversation that exposed them.
//
// On 2026-09-25 Joe pasted a real exchange with the joestechsolutions.com voice
// agent. Replayed against production, every bad line traced to either the
// broken voice search (tests/rag-search-voice.test.ts) or a sentence in these
// prompts. This file guards the prompt half. For a prompt the wording IS the
// behaviour, so each check below names the line the agent actually said.
//
// Loads the cf:prep copy: the source imports the prompts as text modules (a
// Vite feature) that a bare runner cannot resolve. `npm run test:agent-prompts`
// runs cf:prep first.
import { readFileSync } from 'node:fs'
const { getPersona } = await import('../functions/api-src/_shared/personas.js')
const jts = getPersona('jts')
const voice: string = jts.voicePrompt || ''
const text: string = jts.prompt || ''
const voiceRule: string = jts.searchTool.voiceRule || ''

let failed = 0
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`  ✗ ${name}`); failed++ }
}
check('prompts loaded (a missing prompt would pass every "absent" check vacuously)',
  voice.length > 500 && text.length > 500 && voiceRule.length > 50)

// --- "You can book that right on the site! ... schedule and purchase it." -----
// Checkout has been off since the pricing change (private-ai-setup/page.tsx:
// "Checkout funnel paused — all inquiries go through contact until pricing
// returns"). The agent was sending ready-to-buy visitors to a page where they
// could neither buy nor schedule.
for (const [name, p] of [['voice', voice], ['text', text]] as const) {
  check(`${name} prompt no longer claims "the one product with online checkout"`,
    !/one product with online checkout/i.test(p))
  check(`${name} prompt no longer sends people to /private-ai-setup to buy`,
    !/point people to \/private-ai-setup/i.test(p))
  check(`${name} prompt states plainly that checkout isn't available`,
    /checkout[^.]{0,80}isn't available/i.test(p))
}
check('neither prompt volunteers the internal reason (pricing being reworked)',
  !/pricing is reworked/i.test(voice) && !/pricing is reworked/i.test(text))
check('text prompt rule 5 no longer permits booking "through ... the Private AI Setup checkout"',
  !/Private AI Setup checkout/i.test(text))

// --- "Honestly, I've told you everything I know about it right now." ----------
check('voice brevity cap is no longer absolute ("max 2-3 punchy sentences")',
  !/Responses VERY short: max 2-3 punchy sentences/.test(voice))
check('voice prompt treats a request for more as a request for depth',
  /request for more is a request for depth/i.test(voice) && /Never answer a request for more with less/.test(voice))
// An absolute "never say that's everything" would be its own lie when the site
// truly has nothing more — review found it left the agent only padding or
// invention. The rule is: search again first; only then may you say so.
check('voice prompt: a repeat ask gets a fresh search BEFORE any "that\u2019s all"',
  /search again with different words BEFORE concluding there is nothing more/.test(voice))
check('voice prompt: an honest exit exists, and padding is forbidden',
  /that's what the site covers and Joe can go deeper by email/.test(voice) && /never pad or invent/.test(voice))
// The search step used to cap its answer at 2-3 sentences, starving the voice
// agent of material exactly when a caller asked for more.
const ragSearchSrc = readFileSync(new URL('../functions/api-src/rag-search.js', import.meta.url), 'utf8')
check('the search step no longer caps its answer at 2-3 sentences', !/Max 2-3 sentences/.test(ragSearchSrc))
check('the search step forbids padding to reach a length', /never pad to reach a length/.test(ragSearchSrc))

// --- "I don't have more details listed on the site at the moment." ------------
// That line was the prompt's own scripted uncertainty response, delivered after
// a search that had FAILED, not one that came back empty.
check('the scripted brush-off is gone',
  !/I don't have that on the site, but leave your email/.test(voice))
check('voice prompt only permits "not on the site" after an EMPTY search this turn',
  /No relevant content found" THIS turn/.test(voice))
check('voice prompt separates a failed search from an empty one',
  /If a search fails[^.]*never that it doesn't exist/.test(voice))
check('voice tool rule: a follow-up needs a fresh search',
  /Follow-ups count/.test(voiceRule) && /ALWAYS need a fresh search/.test(voiceRule))

// --- "Honestly, I couldn't tell you exactly what he's up to right now." -------
// The text prompt always knew who Joe is; the voice prompt had no identity at
// all. The text agent answered "What's up with Joe?" well 6/6 times; the voice
// agent drew a blank.
check('voice prompt has an About Joe section', /## About Joe\n/.test(voice))
// Matches the live site ("san diego · working across the us"). An earlier draft
// said Escondido, which appears nowhere on the site.
for (const fact of ['Forward Deployed Engineer', 'based in San Diego', 'working across the US', 'small businesses']) {
  check(`voice prompt knows: ${fact}`, voice.includes(fact))
}
check('voice and text prompts state the same identity line',
  /solo Forward Deployed Engineer based in San Diego, working across the US/.test(voice) &&
  /solo Forward Deployed Engineer based in San Diego, working across the US/.test(text))
check('neither prompt names a location the site does not', !/Escondido/.test(voice) && !/Escondido/.test(text))

// --- Adding two projects must not leave the prompt's own framing wrong -------
// Review (B2): the text prompt still said "the four projects" over a list of
// six, and that /portfolio held "all of them" when it lists four.
check('text prompt carries no stale project count', !/The four projects|none of the four/.test(text))
check('text prompt no longer claims /portfolio holds every project', !/All of them together: \/portfolio/.test(text))
check('text prompt sends people to each project\u2019s own page', /Each project's own page is linked above/.test(text))

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('ok — prompts carry none of the transcript’s failures')
