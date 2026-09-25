/* eslint-disable @typescript-eslint/no-explicit-any --
 * Drives runSearchForModel through a stubbed network and inspects plain
 * Response objects; `any` at that boundary keeps each case one line.
 */
// What cloudyjoe.com's voice clients tell the model after a search, driven
// through the REAL step (src/voiceSearch.ts) with a stubbed network — not a
// helper handed pre-parsed data. Both clients (Gemini Live and OpenAI
// Realtime) route through it; the last check holds them to that.
//
// The defect: each client sent `context || 'No relevant content found.'`, so a
// failed request reached the model as "the site has nothing on this". The rule
// these checks hold: the ONLY text that may report an empty search is the
// backend's own, in a successful response. The same rule and wording live in
// the joestechsolutions.com widget.
import { readFileSync } from 'node:fs'
import { SEARCH_FAILED_FOR_MODEL, runSearchForModel } from '../src/voiceSearch.ts'

let failed = 0
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`  ✗ ${name}`); failed++ }
}
const reply = (status: number, body: string | null, type = 'application/json') =>
  async () => new Response(body, { status, headers: { 'Content-Type': type } })
const BODY = { query: 'what is the turnover agent', traceId: null, currentPage: '/' }
const SOURCES = [{ article_id: 'turnover-agent' }]
const isFailed = (o: any) => o.result === SEARCH_FAILED_FOR_MODEL && Array.isArray(o.sources) && o.sources.length === 0

// Success, and the backend's own empty result.
{
  const o: any = await runSearchForModel(BODY, reply(200, JSON.stringify({ context: 'Real content.', sources: SOURCES })))
  check('a successful search passes context and sources through', o.result === 'Real content.' && o.sources.length === 1)
  const e: any = await runSearchForModel(BODY, reply(200, JSON.stringify({ context: 'No relevant content found.', sources: [] })))
  check('the backend’s own empty result is the one way to report nothing found', e.result === 'No relevant content found.')
}
// Every failure path.
check('the exact 401 production returned is a failure',
  isFailed(await runSearchForModel(BODY, reply(401, JSON.stringify({ error: 'Missing traceId' })))))
check('the backend’s new 503 for a failed retrieval is a failure',
  isFailed(await runSearchForModel(BODY, reply(503, JSON.stringify({ error: 'search_unavailable' })))))
check('a 429 rate limit is a failure', isFailed(await runSearchForModel(BODY, reply(429, JSON.stringify({ error: 'rate_limited' })))))
check('a 500 with an empty body is a failure', isFailed(await runSearchForModel(BODY, reply(500, null))))
check('a 502 HTML page is a failure', isFailed(await runSearchForModel(BODY, reply(502, '<html>Bad Gateway</html>', 'text/html'))))
check('a thrown fetch is a failure', isFailed(await runSearchForModel(BODY, async () => { throw new TypeError('Failed to fetch') })))
for (const body of ['null', '{}', '{"context":""}', '{"context":"  "}', '{"context":42}', 'not json']) {
  check(`an unreadable 200 (${body}) is a failure, never an invented empty`, isFailed(await runSearchForModel(BODY, reply(200, body))))
}
check('status wins over body: a 503 carrying "No relevant content found." is a failure',
  isFailed(await runSearchForModel(BODY, reply(503, JSON.stringify({ context: 'No relevant content found.', sources: SOURCES })))))
check('an error never yields source badges, even if it carries some',
  isFailed(await runSearchForModel(BODY, reply(500, JSON.stringify({ sources: SOURCES })))))

// The request it sends.
{
  let seen: any = null
  await runSearchForModel(BODY, async (input: string, init: RequestInit) => {
    seen = { input, init }
    return new Response('{"context":"ok"}', { status: 200 })
  })
  check('it POSTs JSON to /api/rag-search', seen?.input === '/api/rag-search' && seen?.init?.method === 'POST')
  check('with exactly the body it was given', JSON.stringify(JSON.parse(seen?.init?.body)) === JSON.stringify(BODY))
}

// The failure text, pinned verbatim: a rewording like "describe it from what
// you remember" or "tell them the site doesn't cover it" passes any keyword test.
check('failure text pinned exactly', SEARCH_FAILED_FOR_MODEL ===
  "Search failed — a technical error, not an empty result. Tell the caller you couldn't look that up just now, and say nothing about whether the site covers it. Share only what is already in your instructions, and offer the contact email from your instructions for anything more.")

// Both clients route every search through it, with no second path to the model.
for (const file of ['src/useGeminiVoice.ts', 'src/useVoiceMode.ts']) {
  const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  check(`${file} calls runSearchForModel`, /await runSearchForModel</.test(src))
  check(`${file} has no inline empty-result fallback`, !/No relevant content found/.test(src))
  check(`${file} never tells the model to use general knowledge`, !/general knowledge/.test(src))
  check(`${file} does not call /api/rag-search itself`, !/\/api\/rag-search/.test(src))
}

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('ok — both voice clients report failures as failures; only the backend may say "empty"')
