// The JTS site corpus now carries vectors: all 249 site_chunks rows are
// embedded with voyage-3.5 at 1024 dims (backfilled 2026-09-20). Two things had
// to change for a visitor to feel it — the query has to be embedded, and the
// call has to go to the hybrid RPC instead of the keyword-only one.
//
// WHAT THIS FILE GUARDS. Not the happy path — the three ways Voyage can fail.
// Retrieval is in the request path of every chat turn, so a Voyage outage, a
// revoked key or a rate-limit must degrade to the old keyword behaviour rather
// than throw. That is the property worth a test: the feature going dark is an
// inconvenience, the chat going dark is an outage.
//
// These assert on the REQUEST THE CODE ACTUALLY MAKES (captured from a stubbed
// fetch), not on internal flags. An earlier draft asserted `result.mode ===
// 'site'`, which stayed true whichever RPC was called — it would have passed
// against the pre-change code that never sends an embedding at all.
import { searchPortfolio, voyageRerank } from '../functions/api-src/_shared/rag.js'
import { getPersona } from '../functions/api-src/_shared/personas.js'

let failed = 0
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`  ✗ ${name}`); failed++ }
}

const jts = getPersona('jts')

// A stub that records every call and answers each URL with canned JSON.
function stubFetch(handlers: Record<string, () => unknown>) {
  const calls: { url: string; body: any }[] = []
  ;(globalThis as any).fetch = async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : null
    calls.push({ url: String(url), body })
    for (const [frag, make] of Object.entries(handlers)) {
      if (String(url).includes(frag)) {
        const r = make()
        if (r instanceof Error) throw r
        if ((r as any).__status) return { ok: false, status: (r as any).__status, text: async () => 'err' }
        return { ok: true, status: 200, json: async () => r }
      }
    }
    return { ok: true, status: 200, json: async () => ({}) }
  }
  return calls
}

const VEC = Array.from({ length: 1024 }, () => 0.01)
const embedOK = () => ({ data: [{ embedding: VEC }], usage: { total_tokens: 8 } })
const rpcRows = () => ([
  { content: 'Skate Workshop coaching app', metadata: { title: 'Portfolio' }, similarity: 0.9, page_path: '/portfolio' },
])

const origEnv = { ...process.env }
function resetEnv() {
  process.env = { ...origEnv }
  process.env.JTS_SUPABASE_URL = 'https://stub.supabase.co'
  process.env.JTS_SUPABASE_ANON_KEY = 'stub-anon-key'
}

// --- 1. RPC selection: the whole point of the change --------------------------
{
  resetEnv()
  process.env.VOYAGE_API_KEY = 'stub-key'
  const calls = stubFetch({ 'voyageai.com/v1/embeddings': embedOK, '/rpc/': rpcRows })
  await searchPortfolio('examples of his work', null, null, jts)
  const rpc = calls.find((c) => c.url.includes('/rpc/'))
  check('with a Voyage key, retrieval calls the HYBRID rpc',
    !!rpc && rpc.url.includes('search_site_chunks_hybrid_public'))
  check('the hybrid call actually carries a query_embedding',
    Array.isArray(rpc?.body?.query_embedding) && rpc.body.query_embedding.length === 1024)
  check('the query is embedded with input_type "query" (Voyage is asymmetric)',
    calls.find((c) => c.url.includes('embeddings'))?.body?.input_type === 'query')
}

// --- 2. No key: unchanged from before the change ------------------------------
{
  resetEnv()
  delete process.env.VOYAGE_API_KEY
  const calls = stubFetch({ '/rpc/': rpcRows })
  await searchPortfolio('examples of his work', null, null, jts)
  const rpc = calls.find((c) => c.url.includes('/rpc/'))
  check('with no Voyage key, retrieval calls the KEYWORD rpc',
    !!rpc && rpc.url.includes('search_site_chunks_public') && !rpc.url.includes('hybrid'))
  check('with no Voyage key, no embedding call is attempted',
    !calls.some((c) => c.url.includes('voyageai.com')))
}

// --- 3. Embedding fails mid-request: degrade, never throw ---------------------
{
  resetEnv()
  process.env.VOYAGE_API_KEY = 'stub-key'
  const calls = stubFetch({
    'voyageai.com/v1/embeddings': () => ({ __status: 429 }),
    '/rpc/': rpcRows,
  })
  let threw: string | null = null
  try {
    await searchPortfolio('examples of his work', null, null, jts)
  } catch (e: any) { threw = e.message }
  check('a Voyage 429 does not throw out of searchPortfolio', threw === null)
  const rpc = calls.find((c) => c.url.includes('/rpc/'))
  check('a failed embedding falls back to the KEYWORD rpc',
    !!rpc && !rpc.url.includes('hybrid'))
}

// --- 4. voyageRerank degradation contract -------------------------------------
// Returns null to mean "keep the fused order". Null is load-bearing: the caller
// falls through to the LLM reranker on null, so returning [] or throwing here
// would silently empty the context window instead of degrading.
const many = Array.from({ length: 10 }, (_, i) => ({ content: `chunk ${i}`, metadata: { title: `t${i}` } }))
{
  resetEnv()
  delete process.env.VOYAGE_API_KEY
  stubFetch({})
  check('no key -> null (keep fused order)', (await voyageRerank('q', many)) === null)
}
{
  resetEnv()
  process.env.VOYAGE_API_KEY = 'stub-key'
  const calls = stubFetch({ 'rerank': () => ({ data: [] }) })
  const few = many.slice(0, 4)
  check('fewer candidates than topK -> null', (await voyageRerank('q', few)) === null)
  check('...and it does not spend an API call to find that out', calls.length === 0)
}
{
  resetEnv()
  process.env.VOYAGE_API_KEY = 'stub-key'
  stubFetch({ 'rerank': () => ({ __status: 500 }) })
  let threw: string | null = null
  let out: unknown = 'unset'
  try { out = await voyageRerank('q', many) } catch (e: any) { threw = e.message }
  check('a rerank 500 does not throw', threw === null)
  check('a rerank 500 returns null, not an empty list', out === null)
}
{
  resetEnv()
  process.env.VOYAGE_API_KEY = 'stub-key'
  // Voyage returns results ordered by relevance, referencing the input by index.
  stubFetch({ 'rerank': () => ({ data: [
    { index: 7, relevance_score: 0.93 },
    { index: 2, relevance_score: 0.41 },
  ] }) })
  const out = await voyageRerank('q', many, 2) as any[]
  check('happy path reorders by Voyage index, not input order',
    out?.[0]?.content === 'chunk 7' && out?.[1]?.content === 'chunk 2')
  check('relevance_score is carried through as similarity',
    out?.[0]?.similarity === 0.93)
}

process.env = origEnv
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('ok — hybrid rpc selection + 3 Voyage failure paths degrade, never throw')
