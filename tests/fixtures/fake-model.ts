/* eslint-disable @typescript-eslint/no-explicit-any --
 * A fake world for the latency harness: the model provider and every outside
 * service the chat and voice handlers call, each answering after a fixed,
 * scripted delay. Request bodies are dynamically shaped JSON.
 */
// Every delay honours the caller's abort signal, and every model call is
// recorded with its timeline (start, first text, end, abort), so a test can
// compare what the visitor saw against what the "model" did and when.
//
// The fake provider serves both shapes the chat handler has used: a first call
// (it carries the tools) streamed as SSE, as the code does since 2026-10-02,
// or answered in one JSON message, as the non-streamed "tool decision" before
// it did. So the same harness measures the old code and the new.

export const SCALE = Number(process.env.LATENCY_SCALE) > 0 ? Number(process.env.LATENCY_SCALE) : 1

export type ModelScript = {
  hdr: number // ms until the response headers (and, streamed, message_start)
  think: number // ms of thinking (a thinking_delta every 50ms when streamed)
  tok?: number // ms per word of text
  text?: string // the answer text
  preamble?: string // words written before a tool call
  tool?: { query: string } // a search_portfolio call (60ms to write)
}
export type Kind = 'first' | 'answer' | 'reason' | 'rerank' | 'brief' | 'other'
export type Call = {
  kind: Kind; stream: boolean; body: any
  startAt: number; firstTextAt: number; endAt: number; abortedAt: number
}
export type Services = {
  limiterMs: number; embedMs: number; rerankMs: number
  jtsRpcMs: number; cjRpcMs: number
}
export const DEFAULT_SERVICES: Services = { limiterMs: 20, embedMs: 80, rerankMs: 60, jtsRpcMs: 300, cjRpcMs: 150 }

export const JTS_MARKER = 'JTS-CORPUS-MARKER: the Private AI Setup installs local models on hardware you own.'
export const CJ_MARKER = 'CJ-CORPUS-MARKER: Hermes runs the back office of Joe’s Tech Solutions.'

export const calls: Call[] = []
export const serviceCalls: { url: string; at: number; endAt: number; abortedAt: number }[] = []
const world: { scripts: Partial<Record<Kind, ModelScript>>; services: Services } = { scripts: {}, services: { ...DEFAULT_SERVICES } }
export function setWorld(scripts: Partial<Record<Kind, ModelScript>>, services: Partial<Services> = {}) {
  world.scripts = scripts
  world.services = { ...DEFAULT_SERVICES, ...services }
  calls.length = 0
  serviceCalls.length = 0
}

const aborted = () => new DOMException('aborted by the caller', 'AbortError')
export function delay(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(aborted())
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve() }, Math.max(0, ms * SCALE))
    const onAbort = () => { clearTimeout(timer); reject(aborted()) }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

const ev = (type: string, data: any) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } })
const words = (text = '') => text.split(' ').filter(Boolean)
const usage = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0 }

export function classify(body: any): Kind {
  if (Array.isArray(body?.tools)) return 'first'
  if (typeof body?.system === 'string' && body.system.includes('handoff brief')) return 'brief'
  if (JSON.stringify(body?.messages ?? '').includes('voice_rag_call')) return 'reason'
  const user = body?.messages?.[0]?.content
  if (typeof user === 'string' && user.includes('Rank these chunks')) return 'rerank'
  if (body?.stream) return 'answer'
  return 'other'
}

// The default script per call kind, when a scenario does not name one.
const DEFAULT_SCRIPTS: Record<Kind, ModelScript> = {
  first: { hdr: 30, think: 300, tok: 15, text: 'Hello.' },
  answer: { hdr: 30, think: 400, tok: 15, text: 'Here is the answer.' },
  // The old cloudyjoe LLM rerank: ~1.41s on the thinking model.
  rerank: { hdr: 30, think: 1365, tok: 15, text: '0,1,2,3,4' },
  // Voice reasoning: a 4-5 sentence spoken answer, ~1.73s.
  reason: { hdr: 30, think: 800, tok: 15, text: `REASONED-MARKER ${'word '.repeat(59).trim()}` },
  brief: { hdr: 30, think: 100, tok: 15, text: 'Who: someone' },
  other: { hdr: 30, think: 100, tok: 15, text: 'ok' },
}

function modelResponse(call: Call, script: ModelScript, signal?: AbortSignal | null): Promise<Response> {
  const tok = script.tok ?? 15
  const done = () => { call.endAt = Date.now() }
  return (async () => {
    await delay(script.hdr, signal)
    if (!call.stream) {
      // One JSON message once everything is written: no text before the end.
      const gen = script.tool ? 60 : words(script.text).length * tok
      await delay(script.think + gen + words(script.preamble).length * tok, signal)
      const content: any[] = []
      if (script.preamble) content.push({ type: 'text', text: script.preamble })
      if (script.tool) content.push({ type: 'tool_use', id: 'toolu_fake', name: 'search_portfolio', input: script.tool })
      else content.push({ type: 'text', text: script.text ?? '' })
      call.firstTextAt = Date.now()
      done()
      return json({ id: 'msg_fake', type: 'message', role: 'assistant', model: 'fake', content, stop_reason: script.tool ? 'tool_use' : 'end_turn', usage })
    }
    const enc = new TextEncoder()
    return new Response(new ReadableStream({
      async start(c) {
        const put = (s: string) => c.enqueue(enc.encode(s))
        try {
          put(ev('message_start', { message: { id: 'msg_fake', type: 'message', role: 'assistant', model: 'fake', content: [], stop_reason: null, usage: { ...usage, output_tokens: 0 } } }))
          let index = 0
          if (script.think > 0) {
            put(ev('content_block_start', { index, content_block: { type: 'thinking', thinking: '' } }))
            for (let t = 0; t < script.think; t += 50) {
              await delay(Math.min(50, script.think - t), signal)
              put(ev('content_block_delta', { index, delta: { type: 'thinking_delta', thinking: 'hmm ' } }))
            }
            put(ev('content_block_stop', { index }))
            index++
          }
          const textBlock = async (text: string) => {
            put(ev('content_block_start', { index, content_block: { type: 'text', text: '' } }))
            for (const [i, w] of words(text).entries()) {
              await delay(tok, signal)
              if (!call.firstTextAt) call.firstTextAt = Date.now()
              put(ev('content_block_delta', { index, delta: { type: 'text_delta', text: (i ? ' ' : '') + w } }))
            }
            put(ev('content_block_stop', { index }))
            index++
          }
          if (script.preamble) await textBlock(script.preamble)
          if (script.tool) {
            await delay(60, signal)
            put(ev('content_block_start', { index, content_block: { type: 'tool_use', id: 'toolu_fake', name: 'search_portfolio', input: {} } }))
            put(ev('content_block_delta', { index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(script.tool) } }))
            put(ev('content_block_stop', { index }))
          } else {
            await textBlock(script.text ?? '')
          }
          put(ev('message_delta', { delta: { stop_reason: script.tool ? 'tool_use' : 'end_turn' }, usage: { output_tokens: 5 } }))
          put(ev('message_stop', {}))
          done()
          c.close()
        } catch (err) {
          c.error(err)
        }
      },
    }), { headers: { 'content-type': 'text/event-stream' } })
  })()
}

// The site corpora: more than six candidates over several pages, so a Voyage
// rerank runs, each carrying its corpus marker.
const jtsRows = () => Array.from({ length: 10 }, (_, i) => ({
  id: `jts-${i}`, source: 'page', url: `https://www.joestechsolutions.com/${['private-ai-setup', 'services', 'portfolio'][i % 3]}`,
  title: `Page ${i}`, content: `${JTS_MARKER} Detail ${i}.`, priority: 1, score: 0.9 - i * 0.01,
}))
const cjRows = () => Array.from({ length: 10 }, (_, i) => ({
  id: i, content: `${CJ_MARKER} Part ${i}.`, similarity: 0.9 - i * 0.01,
  metadata: { article_id: ['hermes', 'self-healing-chatbot', 'turnover-agent'][i % 3], section_id: `s${i}`, section_anchor: '', page_path: '/hermes', article_slug: 'hermes' },
}))

export async function fakeFetch(url: any, init: any = {}): Promise<Response> {
  const u = String(url instanceof Request ? url.url : url)
  const raw = init.body ?? (url instanceof Request ? await url.clone().text() : undefined)
  let body: any = raw
  try { body = JSON.parse(raw) } catch { /* not JSON */ }
  const signal: AbortSignal | undefined = init.signal
  if (u.startsWith('http://127.0.0.1:9/v1/messages')) {
    const kind = classify(body)
    const call: Call = { kind, stream: Boolean(body?.stream), body, startAt: Date.now(), firstTextAt: 0, endAt: 0, abortedAt: 0 }
    calls.push(call)
    signal?.addEventListener('abort', () => { if (!call.endAt && !call.abortedAt) call.abortedAt = Date.now() }, { once: true })
    return modelResponse(call, world.scripts[kind] ?? DEFAULT_SCRIPTS[kind], signal)
  }
  const svc = { url: u, at: Date.now(), endAt: 0, abortedAt: 0 }
  serviceCalls.push(svc)
  signal?.addEventListener('abort', () => { svc.abortedAt = Date.now() }, { once: true })
  const s = world.services
  // When each answer went back, so a test can see what the handler did next and when.
  const answered = (res: Response) => { svc.endAt = Date.now(); return res }
  if (u.includes('/rest/v1/rpc/check_chat_rate_limit')) { await delay(s.limiterMs, signal); return answered(json(true)) }
  if (u.includes('voyageai.com/v1/embeddings')) {
    await delay(s.embedMs, signal)
    return answered(json({ data: [{ embedding: Array(1024).fill(0.01) }], usage: { total_tokens: 8 } }))
  }
  if (u.includes('voyageai.com/v1/rerank')) {
    await delay(s.rerankMs, signal)
    return answered(json({ data: [0, 1, 2, 3, 4, 5].map((index, r) => ({ index, relevance_score: 0.9 - r * 0.1 })), usage: { total_tokens: 100 } }))
  }
  if (u.startsWith('https://stub-jts.supabase.co/rest/v1/rpc/')) { await delay(s.jtsRpcMs, signal); return answered(json(jtsRows())) }
  if (u.startsWith('https://stub-cj.supabase.co/rest/v1/rpc/')) { await delay(s.cjRpcMs, signal); return answered(json(cjRows())) }
  if (u.startsWith('https://stub-cj.supabase.co/') || u.startsWith('https://stub-jts.supabase.co/')) return answered(json([]))
  throw new Error(`fake world: unexpected fetch ${u}`)
}
