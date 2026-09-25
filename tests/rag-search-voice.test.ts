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
// search on BOTH sites 401'd. The widget turned that into "No relevant content
// found.", and the voice agent told callers the site had no details about
// things it covers at length. Reproduced 2026-09-25 against production: on
// "can you give me more information about it?" the agent searched, got a 401,
// and said "I'm not seeing more details on that right now."
//
// WHY THIS FILE RUNS WITH TRACING OFF. The bug only exists when Langfuse is
// unconfigured. A test run with LANGFUSE_* set — the state a developer's
// .env.local is likely to be in — would have passed the whole time. So the
// keys are deleted before the module loads, and asserted absent.
for (const k of ['LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY', 'LANGFUSE_BASEURL', 'LANGFUSE_HOST']) delete process.env[k]
process.env.JTS_SUPABASE_URL = 'https://stub.supabase.co'
process.env.JTS_SUPABASE_ANON_KEY = 'stub-anon'
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

// Unique text that can only reach `context` by travelling through the real
// retrieval path: RPC row -> siteChunkToDocument -> rerank -> formatting.
const MARKER = 'The seventy-five minute session installs private AI'
const rows = () => Array.from({ length: 8 }, (_, i) => ({
  id: `r${i}`, source: 'page', url: 'https://www.joestechsolutions.com/private-ai-setup',
  title: `Private AI Setup ${i}`, content: `${MARKER} on hardware you own. Detail ${i}. ${'more '.repeat(20)}`,
  priority: 1, score: 0.9 - i * 0.01,
}))
const VEC = Array.from({ length: 1024 }, () => 0.01)
const calls: string[] = []
;(globalThis as any).fetch = async (url: string, init: any) => {
  const u = String(url)
  calls.push(u)
  const json = (b: unknown, status = 200) => ({ ok: status < 400, status, json: async () => b, text: async () => JSON.stringify(b) })
  if (init?.signal?.aborted) { const e: any = new Error('aborted'); e.name = 'AbortError'; throw e }
  if (u.includes('voyageai.com/v1/embeddings')) return json({ data: [{ embedding: VEC }], usage: { total_tokens: 6 } })
  if (u.includes('voyageai.com/v1/rerank')) return json({ data: [0, 1, 2, 3, 4, 5].map((index, r) => ({ index, relevance_score: 0.9 - r * 0.1 })) })
  if (u.includes('/rest/v1/rpc/')) return json(rows())
  // The reasoning model. 400 is non-retryable, so the SDK fails at once and the
  // handler takes its documented fallback: speak the retrieved chunks.
  return json({ type: 'error', error: { type: 'invalid_request_error', message: 'stub' } }, 400)
}

check('tracing is genuinely off for this run (production’s state)', !process.env.LANGFUSE_PUBLIC_KEY)

const { default: handler } = await import('../functions/api-src/rag-search.js')

const post = (body: Record<string, unknown>) => handler(new Request('https://cloudyjoe.com/api/rag-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://www.joestechsolutions.com' },
  body: JSON.stringify(body),
}))

// --- 1. The exact request the widget sends when voice-token issued no trace ---
{
  const res = await post({ query: 'what do I get in the private AI setup', traceId: null, currentPage: '/', persona: 'jts' })
  const body: any = await res.json()
  check('traceId: null is accepted — this is the request that 401d in production', res.status === 200)
  check('...and the model gets the site’s real content, not the empty fallback',
    typeof body.context === 'string' && body.context.includes(MARKER))
  check('...rather than "No relevant content found."', body.context !== 'No relevant content found.')
  check('...with source badges for the page it drew on', Array.isArray(body.sources) && body.sources.length > 0)
}

// --- 2. traceId omitted entirely --------------------------------------------
{
  const res = await post({ query: 'private AI setup', currentPage: '/', persona: 'jts' })
  const body: any = await res.json()
  check('an omitted traceId is accepted too', res.status === 200 && String(body.context).includes(MARKER))
}

// --- 3. A real traceId still works exactly as before ------------------------
{
  const res = await post({ query: 'private AI setup', traceId: 'trace-123', currentPage: '/', persona: 'jts' })
  check('a supplied traceId is unaffected', res.status === 200)
}

// --- 4. The validation that DOES mean something is preserved -----------------
{
  const res = await post({ traceId: null, persona: 'jts' })
  check('a missing query is still rejected (400)', res.status === 400)
}
{
  const res = await handler(new Request('https://cloudyjoe.com/api/rag-search', { method: 'GET' }))
  check('a non-POST is still rejected (405)', res.status === 405)
}

// --- 5. Nothing escaped to the network ---------------------------------------
check('no request left the stub', calls.every((u) => /stub\.supabase\.co|voyageai\.com|127\.0\.0\.1:9/.test(u)))

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('ok — voice search answers with tracing off (traceId null or absent), validation intact')
