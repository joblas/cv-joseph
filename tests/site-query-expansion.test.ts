// The JTS site index is lexical — there are no embeddings for it (see
// `hasEmbeddings` in api/_shared/rag.js, which admits only `kind: 'documents'`),
// so a query can only retrieve a page it shares a rare token with. Visitors ask
// for Joe's work in words the site never prints: "examples", "what else does he
// build", "past projects". Measured against the live index on 2026-09-19:
//
//   search_site_chunks_public('examples of his work', 12)   -> 0 portfolio rows
//   ... + ' portfolio case studies' + the project names      -> 6 rows / 3 case pages
//   search_site_chunks_public('what else does Joe build',12) -> 0 portfolio rows
//   ... expanded                                             -> 7 rows / 3 case pages
//
// `expandSiteQuery` is that bridge, and this file is its contract. It exists
// because chat.js:241 sends whatever the MODEL typed into the tool call — so
// without a deterministic expansion, a correct answer is a coin flip on the
// model happening to guess the word "portfolio".
//
// Imports the cf:prep copy, not api/ directly — rag.js pulls in personas.js,
// which imports the prompts as Vite text modules a bare runner cannot resolve.
import { expandSiteQuery, JTS_CASE_STUDIES } from '../functions/api-src/_shared/rag.js'

let failed = 0
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`  ✗ ${name}`); failed++ }
}

// --- the failing queries from the real 2026-09-19 visitor transcript ---------
const TRANSCRIPT_QUERIES = [
  'examples of his work',
  'Can you find me examples of his work?',
  'Hey, what else does Joe build?',
  'I think I have seen some gramples on the site. of his work. for phones and mobile apps websites',
]
for (const q of TRANSCRIPT_QUERIES) {
  const out = expandSiteQuery(q)
  check(`expands "${q.slice(0, 34)}…"`, out !== q && out.length > q.length)
  check(`  …carries the portfolio vocabulary`, /portfolio/i.test(out) && /case stud/i.test(out))
  check(`  …preserves the visitor's own words`, out.startsWith(q))
}

// --- questions that must NOT be rewritten ------------------------------------
// Control queries verified unchanged against the live index: each already
// retrieves its own page cleanly, so expansion could only add noise.
const LEAVE_ALONE = [
  'how much does the private AI setup cost',
  'how do I get in touch with Joe',
  'what is Google Maps Growth',
  'do you store my data',
]
for (const q of LEAVE_ALONE) {
  check(`leaves "${q.slice(0, 34)}…" untouched`, expandSiteQuery(q) === q)
}

// --- the drift guard ----------------------------------------------------------
// A hand-typed project list rots against the site. On 2026-09-19 an in-flight
// fix told the agent to cite "Turnover Agent", which has 0 of 229 chunks in the
// corpus and no page on joestechsolutions.com. Every name here must be a real
// /portfolio case study; the live check is the jts-persona eval.
check('exactly the four published case studies', JTS_CASE_STUDIES.length === 4)
for (const name of ['Skate Workshop', 'RenFaire Directory', 'Cbarrgs', 'FixBot']) {
  check(`case-study list names ${name}`, JTS_CASE_STUDIES.some((p) => p.includes(name)))
}
check('case-study list does not name the phantom Turnover Agent',
  !JTS_CASE_STUDIES.some((p) => /turnover/i.test(p)))
check('expansion surfaces the real project names',
  JTS_CASE_STUDIES.every((p) => expandSiteQuery('examples of his work').includes(p)))

// --- robustness ---------------------------------------------------------------
check('empty string is safe', expandSiteQuery('') === '')
check('null is safe', expandSiteQuery(null as unknown as string) === '')
check('undefined is safe', expandSiteQuery(undefined as unknown as string) === '')
// The model often already types the magic word; expanding again would just
// dilute the ranking with duplicate tokens.
const already = expandSiteQuery('portfolio')
check('a query that already says portfolio is not double-expanded',
  (already.match(/portfolio/gi) || []).length === 1)

// --- prompt <-> corpus sync --------------------------------------------------
// The two JTS prompts now name projects outright, which is the only way the
// agent can answer "what else does Joe build" when retrieval is thin. That
// makes drift dangerous: a name in a prompt that is not a real case study is an
// instruction to fabricate. Both prompts must name exactly the shipped four.
const { getPersona } = await import('../functions/api-src/_shared/personas.js')
const jts = getPersona('jts')
for (const name of JTS_CASE_STUDIES) {
  check(`text prompt names ${name}`, (jts.prompt || '').includes(name))
}
// The voice prompt is length-constrained, so it carries short forms.
for (const short of ['Skate Workshop', 'RenFaire Directory', 'Cbarrgs Music', 'FixBot']) {
  check(`voice prompt names ${short}`, (jts.voicePrompt || '').includes(short))
}
// Nothing may cite work that does not exist on the site.
for (const phantom of ['Turnover Agent', 'Archive Salon', 'Fairway']) {
  check(`text prompt does not cite ${phantom}`, !(jts.prompt || '').includes(phantom))
  check(`voice prompt does not cite ${phantom}`, !(jts.voicePrompt || '').includes(phantom))
}
// The tool description is the gate on whether the model searches at all.
const desc = jts.searchTool.description
check('tool description names the portfolio', /portfolio/i.test(desc))
check('tool description names case studies', /case stud/i.test(desc))
check('tool description lists the examples trigger', /examples of/i.test(desc))
// No prompt may state a project's status as a curated fact: /portfolio and
// /portfolio/skate-workshop disagree ("Live ... Android builds rolling" vs
// "Development is paused"), and a curated fact overrides the retrieved page.
for (const claim of ['Android builds rolling', 'Live on iOS']) {
  check(`text prompt does not hard-code the disputed status "${claim}"`,
    !(jts.prompt || '').includes(claim))
  check(`voice prompt does not hard-code the disputed status "${claim}"`,
    !(jts.voicePrompt || '').includes(claim))
}

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('ok — site query expansion bridges visitor vocabulary to the lexical index')
