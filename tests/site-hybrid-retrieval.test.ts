/* eslint-disable @typescript-eslint/no-explicit-any --
 * This suite replaces `globalThis.fetch` and asserts on the JSON bodies the
 * code sends to Voyage and PostgREST. Those bodies are dynamically shaped and
 * come from api/_shared/rag.js, which is plain JavaScript with no type
 * surface, so `any` at the boundary is what keeps each assertion readable as a
 * one-line statement of intent. The sibling suites need no exemption because
 * they only read typed, statically-shaped exports.
 */
// The JTS site corpus carries vectors: all 249 site_chunks rows are embedded
// with voyage-3.5 at 1024 dims (backfilled 2026-09-20). Two things had to
// change for a visitor to feel it — the query has to be embedded, and the call
// has to go to the hybrid RPC instead of the keyword-only one.
//
// WHAT THIS FILE GUARDS, in priority order:
//   1. HANGS. Retrieval sits in the request path of every chat turn. The most
//      common provider failure under load is a connection accepted and never
//      answered — neither a throw nor a rejection. Only an explicit timeout
//      bounds it, and an unbounded await hangs the whole turn forever. Review
//      proved the first version of this change had exactly that hole on both
//      Voyage legs, so the hang cases below are the point of this file.
//   2. That a SLOW embed does not steal the Supabase budget. The legs are
//      sequential and separately bounded; sharing one timer made a 2600ms
//      embed return zero chunks and blame Supabase.
//   3. The request the code actually issues — model, dimensions, input_type,
//      RPC name, match_count, top_k, and that the reranker is given titles.
//
// THE STUB ROWS MUST MATCH THE REAL RPC SHAPE. An earlier version of this file
// returned rows in the post-mapping document shape, so siteChunkToDocument read
// row.score as undefined, similarity fell to 0, the `similarity > 0` filter
// emptied the list, and searchPortfolio returned `no_match` before ever
// reaching the reranker. Nine genuinely-broken mutants passed. Rows here are
// {id, source, url, title, content, priority, score} — what the RPC returns.
import { searchPortfolio, voyageRerank } from '../functions/api-src/_shared/rag.js'
import { getPersona } from '../functions/api-src/_shared/personas.js'

let failed = 0
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`  ✗ ${name}`); failed++ }
}

const jts = getPersona('jts')
const HANG = Symbol('hang')

// Records every call; answers each URL from `handlers`. A handler returning
// HANG never resolves unless the caller passed an AbortSignal — which is
// precisely the property under test.
function stubFetch(handlers: Record<string, () => unknown>) {
  const calls: { url: string; body: any }[] = []
  ;(globalThis as any).fetch = async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : null
    calls.push({ url: String(url), body })
    // Real fetch rejects immediately on an already-aborted signal. Without this
    // the stub answers a spent budget as though it were healthy, and a mutation
    // that collapses the Supabase timeout to 0 goes undetected.
    if (init?.signal?.aborted) {
      const e: any = new Error('The operation was aborted'); e.name = 'AbortError'; throw e
    }
    for (const [frag, make] of Object.entries(handlers)) {
      if (!String(url).includes(frag)) continue
      const r: any = make()
      if (r === HANG) {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const e: any = new Error('The operation was aborted'); e.name = 'AbortError'; reject(e)
          })
        })
      }
      if (r instanceof Error) throw r
      if (r.__status) return { ok: false, status: r.__status, text: async () => 'err' }
      return { ok: true, status: 200, json: async () => r }
    }
    return { ok: true, status: 200, json: async () => ({}) }
  }
  return calls
}

// Sixteen rows over four distinct pages: more than topK (6) so the reranker
// actually fires, and multi-page so diversity is observable.
const PAGES = ['/portfolio', '/services', '/about', '/contact']
const rpcRows = () => Array.from({ length: 16 }, (_, i) => ({
  id: `row-${i}`,
  source: 'page',
  url: `https://www.joestechsolutions.com${PAGES[i % 4]}`,
  title: `Title ${i}`,
  // Longer than 200 characters ON PURPOSE: the LLM reranker this replaces saw
  // only a 200-char preview, and that truncation is the defect being fixed. If
  // the fixture were short, a mutation reintroducing `.slice(0, 200)` would be
  // invisible. The tail marker below is what proves the whole chunk was sent.
  content: `Body text for chunk ${i}. ${'filler '.repeat(40)}TAIL-${i}`,
  priority: 1,
  score: 0.9 - i * 0.01,
}))
const VEC = Array.from({ length: 1024 }, () => 0.01)
const embedOK = () => ({ data: [{ embedding: VEC }], usage: { total_tokens: 8 } })
// Voyage answers with indices into what we sent, best first.
const rerankOK = () => ({ data: [6, 1, 9, 2, 12, 3].map((index, r) => ({ index, relevance_score: 0.99 - r * 0.1 })) })

const origFetch = (globalThis as any).fetch
const origEnv = { ...process.env }
function resetEnv() {
  process.env = { ...origEnv }
  process.env.JTS_SUPABASE_URL = 'https://stub.supabase.co'
  process.env.JTS_SUPABASE_ANON_KEY = 'stub-anon-key'
}
const withinMs = async <T>(p: Promise<T>, ms: number) => {
  let t: any
  const guard = new Promise((res) => { t = setTimeout(() => res(HANG), ms) })
  const r = await Promise.race([p, guard])
  clearTimeout(t)
  return r
}

// --- 1. The full hybrid path, end to end ---------------------------------------
{
  resetEnv()
  process.env.VOYAGE_API_KEY = 'stub-key'
  const calls = stubFetch({ 'voyageai.com/v1/embeddings': embedOK, '/rpc/': rpcRows, '/v1/rerank': rerankOK })
  const res: any = await searchPortfolio('examples of his work', null, null, jts)
  const embed = calls.find((c) => c.url.includes('embeddings'))
  const rpc = calls.find((c) => c.url.includes('/rpc/'))
  const rerank = calls.find((c) => c.url.includes('/v1/rerank'))

  check('retrieval calls the HYBRID rpc', !!rpc && rpc.url.includes('search_site_chunks_hybrid_public'))
  check('the hybrid call carries a 1024-dim query_embedding',
    Array.isArray(rpc?.body?.query_embedding) && rpc.body.query_embedding.length === 1024)
  check('match_count is 16, not the keyword path’s 12', rpc?.body?.match_count === 16)
  check('the lexical leg still gets a real query_text',
    typeof rpc?.body?.query_text === 'string' && rpc.body.query_text.includes('portfolio'))

  check('the embed model is voyage-3.5 (1024 dims; voyage-3-lite is 512 and would 400)',
    embed?.body?.model === 'voyage-3.5')
  check('the embed asks for 1024 dimensions explicitly', embed?.body?.output_dimension === 1024)
  check('input_type is "query" (Voyage is asymmetric; the indexer used "document")',
    embed?.body?.input_type === 'query')
  check('the VISITOR’s query is what gets embedded, not a constant',
    typeof embed?.body?.input?.[0] === 'string' && embed.body.input[0].includes('examples of his work'))

  // The reranker must actually run — this is the whole feature.
  check('the Voyage reranker is called', !!rerank)
  check('the reranker is rerank-2.5', rerank?.body?.model === 'rerank-2.5')
  check('the reranker is asked for 6 candidates', rerank?.body?.top_k === 6)
  check('the reranker receives all 16 candidates', rerank?.body?.documents?.length === 16)
  // The title is the signal that separates a case study from Terms of Service.
  // It reaches Voyage inside `content` (siteChunkToDocument builds it that way),
  // and must arrive exactly once and with its body attached.
  check('each reranker document carries its title AND its body',
    rerank?.body?.documents?.[0]?.includes('Title 0') &&
    rerank?.body?.documents?.[0]?.includes('Body text for chunk 0'))
  check('the reranker reads the FULL chunk, not a truncated preview',
    rerank?.body?.documents?.[0]?.includes('TAIL-0'))
  check('...and the title is not duplicated into it',
    (rerank?.body?.documents?.[0]?.match(/Title 0/g) || []).length === 1)

  // And its verdict must be what reaches the model.
  check('Voyage’s ranking is what survives, not the RPC order',
    res.chunks?.[0]?.metadata?.title === 'Title 6')
  // Voyage ranked [6,1,9,2,12,3]; rows 9 and 2 repeat pages already covered by
  // 1 and 6. diversifyByArticle takes one chunk per distinct page first, then
  // backfills to its cap of 5 — so the result is 5 chunks led by four distinct
  // pages, NOT Voyage's raw 6. Bypassing diversify returns 6 in raw order,
  // which is six chunks of one case study on a real corpus: the exact bug.
  check('diversify caps the voyaged result at 5, not Voyage\u2019s raw 6', res.chunks?.length === 5)
  check('the first four chunks are four DIFFERENT pages',
    new Set(res.chunks.slice(0, 4).map((c: any) => c.metadata.article_id)).size === 4)
  check('a distinct page is pulled ahead of a repeat of one already covered',
    res.chunks?.[2]?.metadata?.title === 'Title 12')

  // Both Voyage calls are billable. Before this change the cost rollup priced
  // the embedding at an OpenAI rate for a model nothing calls and the rerank at
  // FAST_MODEL, so the site corpus billed silently at $0.
  check('the embed reports the model that actually ran', res.usage?.embeddingModel === 'voyage-3.5')
  check('the embed reports its billed tokens', res.usage?.embeddingTokens === 8)
  check('the rerank reports rerank-2.5, not the LLM fallback', res.usage?.rerankModel === 'rerank-2.5')
}

// --- 2. No key: byte-for-byte the pre-change behaviour --------------------------
{
  resetEnv()
  delete process.env.VOYAGE_API_KEY
  const calls = stubFetch({ '/rpc/': rpcRows, '/v1/rerank': rerankOK })
  await searchPortfolio('examples of his work', null, null, jts)
  const rpc = calls.find((c) => c.url.includes('/rpc/'))
  check('no key -> KEYWORD rpc', !!rpc && rpc.url.includes('search_site_chunks_public') && !rpc.url.includes('hybrid'))
  check('no key -> match_count stays 12', rpc?.body?.match_count === 12)
  check('no key -> no embedding call', !calls.some((c) => c.url.includes('embeddings')))
  check('no key -> no rerank call (an unauthenticated one would 401 every turn)',
    !calls.some((c) => c.url.includes('/v1/rerank')))
}

// --- 3. Embed 429: degrade to keyword, never throw ------------------------------
{
  resetEnv()
  process.env.VOYAGE_API_KEY = 'stub-key'
  const calls = stubFetch({ 'embeddings': () => ({ __status: 429 }), '/rpc/': rpcRows, '/v1/rerank': rerankOK })
  let threw: string | null = null
  try { await searchPortfolio('examples of his work', null, null, jts) } catch (e: any) { threw = e.message }
  check('a Voyage 429 does not throw out of searchPortfolio', threw === null)
  check('a failed embedding falls back to the KEYWORD rpc',
    !calls.find((c) => c.url.includes('/rpc/'))?.url.includes('hybrid'))
}

// --- 4. THE HANGS. An unbounded await here hangs the chat turn forever. ---------
{
  resetEnv()
  process.env.VOYAGE_API_KEY = 'stub-key'
  const calls = stubFetch({ 'embeddings': () => HANG, '/rpc/': rpcRows, '/v1/rerank': rerankOK })
  const out = await withinMs(searchPortfolio('examples of his work', null, null, jts), 2500)
  check('a HUNG embed does not hang the turn (it is bounded and degrades)', out !== HANG)
  check('a hung embed still produces an answer via the keyword rpc',
    !!calls.find((c) => c.url.includes('/rpc/')))
}
{
  resetEnv()
  process.env.VOYAGE_API_KEY = 'stub-key'
  stubFetch({ 'embeddings': embedOK, '/rpc/': rpcRows, '/v1/rerank': () => HANG })
  const out: any = await withinMs(searchPortfolio('examples of his work', null, null, jts), 2500)
  check('a HUNG rerank does not hang the turn', out !== HANG)
  check('a hung rerank still returns chunks (falls through to the LLM reranker)',
    out !== HANG && Array.isArray(out?.chunks) && out.chunks.length > 0)
}

// --- 5. A SLOW embed must not spend the Supabase budget -------------------------
// Sharing one 2500ms timer across both legs made a slow-but-successful embed
// return zero chunks and report `retrieval_timeout` — blaming Supabase for
// Voyage's latency. The legs are sequential and separately bounded.
{
  resetEnv()
  process.env.VOYAGE_API_KEY = 'stub-key'
  ;(globalThis as any).fetch = async (url: string, init: any) => {
    if (String(url).includes('embeddings')) {
      await new Promise((r) => setTimeout(r, 1200))   // slower than the embed budget
      return { ok: true, status: 200, json: async () => embedOK() }
    }
    if (String(url).includes('/rpc/')) {
      await new Promise((r) => setTimeout(r, 1500))
      if (init?.signal?.aborted) {
        const e: any = new Error('The operation was aborted'); e.name = 'AbortError'; throw e
      }
      return { ok: true, status: 200, json: async () => rpcRows() }
    }
    return { ok: true, status: 200, json: async () => rerankOK() }
  }
  const res: any = await searchPortfolio('examples of his work', null, null, jts)
  // 1200ms embed + 1500ms Supabase = 2700ms of wall clock, MORE than the 2500ms
  // retrieval budget. Under two sequential budgets this succeeds, because
  // Supabase gets its own fresh 2500ms. Under one timer armed before the embed
  // it aborts mid-query and returns nothing — the original defect. Only a slow
  // Supabase leg can tell those apart; an instant stub passes either way.
  check('a slow embed still yields chunks rather than retrieval_timeout',
    Array.isArray(res?.chunks) && res.chunks.length > 0)
  check('...and is not reported as a Supabase failure', res?.degradedReason !== 'retrieval_timeout')
}

// --- 6. voyageRerank degradation contract ---------------------------------------
// null means "keep the fused order" — the caller falls through to the LLM
// reranker on null, so [] would silently empty the context window instead.
const many = Array.from({ length: 10 }, (_, i) => ({ content: `chunk ${i}`, metadata: { title: `t${i}` } }))
{
  resetEnv(); delete process.env.VOYAGE_API_KEY
  const calls = stubFetch({})
  check('no key -> null', (await voyageRerank('q', many)) === null)
  check('...and spends no API call to find that out', calls.length === 0)
}
{
  resetEnv(); process.env.VOYAGE_API_KEY = 'stub-key'
  const calls = stubFetch({ '/v1/rerank': rerankOK })
  check('fewer candidates than topK -> null', (await voyageRerank('q', many.slice(0, 4))) === null)
  check('...and spends no API call', calls.length === 0)
}
{
  resetEnv(); process.env.VOYAGE_API_KEY = 'stub-key'
  stubFetch({ '/v1/rerank': () => ({ __status: 500 }) })
  let threw: string | null = null; let out: unknown = 'unset'
  try { out = await voyageRerank('q', many) } catch (e: any) { threw = e.message }
  check('a rerank 500 does not throw', threw === null)
  check('a rerank 500 returns null, not an empty list', out === null)
}
{
  resetEnv(); process.env.VOYAGE_API_KEY = 'stub-key'
  stubFetch({ '/v1/rerank': () => HANG })
  const out = await withinMs(voyageRerank('q', many), 2000)
  check('a hung rerank is bounded and returns null', out === null)
}
{
  // A 200 with an out-of-range index spreads `undefined` (which is `{}`, not a
  // throw), putting the literal string "undefined" into the model's context.
  resetEnv(); process.env.VOYAGE_API_KEY = 'stub-key'
  stubFetch({ '/v1/rerank': () => ({ data: [{ index: 99, relevance_score: 0.9 }, { index: 3, relevance_score: 0.8 }] }) })
  const out = await voyageRerank('q', many) as any[]
  check('an out-of-range index is dropped, not spread into the context',
    out?.length === 1 && out[0].content === 'chunk 3')
}
{
  // Every index unresolvable. After filtering, `ranked` is [] — which is TRUTHY,
  // so returning it would hand the caller an empty context window instead of
  // falling through to the LLM reranker.
  resetEnv(); process.env.VOYAGE_API_KEY = 'stub-key'
  stubFetch({ '/v1/rerank': () => ({ data: [{ index: 99, relevance_score: 0.9 }, { index: 42, relevance_score: 0.8 }] }) })
  check('all-invalid indices collapse to null, never []', (await voyageRerank('q', many)) === null)
}
{
  resetEnv(); process.env.VOYAGE_API_KEY = 'stub-key'
  stubFetch({ '/v1/rerank': () => ({ data: [
    { index: 7, relevance_score: 0.93 }, { index: 2, relevance_score: 0.41 },
  ] }) })
  const out = await voyageRerank('q', many, 2) as any[]
  check('happy path reorders by Voyage index, not input order',
    out?.[0]?.content === 'chunk 7' && out?.[1]?.content === 'chunk 2')
  check('relevance_score is carried through as similarity', out?.[0]?.similarity === 0.93)
}

;(globalThis as any).fetch = origFetch
process.env = origEnv
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('ok — hybrid path end to end, 2 hang paths bounded, slow-embed budget, 6 degradation cases')
