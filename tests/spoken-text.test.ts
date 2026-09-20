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
// ReDoS guard, asserted as SCALING rather than as wall clock.
//
// The previous form was `elapsed < 1000ms` on one 20k-char input. That
// measures the RUNNER, not the code: ~415ms on an idle machine, but 3.4-4.8s
// under 6x CPU oversubscription, failing 5 times out of 5. Harmless while a
// person ran this suite by hand; once it gates the Cloudflare deploy it is a
// deploy that breaks at random, which is worse than no gate because it teaches
// everyone to re-run until green.
//
// Measured shape on 2026-09-20: 10x the input costs ~105x the time, so this
// function is QUADRATIC. That is the accepted current behaviour (~420ms at
// 20k chars). What must never appear is catastrophic backtracking, which is
// EXPONENTIAL — on 10x input that is not twice as bad, it is astronomically
// worse. A 300x ceiling leaves ~3x headroom over the measured ratio and still
// catches an exponential regression by orders of magnitude.
//
// Both measurements run on the same machine in the same process, so a slow
// runner inflates them together and the ratio survives. Each is summed over
// three repetitions because a single 2k run lands at 4-5ms, where millisecond
// timer granularity alone would swing the ratio by a quarter.
const timeFor = (chars: number, reps: number) => {
  const s = '['.repeat(chars)
  const t0 = Date.now()
  for (let i = 0; i < reps; i++) toSpokenText(s)
  return Date.now() - t0
}
timeFor(2000, 2)                              // warm the JIT before measuring
const smallMs = Math.max(timeFor(2000, 3), 1) // floor: never divide by zero
const bigMs = timeFor(20000, 3)
const ratio = bigMs / smallMs
assert.ok(ratio < 300,
  `10x input cost ${ratio.toFixed(0)}x time (2k=${smallMs}ms, 20k=${bigMs}ms) — expected quadratic (~105x), not exponential`)
assert.ok(bigMs < 30000, `pathological input must still complete (3x20k took ${bigMs}ms)`)
console.log(failed === 0 ? `ok — ${cases.length} cases` : `${failed} failing case(s)`)
process.exit(failed ? 1 : 0)
