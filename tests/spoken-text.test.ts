/**
 * Contract test for toSpokenText() — the voice search endpoint returns plain
 * speech text regardless of what markdown the model emits.
 * Run: npx tsx tests/spoken-text.test.ts
 */
import assert from 'node:assert/strict'

// The route module imports the .txt prompt, so load the build-time copy.
const { toSpokenText } = await import('../functions/api-src/rag-search.js')

const cases: Array<[string, string]> = [
  ['**The Turnover Agent** -> a Telegram bot.', 'The Turnover Agent: a Telegram bot.'],
  ['See [the case study](https://cloudyjoe.com/turnover-agent).', 'See the case study.'],
  ['Joe built Hermes.\n\nIt runs nightly.', 'Joe built Hermes. It runs nightly.'],
  ['- 32 tools\n- polls `iCal` feeds', '32 tools. polls iCal feeds'],
  ['# Heading\n\nfirst', 'Heading. first'],
  ['the cbarrgs_agent repo and run_id 7', 'the cbarrgs_agent repo and run_id 7'],
  ['*unbalanced opener then cbarrgs_agent later', 'unbalanced opener then cbarrgs_agent later'],
  ['rated 5* overall', 'rated 5 overall'],
  ["Joe's app costs $1,200 and scored 4.9", "Joe's app costs $1,200 and scored 4.9"],
  ['See https://x.com, then go', 'See , then go'],
  ['_private_var stays', '_private_var stays'], // leading underscore identifier is preserved
  ['', ''],
]
let failed = 0
for (const [input, expected] of cases) {
  const out = toSpokenText(input)
  if (out !== expected) { failed++; console.error('FAIL', JSON.stringify(input), '→', JSON.stringify(out), 'expected', JSON.stringify(expected)) }
}
assert.equal(toSpokenText(null as unknown as string), '')
assert.equal(toSpokenText(42 as unknown as string), '42')
const big = '[' .repeat(20000)
const t0 = Date.now(); toSpokenText(big); assert.ok(Date.now() - t0 < 1000, 'pathological input must stay fast')
console.log(failed === 0 ? `ok — ${cases.length} cases` : `${failed} failing case(s)`)
process.exit(failed ? 1 : 0)
