// fixContactEmail (api/_shared/contact-email.js). A MatrAIx simulation against
// the live agent (2026-09-26) caught it writing "joe@joestsolutions.com" for
// joe@joestechsolutions.com — a visitor who emails that is a lost lead. Near
// misses of the persona's contact address become the address; everything
// else, the visitor's own address above all, is left exactly as written.
const { fixContactEmail, editDistance, MAX_EDITS } = await import('../functions/api-src/_shared/contact-email.js')

let failed = 0
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`  ✗ ${name}`); failed++ }
}
const JOE = 'joe@joestechsolutions.com'

check('the exact typo from the simulation is corrected',
  fixContactEmail('Cost is quoted by email. joe@joestsolutions.com or /contact.', JOE) === `Cost is quoted by email. ${JOE} or /contact.`)
check('other small slips are corrected', [
  'joe@joestechsolution.com', 'joe@joestechsolutions.co', 'jo@joestechsolutions.com', 'joe@joestechsoultions.com', 'Joe@JoesTechSolutions.com',
].every((e) => fixContactEmail(`email ${e} today`, JOE) === `email ${e.toLowerCase() === JOE ? e : JOE} today`))
check('the right address is left byte-for-byte', fixContactEmail(`Email ${JOE}.`, JOE) === `Email ${JOE}.`)
check('a sentence-ending period stays outside the address', fixContactEmail('write to joe@joestsolutions.com.', JOE) === `write to ${JOE}.`)
check('a markdown mailto link is fixed in both places',
  fixContactEmail('[joe@joestsolutions.com](mailto:joe@joestsolutions.com)', JOE) === `[${JOE}](mailto:${JOE})`)
check('the visitor’s own address is never touched', [
  'maria@example.com', 'dana@acme.example', 'joe@gmail.com', 'joe@joesplumbing.com', 'owner@joestechsolutions-fans.org',
].every((e) => fixContactEmail(`my email is ${e}`, JOE) === `my email is ${e}`))
check('several addresses in one reply: only the near miss changes',
  fixContactEmail('You said maria@example.com; Joe is joe@joestsolutions.com.', JOE) === `You said maria@example.com; Joe is ${JOE}.`)
check('cloudyjoe’s contact is protected the same way', fixContactEmail('blasj408@gmial.com', 'blasj408@gmail.com') === 'blasj408@gmail.com')
check('text with no address, empty text and a missing contact pass through',
  fixContactEmail('no address here', JOE) === 'no address here' && fixContactEmail('', JOE) === '' && fixContactEmail('joe@joestsolutions.com', '') === 'joe@joestsolutions.com')
check('edit distance is right on known pairs', editDistance('kitten', 'sitting') === 3 && editDistance('joe@joestsolutions.com', JOE) === 3 && editDistance('a', 'a') === 0)
check('the edit budget stays small (a different real address must never be rewritten)', MAX_EDITS <= 4)

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1) }
console.log('ok — near misses of the contact address are corrected; every other address is left alone')
