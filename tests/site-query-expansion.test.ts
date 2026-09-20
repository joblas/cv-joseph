// The JTS site index is lexical — `hasEmbeddings` (api/_shared/rag.js) admits
// only `kind: 'documents'`, and all 229 site_chunks rows have a NULL embedding.
// A page is reachable only through a token it literally contains, and no
// /portfolio chunk contains the word "example". Measured on the live index:
//
//   'examples of his work'      -> 0 portfolio rows -> 6 after expansion
//   'what else does Joe build'  -> 0 portfolio rows -> 7 after expansion
//
// `expandSiteQuery` is that bridge. api/chat.js sends whatever the MODEL typed
// into its tool call, so without it a correct answer is a coin flip on the model
// guessing the word "portfolio".
//
// This file asserts on the function's OUTPUT, not on its constants. An earlier
// version checked only the JTS_CASE_STUDIES array and a handful of literal
// strings; review mutation-tested it and all three mutants passed — appending
// the block 50x, injecting phantom project names into the output, and replacing
// the whole regex with a four-string whitelist. Each of those now fails here.
import { expandSiteQuery, buildSiteSearchArgs, JTS_CASE_STUDIES } from '../functions/api-src/_shared/rag.js'

// Hardcoded ON PURPOSE — this list is the spec, not a mirror of the source.
// Deriving it from JTS_CASE_STUDIES would let a mutation move the goalposts:
// renaming 'FixBot' to 'FixBot Pro' would change expected and actual together
// and the suite would still pass, shipping a product that does not exist.
const EXPECTED_ADDITIONS = ['portfolio', 'case studies',
  'The Skate Workshop', 'RenFaire Directory', 'Cbarrgs Music', 'FixBot']

let failed = 0
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`  ✗ ${name}`); failed++ }
}

// --- must expand: the visitor wants to see past output ------------------------
// The first four are the real 2026-09-19 transcript, including the garbled
// rephrase and a curly apostrophe (iOS keyboards and voice transcription emit
// U+2019, which missed the possessive branch until it was normalised).
const MUST_EXPAND = [
  'examples of his work',
  'Can you find me examples of his work?',
  'Hey, what else does Joe build?',
  'I think I have seen some gramples on the site. of his work. for phones and mobile apps websites',
  'what has Joe done before', 'can I see some of his apps', 'samples of his work',
  'show me his portfolio', 'past projects', 'do you have case studies',
  'joe’s work', 'has he ever built a mobile app', 'what is his track record',
  'show me what he has built', 'who has he worked with',
]
for (const q of MUST_EXPAND) {
  const out = expandSiteQuery(q)
  check(`expands: "${q.slice(0, 38)}"`, out !== q)
  check(`  ...keeps the visitor's words in front`, out.startsWith(q))
  check(`  ...carries the portfolio vocabulary`, /portfolio/i.test(out) && /case stud/i.test(out))
  // Allowlist: the appended text must be EXACTLY the expected terms the query
  // does not already carry. This kills three mutants at once — appending the
  // block 50x, appending one enormous token, and slipping a plausible variant
  // of a real project name ('FixBot Pro') past a known-bad-names denylist.
  const added = out.slice(q.length).trimStart()
  const expected = EXPECTED_ADDITIONS.filter((t) => !q.toLowerCase().includes(t.toLowerCase())).join(' ')
  check(`  ...appends exactly the expected terms and nothing else`, added === expected)
  check(`  ...stays within a sane character budget`, out.length - q.length <= 120)
}

// --- must NOT expand ----------------------------------------------------------
// Mutant 3: a four-string whitelist cannot tell a targeted regex from total
// over-expansion. These are the real cases review found, where expanding the
// query EVICTED the chunk that answered it on the live index — `build`,
// `project` and `made` are this site's core service vocabulary. The pricing
// rows matter most: HARD GUARDRAIL 1 forbids stating a price not in context,
// and expansion deleted kb:Pricing and quotes from rank 1.
const MUST_NOT_EXPAND = [
  'how much is it per project',           // kb:Pricing and quotes was rank 1
  'how long does a project take',
  'how much to build an app',
  'what is a custom build',               // kb:What a Custom Build looks like
  'can you build me a chatbot for my salon',   // a lead, not a portfolio browse
  'is this built on my own server',
  'how is the assistant made secure',
  'who made you',
  'how does the setup work',
  'how much does the private AI setup cost',
  'how do I get in touch with Joe',
  'what is Google Maps Growth',
  'do you store my data',
  'what data do you collect on the projects page',
  'can I email you about a project',
  'makes sense, how do I pay',
]
for (const q of MUST_NOT_EXPAND) {
  check(`leaves untouched: "${q.slice(0, 38)}"`, expandSiteQuery(q) === q)
}

// --- the integration invariant --------------------------------------------
// The RPC must receive the expanded query and the ranker the ORIGINAL one.
for (const q of [...MUST_EXPAND, ...MUST_NOT_EXPAND]) {
  const { rpcQuery, boostQuery } = buildSiteSearchArgs(q)
  check(`ranker keeps the visitor's own query: "${q.slice(0, 30)}"`, boostQuery === q)
  check(`  ...while the RPC gets the expanded one`, rpcQuery === expandSiteQuery(q))
}

// --- robustness ---------------------------------------------------------------
check('empty string is safe', expandSiteQuery('') === '')
check('null is safe', expandSiteQuery(null as unknown as string) === '')
check('undefined is safe', expandSiteQuery(undefined as unknown as string) === '')
check('a query already naming portfolio is not double-expanded',
  (expandSiteQuery('portfolio').match(/portfolio/gi) || []).length === 1)

// --- prompt <-> site sync -----------------------------------------------------
// The prompts now name projects outright, which is how the agent answers when
// retrieval is thin. That makes drift dangerous: a name in a prompt that is not
// a real case study is an instruction to fabricate.
const { getPersona } = await import('../functions/api-src/_shared/personas.js')
const jts = getPersona('jts')
check('case-study list is exactly the four published names, in order',
  JSON.stringify(JTS_CASE_STUDIES) === JSON.stringify(EXPECTED_ADDITIONS.slice(2)))
for (const name of ['Skate Workshop', 'RenFaire Directory', 'Cbarrgs Music', 'FixBot']) {
  check(`case-study list names ${name}`, JTS_CASE_STUDIES.some((p) => p.includes(name)))
  check(`text prompt names ${name}`, (jts.prompt || '').includes(name))
  check(`voice prompt names ${name}`, (jts.voicePrompt || '').includes(name))
}
for (const phantom of ['Turnover Agent', 'Archive Salon', 'Fairway']) {
  check(`text prompt does not cite ${phantom}`, !(jts.prompt || '').includes(phantom))
  check(`voice prompt does not cite ${phantom}`, !(jts.voicePrompt || '').includes(phantom))
}
// /portfolio says "Live on iOS via TestFlight with Android builds rolling";
// /portfolio/skate-workshop says "Development is paused". Because a curated
// fact outranks a retrieved page, neither wording may be hard-coded.
for (const claim of ['Android builds rolling', 'Live on iOS', 'paused', 'Paused']) {
  check(`text prompt does not hard-code disputed status "${claim}"`, !(jts.prompt || '').includes(claim))
  check(`voice prompt does not hard-code disputed status "${claim}"`, !(jts.voicePrompt || '').includes(claim))
}
const desc = jts.searchTool.description
check('tool description names the portfolio', /portfolio/i.test(desc))
check('tool description names case studies', /case stud/i.test(desc))
check('tool description lists the examples trigger', /examples of/i.test(desc))

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log(`ok — ${MUST_EXPAND.length} expand, ${MUST_NOT_EXPAND.length} left alone, prompts in sync with the site`)
