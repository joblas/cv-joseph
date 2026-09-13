// Every persona must name itself. The spoken-answer override interpolates
// `spokenIdentity` into the system prompt, so a persona that forgets it would
// silently tell the model "undefined: speak about Joe in the THIRD PERSON".
//
// Imports the cf:prep copy, not api/ directly: the source imports the prompts as
// text modules (a Vite feature) that a bare runner cannot resolve, and the
// prepared copy is what actually ships to Workers. `npm run test:personas` runs
// cf:prep first.
import { PERSONAS, getPersona, DEFAULT_PERSONA } from '../functions/api-src/_shared/personas.js'

let failed = 0
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`  ✗ ${name}`); failed++ }
}

for (const [id, persona] of Object.entries(PERSONAS)) {
  check(`${id} defines a non-empty spokenIdentity`, typeof persona.spokenIdentity === 'string' && persona.spokenIdentity.length > 0)
  check(`${id} spokenIdentity is second person`, /^You are /.test(persona.spokenIdentity || ''))
  check(`${id} prompt is non-empty`, typeof persona.prompt === 'string' && persona.prompt.length > 0)
}

// Each face names itself, and neither wears the other's name
const cj = getPersona('cloudyjoe')
const jts = getPersona('jts')
check('cloudyjoe spokenIdentity names Cloudy-Joe Agent', (cj.spokenIdentity || '').includes('Cloudy-Joe Agent'))
check('cloudyjoe spokenIdentity does not name the JTS face', !(cj.spokenIdentity || '').includes("Joe's Tech Agent"))
check('jts spokenIdentity names Joe\'s Tech Agent', (jts.spokenIdentity || '').includes("Joe's Tech Agent"))
check('jts spokenIdentity does not name the cloudyjoe face', !(jts.spokenIdentity || '').includes('Cloudy-Joe'))
check('jts prompt opens as Joe\'s Tech Agent', (jts.prompt || '').startsWith("You are Joe's Tech Agent"))
check('jts voice prompt opens as Joe\'s Tech Agent', (jts.voicePrompt || '').startsWith("You are Joe's Tech Agent"))
check('cloudyjoe prompt opens as Cloudy-Joe Agent', (cj.prompt || '').startsWith('You are Cloudy-Joe Agent'))
check('jts text prompt never says Cloudy-Joe Agent', !(jts.prompt || '').includes('Cloudy-Joe Agent'))
check('default persona is cloudyjoe', DEFAULT_PERSONA === 'cloudyjoe')

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log(`ok — ${Object.keys(PERSONAS).length} personas, every face names itself`)
