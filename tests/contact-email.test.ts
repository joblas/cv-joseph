// fixContactEmail (api/_shared/contact-email.js). A MatrAIx simulation against
// the live agent (2026-09-26) caught it writing "joe@joestsolutions.com" for
// joe@joestechsolutions.com — a visitor who emails that is a lost lead. Near
// misses of the persona's contact address become the address; everything
// else, the visitor's own address above all, is left exactly as written.
const { fixContactEmail, visitorAddresses, editDistance, MAX_DROPPED } = await import('../functions/api-src/_shared/contact-email.js')

let failed = 0
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`  ✗ ${name}`); failed++ }
}
const JOE = 'joe@joestechsolutions.com'
const BLASJ = 'blasj408@gmail.com' // cloudyjoe's contact: short, so near misses crowd it
const fixes = (addr: string, contact: string) => fixContactEmail(`email ${addr} today`, contact) === `email ${addr.toLowerCase() === contact ? addr : contact} today`
const leaves = (addr: string, contact: string) => fixContactEmail(`email ${addr} today`, contact) === `email ${addr} today`

check('the exact typo from the simulation is corrected',
  fixContactEmail('Cost is quoted by email. joe@joestsolutions.com or /contact.', JOE) === `Cost is quoted by email. ${JOE} or /contact.`)
for (const e of ['joe@joestechsolution.com', 'joe@joestechsolutions.co', 'joe@joestechsoultions.com', 'joe@joestechsolutionss.com', 'joe@joestechsolutins.com', 'Joe@JoesTechSolutions.com']) {
  check(`a slip in the domain is corrected: ${e}`, fixes(e, JOE))
}
check('the right address is left byte-for-byte', fixContactEmail(`Email ${JOE}.`, JOE) === `Email ${JOE}.`)
check('a sentence-ending period stays outside the address', fixContactEmail('write to joe@joestsolutions.com.', JOE) === `write to ${JOE}.`)
check('a markdown mailto link is fixed in both places',
  fixContactEmail('[joe@joestsolutions.com](mailto:joe@joestsolutions.com)', JOE) === `[${JOE}](mailto:${JOE})`)

// Real, different addresses the review (PR #32) listed: none may ever become Joe's.
for (const e of [
  'jon@joestechsolutions.com', 'info@joestechsolutions.com', 'jo@joestechsolutions.com', // another mailbox name is another person
  'joe@joestaxsolutions.com', 'joe@joesautosolutions.com', 'joe@joes.com', // another business, or too much missing
  'maria@example.com', 'joe@gmail.com', 'joe@joesplumbing.com', 'owner@joestechsolutions-fans.org',
]) check(`a different address is left alone: ${e}`, leaves(e, JOE))
for (const e of [
  'blake408@gmail.com', 'glass408@gmail.com', 'lisa408@gmail.com', 'jas408@gmail.com', 'klaus08@gmail.com',
  'blasj@gmail.com', 'blas@gmail.com', 'blasj408@gmx.com',
]) check(`cloudyjoe: a different address is left alone: ${e}`, leaves(e, BLASJ))
for (const e of ['blasj408@gmial.com', 'blasj408@gmail.co', 'blasj408@gmal.com']) check(`cloudyjoe: a slip is corrected: ${e}`, fixes(e, BLASJ))

check('an address the visitor typed is never touched, however close (any case)',
  fixContactEmail('You wrote joe@joestechsolution.com; Joe is joe@joestsolutions.com.', JOE, ['JOE@joestechsolution.com'])
    === `You wrote joe@joestechsolution.com; Joe is ${JOE}.`)
check('several addresses in one reply: only the near miss changes',
  fixContactEmail('You said jon@joestechsolutions.com; Joe is joe@joestsolutions.com.', JOE) === `You said jon@joestechsolutions.com; Joe is ${JOE}.`)
check('the visitor’s addresses come from their own messages only', JSON.stringify(visitorAddresses([
  { role: 'user', content: 'I am pat@example.com' },
  { role: 'assistant', content: 'Joe is joe@joestsolutions.com' },
  { role: 'user', content: [{ type: 'text', text: 'or sam@example.org' }, { type: 'tool_result', tool_use_id: 't', content: 'x@example.net' }] },
])) === JSON.stringify(['pat@example.com', 'sam@example.org']) && visitorAddresses(undefined).length === 0)
check('text with no address, empty text and a missing contact pass through',
  fixContactEmail('no address here', JOE) === 'no address here' && fixContactEmail('', JOE) === '' && fixContactEmail('joe@joestsolutions.com', '') === 'joe@joestsolutions.com')
check('edit distance is right on known pairs (a swap of neighbours is one edit)',
  editDistance('kitten', 'sitting') === 3 && editDistance('joestsolutions.com', 'joestechsolutions.com') === 3
  && editDistance('gmial.com', 'gmail.com') === 1 && editDistance('a', 'a') === 0 && editDistance('', 'abc') === 3)
check('only a few dropped letters count as a slip', MAX_DROPPED <= 3)

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1) }
console.log('ok — near misses of the contact address are corrected; every other address is left alone')
