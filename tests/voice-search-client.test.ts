/* eslint-disable @typescript-eslint/no-explicit-any --
 * Drives runSearchForModel / answerToolCalls through a stubbed network and
 * inspects plain Response objects; `any` at that boundary keeps each case short.
 */
// What cloudyjoe.com's voice clients tell the model after a search, driven
// through the REAL search step and the REAL per-batch logic (src/voiceSearch.ts)
// with the network stubbed.
//
// The defect: each client sent `context || 'No relevant content found.'`, so a
// failed request reached the model as "the site has nothing on this". The rule
// these checks hold: the ONLY text that may report an empty search is the
// backend's own, in a successful response. Same rule, wording and shape as the
// joestechsolutions.com widget (src/components/chat/agent-api.ts there).
//
// Review of the JTS twin found its hook wiring covered only by a regex — eight
// wrong changes passed, including discarding the search result and sending an
// empty query. The batch logic now lives in answerToolCalls() and is driven here.
import { readFileSync } from 'node:fs'
import { SEARCH_FAILED_FOR_MODEL, answerToolCalls, runSearchForModel } from '../src/voiceSearch.ts'

let failed = 0
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`  ✗ ${name}`); failed++ }
}
const reply = (status: number, body: string | null, type = 'application/json') =>
  async () => new Response(body, { status, headers: { 'Content-Type': type } })
const FIELDS = { query: 'what is the turnover agent', traceId: null, currentPage: '/' }
const SOURCES = [{ article_id: 'turnover-agent' }]
const isFailed = (o: any) => o.result === SEARCH_FAILED_FOR_MODEL && Array.isArray(o.sources) && o.sources.length === 0

// --- the search step -----------------------------------------------------------
{
  const o: any = await runSearchForModel(FIELDS, reply(200, JSON.stringify({ context: 'Real content.', sources: SOURCES })))
  check('a successful search passes context and sources through', o.result === 'Real content.' && o.sources.length === 1)
  const e: any = await runSearchForModel(FIELDS, reply(200, JSON.stringify({ context: 'No relevant content found.', sources: [] })))
  check('the backend’s own empty result is the one way to report nothing found', e.result === 'No relevant content found.')
}
check('the exact 401 production returned is a failure',
  isFailed(await runSearchForModel(FIELDS, reply(401, JSON.stringify({ error: 'Missing traceId' })))))
check('a 500 with an empty body is a failure', isFailed(await runSearchForModel(FIELDS, reply(500, null))))
check('a 502 HTML page is a failure', isFailed(await runSearchForModel(FIELDS, reply(502, '<html>Bad Gateway</html>', 'text/html'))))
check('a thrown fetch is a failure', isFailed(await runSearchForModel(FIELDS, async () => { throw new TypeError('Failed to fetch') })))
for (const body of ['null', '{}', '{"context":""}', '{"context":"  "}', '{"context":42}', 'not json']) {
  check(`an unreadable 200 (${body}) is a failure, never an invented empty`, isFailed(await runSearchForModel(FIELDS, reply(200, body))))
}
// Every error status, not just 503: a `status >= 500` check passed a 503-only test.
for (const status of [400, 401, 403, 429, 500, 502, 503]) {
  check(`status wins over body: a ${status} carrying "No relevant content found." is a failure`,
    isFailed(await runSearchForModel(FIELDS, reply(status, JSON.stringify({ context: 'No relevant content found.', sources: SOURCES })))))
}
{
  let seen: any = null
  await runSearchForModel(FIELDS, async (input: string, init: RequestInit) => {
    seen = { input, init }
    return new Response('{"context":"ok"}', { status: 200 })
  })
  check('it POSTs JSON to /api/rag-search', seen?.input === '/api/rag-search' && seen?.init?.method === 'POST')
  check('with exactly the fields it was given', JSON.stringify(JSON.parse(seen?.init?.body)) === JSON.stringify(FIELDS))
}
{
  // Raced against an explicit guard: Node's AbortSignal.timeout timer is
  // unref'd, so a missing timeout would otherwise just let the event loop exit
  // — which a JTS mutation run once misread as every mutant killed.
  const hang = (_i: string, init: RequestInit) => new Promise<Response>((_res, rej) => {
    init.signal?.addEventListener('abort', () => rej(new DOMException('timed out', 'TimeoutError')))
  })
  let guardTimer: ReturnType<typeof setTimeout> | undefined
  const guard = new Promise<'HUNG'>((res) => { guardTimer = setTimeout(() => res('HUNG'), 2000) })
  const o: any = await Promise.race([runSearchForModel(FIELDS, hang, 50), guard])
  clearTimeout(guardTimer)
  check('a hung request is bounded by the search timeout', o !== 'HUNG' && isFailed(o))
}
check('failure text pinned exactly', SEARCH_FAILED_FOR_MODEL ===
  "Search failed — a technical error, not an empty result. Tell the caller you couldn't look that up just now, and say nothing about whether the site covers it. Share only what is already in your instructions, and offer the contact email from your instructions for anything more.")

// --- the batch logic -----------------------------------------------------------
function ok(result: string, sources: unknown[] = SOURCES) { return { result, sources } }
{
  const { responses } = await answerToolCalls([{ id: 'c1', name: 'search_portfolio', args: { query: 'q' } }],
    { isCancelled: () => false, traceId: null, search: async () => ok('REAL ANSWER') })
  check('the search RESULT is what the model gets', JSON.stringify(responses) === JSON.stringify([{ id: 'c1', name: 'search_portfolio', response: { result: 'REAL ANSWER' } }]))
}
{
  const seen: any[] = []
  await answerToolCalls([{ id: 'c1', name: 'search_portfolio', args: { query: 'agent fleet' } }],
    { isCancelled: () => false, traceId: 't-1', currentPage: '/about', search: async (f) => { seen.push(f); return ok('x') } })
  check('the query comes from the call’s args, trace and page from context',
    JSON.stringify(seen) === JSON.stringify([{ query: 'agent fleet', traceId: 't-1', currentPage: '/about' }]))
}
{
  const good = await answerToolCalls([{ id: 'a', name: 'search_portfolio', args: { query: 'q' } }],
    { isCancelled: () => false, traceId: null, search: async () => ok('x', SOURCES) })
  const bad = await answerToolCalls([{ id: 'b', name: 'search_portfolio', args: { query: 'q' } }],
    { isCancelled: () => false, traceId: null, search: async () => ({ result: SEARCH_FAILED_FOR_MODEL, sources: [] }) })
  check('a successful search sets badges', JSON.stringify(good.sources) === JSON.stringify(SOURCES))
  check('a failed search CLEARS them', Array.isArray(bad.sources) && bad.sources.length === 0)
}
{
  let searched = false
  const out = await answerToolCalls([{ id: 'x', name: 'search_portfolio', args: { query: 'q' } }],
    { isCancelled: () => true, traceId: null, search: async () => { searched = true; return ok('x') } })
  check('cancelled BEFORE: never searched, no response, badges untouched', !searched && out.responses.length === 0 && out.sources === null)
}
{
  let cancelled = false
  const out = await answerToolCalls([{ id: 'x', name: 'search_portfolio', args: { query: 'q' } }],
    { isCancelled: () => cancelled, traceId: null, search: async () => { cancelled = true; return ok('x') } })
  check('cancelled DURING: no response, badges untouched', out.responses.length === 0 && out.sources === null)
}
{
  let searched = false
  const out = await answerToolCalls([{ id: 'u', name: 'delete_everything' }],
    { isCancelled: () => false, traceId: null, search: async () => { searched = true; return ok('x') } })
  check('an unknown tool gets the failure text and never searches',
    !searched && out.responses[0]?.response.result === SEARCH_FAILED_FOR_MODEL && out.sources === null)
}

// --- the clients -----------------------------------------------------------------
{
  const gemini = readFileSync(new URL('../src/useGeminiVoice.ts', import.meta.url), 'utf8')
  check('Gemini client hands the whole batch to answerToolCalls', /const \{ responses, sources \} = await answerToolCalls<RagSource>\(calls,/.test(gemini))
  check('Gemini client sets badges from the batch', /if \(sources\) setVoiceSources\(sources\)/.test(gemini))
  const openai = readFileSync(new URL('../src/useVoiceMode.ts', import.meta.url), 'utf8')
  check('OpenAI client searches with the call’s own query', /await runSearchForModel<RagSource>\(\{\s*query,/.test(openai))
  check('OpenAI client sends the search result as the function output', /output: result/.test(openai))
  for (const [name, src] of [['useGeminiVoice.ts', gemini], ['useVoiceMode.ts', openai]] as const) {
    check(`${name} has no inline empty-result fallback`, !/No relevant content found/.test(src))
    check(`${name} never tells the model to use general knowledge`, !/general knowledge/.test(src))
    check(`${name} does not call /api/rag-search itself`, !/\/api\/rag-search/.test(src))
  }
}

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('ok — both voice clients: every failure reported as a failure, batch wiring tested, search bounded')
