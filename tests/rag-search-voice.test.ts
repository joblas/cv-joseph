/* eslint-disable @typescript-eslint/no-explicit-any --
 * This suite replaces globalThis.fetch and inspects JSON bodies from
 * api/rag-search.js, which is plain JavaScript with no type surface.
 */
// /api/rag-search is the voice agent's only way to look anything up. Gemini
// Live calls search_portfolio; the widget forwards the query here along with
// the traceId that /api/voice-token issued.
//
// THE DEFECT THIS GUARDS. This handler answered a missing traceId with a 401.
// voice-token returns traceId: null whenever LANGFUSE_* is unset — which has
// been production's normal state since the Cloudflare move — so every voice
// search on BOTH sites 401'd, the widget turned that into "No relevant content
// found.", and the voice agent told callers the site had no details about
// things it covers at length. Reproduced 2026-09-25 against production.
//
// THE SECOND DEFECT, found in review: a FAILED retrieval (a Supabase error or
// timeout) came back as HTTP 200 "No relevant content found." — which no
// widget can tell apart from a real empty result, and which the voice prompt
// treats as licence to say the site doesn't cover something. A failure is now
// a 503; only a search that ran and matched nothing may say it found nothing.
//
// WHY TRACING IS OFF. The first bug only exists when Langfuse is unconfigured;
// a run with LANGFUSE_* set would have passed the whole time. So the keys are
// deleted before the module loads, and asserted absent.
//
// Review showed an earlier version of this file let three wrong changes
// through: re-blocking only the cloudyjoe persona (it only ever sent 'jts'),
// skipping the reasoning step when traceId is missing (its model stub always
// failed, so reasoning never ran), and changing the empty-result text (it had
// no empty case). Each now has a case that fails.
for (const k of ['LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY', 'LANGFUSE_BASEURL', 'LANGFUSE_HOST']) delete process.env[k]
process.env.JTS_SUPABASE_URL = 'https://stub-jts.supabase.co'
process.env.JTS_SUPABASE_ANON_KEY = 'stub-anon'
// cloudyjoe's corpus AND the rate limiter live on this project.
process.env.SUPABASE_URL = 'https://stub-cj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service'
process.env.VOYAGE_API_KEY = 'stub-voyage'
// Point the model client at a closed port, so that even if the SDK captured a
// real fetch before the stub below, nothing in this file can reach a network.
process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:9'
process.env.ANTHROPIC_API_KEY = 'stub-anthropic'
delete process.env.ANTHROPIC_AUTH_TOKEN

let failed = 0
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`  ✗ ${name}`); failed++ }
}

// Unique text that can only reach `context` by travelling the real retrieval
// path, and a second marker that can only arrive via the reasoning model.
const SITE_MARKER = 'The seventy-five minute session installs private AI'
const CJ_MARKER = 'Joe wrote this case study about his own agent fleet'
const REASONED = 'REASONED ANSWER from the model'
const siteRows = () => Array.from({ length: 8 }, (_, i) => ({
  id: `r${i}`, source: 'page', url: 'https://www.joestechsolutions.com/private-ai-setup',
  title: `Private AI Setup ${i}`, content: `${SITE_MARKER} on hardware you own. Detail ${i}. ${'more '.repeat(20)}`,
  priority: 1, score: 0.9 - i * 0.01,
}))
const cjRows = () => Array.from({ length: 6 }, (_, i) => ({
  id: i, content: `${CJ_MARKER}. Part ${i}.`, similarity: 0.9 - i * 0.01,
  metadata: { article_id: 'agent-fleet', section_id: `s${i}`, section_anchor: '', article_slug_en: 'agent-fleet', page_path_en: '/agent-fleet' },
}))

// Per-case knobs.
const mode = { site: 'rows' as 'rows' | 'empty' | 'fail' | 'hang', limitOk: true, limitHang: false, model: 'fail' as 'fail' | 'answer' }
const sent: { url: string; body: any }[] = []
;(globalThis as any).fetch = async (url: string, init: any) => {
  const u = String(url)
  const body = init?.body ? (() => { try { return JSON.parse(init.body) } catch { return init.body } })() : null
  sent.push({ url: u, body })
  const json = (b: unknown, status = 200) => ({ ok: status < 400, status, json: async () => b, text: async () => JSON.stringify(b), headers: new Headers({ 'content-type': 'application/json' }) })
  if (init?.signal?.aborted) { const e: any = new Error('aborted'); e.name = 'AbortError'; throw e }
  if (u.includes('/rpc/check_chat_rate_limit')) {
    if (mode.limitHang) return new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => { const e: any = new Error('aborted'); e.name = 'AbortError'; rej(e) }))
    return json(mode.limitOk)
  }
  if (u.includes('voyageai.com/v1/embeddings')) return json({ data: [{ embedding: Array(1024).fill(0.01) }], usage: { total_tokens: 6 } })
  if (u.includes('voyageai.com/v1/rerank')) return json({ data: [0, 1, 2, 3, 4, 5].map((index, r) => ({ index, relevance_score: 0.9 - r * 0.1 })) })
  if (u.startsWith('https://stub-jts.supabase.co/rest/v1/rpc/')) {
    if (mode.site === 'hang') {
      // Never answers; rejects only when the handler's own retrieval timer aborts it.
      return new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => { const e: any = new Error('aborted'); e.name = 'AbortError'; rej(e) }))
    }
    if (mode.site === 'fail') return json({ message: 'upstream down' }, 503)
    return json(mode.site === 'empty' ? [] : siteRows())
  }
  if (u.startsWith('https://stub-cj.supabase.co/rest/v1/rpc/')) return json(cjRows())
  // The reasoning model. 'fail' is a non-retryable 400, so the SDK gives up at
  // once and the handler speaks the retrieved chunks; 'answer' is a real reply.
  if (mode.model === 'answer') {
    return json({ id: 'msg_1', type: 'message', role: 'assistant', model: 'stub', stop_reason: 'end_turn',
      content: [{ type: 'text', text: REASONED }], usage: { input_tokens: 1, output_tokens: 1 } })
  }
  return json({ type: 'error', error: { type: 'invalid_request_error', message: 'stub' } }, 400)
}

check('tracing is genuinely off for this run (production’s state)', !process.env.LANGFUSE_PUBLIC_KEY)
const { default: handler } = await import('../functions/api-src/rag-search.js')
const reset = () => { mode.site = 'rows'; mode.limitOk = true; mode.limitHang = false; mode.model = 'fail'; sent.length = 0 }
const post = (body: Record<string, unknown>, origin = 'https://www.joestechsolutions.com', extra: Record<string, string> = {}) =>
  handler(new Request('https://cloudyjoe.com/api/rag-search', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...extra }, body: JSON.stringify(body),
  }))
// Raced against a live guard, so a missing timeout FAILS a named check instead
// of leaving the event loop idle — review found that removing the retrieval
// timer made this file exit 13 mid-run, silently skipping every later check.
const withinMs = async <T,>(p: Promise<T>, ms: number): Promise<T | 'HUNG'> => {
  let t: any
  const guard = new Promise<'HUNG'>((res) => { t = setTimeout(() => res('HUNG'), ms) })
  try { return await Promise.race([p, guard]) } finally { clearTimeout(t) }
}

// --- 1. The exact request the JTS widget sends when voice-token issued no trace
{
  reset()
  const res = await post({ query: 'what do I get in the private AI setup', traceId: null, currentPage: '/', persona: 'jts' })
  const body: any = await res.json()
  check('JTS: traceId null is accepted — the request that 401d in production', res.status === 200)
  check('JTS: the model gets the site’s real content', typeof body.context === 'string' && body.context.includes(SITE_MARKER))
  check('JTS: with source badges', Array.isArray(body.sources) && body.sources.length > 0)
}
{
  reset()
  const res = await post({ query: 'private AI setup', currentPage: '/', persona: 'jts' })
  check('JTS: an omitted traceId is accepted too', res.status === 200)
}

// --- 2. cloudyjoe.com — the PR fixes both sites, so both are exercised --------
{
  reset()
  const res = await post({ query: 'tell me about the agent fleet', traceId: null, currentPage: '/' }, 'https://cloudyjoe.com')
  const body: any = await res.json()
  check('cloudyjoe: traceId null is accepted', res.status === 200)
  check('cloudyjoe: the model gets its own corpus’ content', typeof body.context === 'string' && body.context.includes(CJ_MARKER))
}

// --- 3. The reasoning step actually runs without a trace ---------------------
// With the model stub failing, every case above takes the raw-chunk fallback,
// so a change that silently skipped reasoning whenever traceId is missing
// would pass them all. Here the model answers, and its answer must win.
{
  reset(); mode.model = 'answer'
  const res = await post({ query: 'what do I get', traceId: null, currentPage: '/', persona: 'jts' })
  const body: any = await res.json()
  check('the reasoned answer is used when traceId is null', res.status === 200 && String(body.context).includes(REASONED))
}

// --- 4. A genuinely EMPTY search, and a FAILED one, are told apart ------------
{
  reset(); mode.site = 'empty'
  const res = await post({ query: 'restaurant POS', traceId: null, persona: 'jts' })
  const body: any = await res.json()
  check('an empty search is 200 "No relevant content found." — the one way to say "not found"',
    res.status === 200 && body.context === 'No relevant content found.')
}
{
  reset(); mode.site = 'fail'
  const res = await post({ query: 'private AI setup', traceId: null, persona: 'jts' })
  const body: any = await res.json()
  check('a FAILED retrieval is a 503, not a 200 claiming nothing exists', res.status === 503)
  check('...and says nothing about content', body.context === undefined && body.error === 'search_unavailable')
}

// --- 4b. A retrieval TIMEOUT — the most likely real failure — is a 503 too -----
// Review found a mutant that 503'd only 'retrieval_fail' and let timeouts fall
// back to 200 "No relevant content found." — there was no timeout case.
{
  reset(); mode.site = 'hang'
  const res = await withinMs(post({ query: 'private AI setup', traceId: null, persona: 'jts' }), 6000)
  check('a retrieval that times out is bounded by the handler\u2019s own budget, not a hang', res !== 'HUNG')
  check('...and is a 503, not a 200 claiming nothing exists', res !== 'HUNG' && res.status === 503)
}

// --- 5. The real control: a per-IP rate limit ---------------------------------
{
  reset(); mode.limitOk = false
  const res = await post({ query: 'private AI setup', traceId: null, persona: 'jts' })
  check('over the per-IP limit -> 429', res.status === 429)
  check('...before any paid work is done', !sent.some((s) => s.url.includes('voyageai.com') || s.url.includes('127.0.0.1:9')))
}
{
  // The limit VALUE, not just that a limit exists: the limiter stub ignores
  // p_limit, so lowering it to 6/hr (which breaks real voice sessions) passed.
  reset()
  await post({ query: 'private AI setup', traceId: null, persona: 'jts' })
  const lim = sent.find((s) => s.url.includes('/rpc/check_chat_rate_limit'))
  check('the per-IP limit is 60 an hour', lim?.body?.p_limit === 60)
}
{
  // A caller that omits `persona` gets the default (cloudyjoe) persona. Review
  // found a limiter applied only to the JTS persona would leave it unmetered.
  reset(); mode.limitOk = false
  const res = await post({ query: 'tell me about the agent fleet', traceId: null }, 'https://cloudyjoe.com')
  check('a caller with no persona is rate-limited too', res.status === 429)
}
{
  // Any traceId must not buy a way round the limit: that would be the old
  // any-string bypass back again. Review found every 429 case sent null.
  reset(); mode.limitOk = false
  const res = await post({ query: 'private AI setup', traceId: 'x', persona: 'jts' })
  check('a caller WITH a traceId is rate-limited too', res.status === 429)
}
{
  // The bucket must be the caller's own IP. A limiter that lost it would put
  // every visitor in one bucket: 60 searches an hour, then voice AND text chat
  // lock out site-wide.
  reset()
  await post({ query: 'private AI setup', traceId: null, persona: 'jts' }, 'https://www.joestechsolutions.com', { 'cf-connecting-ip': '203.0.113.7' })
  const lim = sent.find((s) => s.url.includes('/rpc/check_chat_rate_limit'))
  check('the limit is counted against the caller\u2019s own IP', lim?.body?.p_ip === '203.0.113.7')
}
{
  // A limiter that HANGS fails open, like one that errors — it runs before
  // every chat message and voice search, so it must never stall them.
  reset(); mode.limitHang = true
  const res = await withinMs(post({ query: 'private AI setup', traceId: null, persona: 'jts' }), 6000)
  check('a hung rate limiter is bounded and fails open — the search still answers', res !== 'HUNG' && res.status === 200)
}

// --- 6. Input the endpoint must refuse or bound -------------------------------
{
  reset()
  check('a missing query is 400', (await post({ traceId: null, persona: 'jts' })).status === 400)
  check('a non-string query is 400', (await post({ query: 12345, persona: 'jts' })).status === 400)
  check('a blank query is 400', (await post({ query: '   ', persona: 'jts' })).status === 400)
}
{
  reset()
  await post({ query: 'x'.repeat(10_000), traceId: null, persona: 'jts' })
  const embedded = sent.find((s) => s.url.includes('voyageai.com/v1/embeddings'))?.body?.input?.[0] ?? ''
  check('a 10,000-character query is capped before it reaches the paid embedding', embedded.length > 0 && embedded.length <= 600)
}
{
  // ...and before it reaches the paid MODEL: a cap applied only to the
  // embedding (or only to the trace) passed the check above.
  reset(); mode.model = 'answer'
  await post({ query: 'x'.repeat(10_000), traceId: null, persona: 'jts' })
  const modelCall = sent.find((s) => s.url.includes('127.0.0.1:9'))
  const longestRun = Math.max(0, ...(JSON.stringify(modelCall?.body ?? '').match(/x+/g) || []).map((r) => r.length))
  check('the reasoning model is actually called in this case', !!modelCall)
  check('...and never sees more than the capped 500 characters of query', longestRun > 0 && longestRun <= 500)
}
{
  const res = await handler(new Request('https://cloudyjoe.com/api/rag-search', { method: 'GET' }))
  check('a non-POST is 405', res.status === 405)
}

// --- 6b. The inner catch can no longer tell the model to invent -------------------
// It returned 200 "answer from your general knowledge" and is hard to reach
// from outside, so this guards the source directly: that text may never come back.
{
  // Driven for real: the response's own serialisation is made to throw, which
  // lands in the handler's inner catch. (Scoped to one sentinel page and
  // restored at once, so nothing else is affected.)
  reset()
  const realStringify = JSON.stringify
  JSON.stringify = ((v: any, ...rest: any[]) => {
    // Only the handler's RESPONSE object ({context, sources, currentPage}) —
    // not this test's own request body, which carries the same currentPage.
    if (v && typeof v === 'object' && v.currentPage === '/__throw_in_inner_try__' && 'context' in v) throw new Error('boom')
    return (realStringify as any)(v, ...rest)
  }) as typeof JSON.stringify
  let res: Response
  try { res = await post({ query: 'private AI setup', traceId: null, persona: 'jts', currentPage: '/__throw_in_inner_try__' }) }
  finally { JSON.stringify = realStringify }
  const body: any = await res!.json()
  check('an error inside the handler is a 503, never a 200 the model would trust', res!.status === 503)
  check('...and carries no context for the model to repeat', body.context === undefined)
  // Backstop for the wording, since the phrase is the thing that did harm.
  const src = (await import('node:fs')).readFileSync(new URL('../functions/api-src/rag-search.js', import.meta.url), 'utf8')
  check('rag-search never tells the model to answer from general knowledge', !/general knowledge/i.test(src))
}

// --- 7. Nothing escaped to the network ---------------------------------------
check('no request left the stub', sent.every((s) => /stub-(jts|cj)\.supabase\.co|voyageai\.com|127\.0\.0\.1:9/.test(s.url)))

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('ok — voice search works with tracing off on both sites; failure is 503, empty is 200; limited and bounded')
