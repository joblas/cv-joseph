// ---------------------------------------------------------------------------
// Model + client configuration. Defaults are the Anthropic models the site
// shipped with; every value can be overridden from the environment so the
// same code can run against any Anthropic-Messages-compatible endpoint, e.g.
// Ollama Cloud: ANTHROPIC_BASE_URL=https://ollama.com,
// ANTHROPIC_AUTH_TOKEN=<ollama key>, CHAT_MODEL=glm-5.3-flash.
// (Do not disable extended thinking on glm-5.3-flash: it then writes its
// reasoning into the visible text. With thinking on, the handlers forward
// only text deltas, so the reasoning stays hidden.)
// ---------------------------------------------------------------------------
import Anthropic from '@anthropic-ai/sdk'

// Main conversational model (streaming answers, RAG reasoning)
export const CHAT_MODEL = process.env.CHAT_MODEL || 'claude-sonnet-4-6'
// Small/fast model (reranking, intent classification, scoring)
// On a foreign endpoint there is no Haiku; fall back to the main model there.
export function baseUrlHost() {
  try { return new URL(process.env.ANTHROPIC_BASE_URL).hostname } catch { return '' }
}
const onAnthropic = !process.env.ANTHROPIC_BASE_URL || /(^|\.)anthropic\.com$/.test(baseUrlHost())
export const FAST_MODEL =
  process.env.CHAT_MODEL_FAST || (onAnthropic ? 'claude-haiku-4-5-20251001' : CHAT_MODEL)
// Output budget for the streamed answer. Thinking models spend part of it on
// hidden reasoning, so raise it (e.g. 2048) when CHAT_MODEL is one of those.
const parsedMax = parseInt(process.env.CHAT_MAX_TOKENS || '', 10)
export const CHAT_MAX_TOKENS = Number.isInteger(parsedMax) && parsedMax > 0 ? parsedMax : 800
// The small fixed budgets (tool decision, rerank, scoring) share the same
// reasoning overhead, so scale them with the main budget (no-op at 800).
export function scaleTokens(n) {
  return Math.max(n, Math.round((n * CHAT_MAX_TOKENS) / 800))
}

// A non-streaming model call that ends within `ms`, the response body
// included. The SDK's own `timeout` stops counting once the response headers
// arrive (it clears its timer when fetch resolves), so a body that stalls
// after them would hang the call for good (review of PR #47, 2026-10-02).
// Aborting our own signal ends the body read too. `signal`, when given, ends
// it early as well (the visitor left). Never retried here.
export async function createWithin(client, params, ms, { signal } = {}) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), ms)
  const leave = () => ac.abort()
  if (signal?.aborted) ac.abort()
  else signal?.addEventListener('abort', leave)
  try {
    return await client.messages.create(params, { timeout: ms, maxRetries: 0, signal: ac.signal })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', leave)
  }
}

// How hard a thinking model thinks before it answers (the Messages API's
// output_config.effort). glm-5.3-flash on Ollama Cloud defaults to "max" on
// every call, which the code never asked for. Measured 2026-10-02 (provider
// bench, n=3-6): at "high" the search decision came back in ~0.77s instead of
// ~1.73s, the answer after a search started in ~0.65s instead of ~1.28s, and
// voice reasoning finished in ~1.65s instead of ~2.31s. "low" skipped a needed
// search 1 time in 3, so it is not the default.
//
// Read at call time. CHAT_EFFORT=max restores the old behaviour exactly as the
// provider applied it; CHAT_EFFORT=default (or off, or empty) sends no field at
// all. Never `thinking`: disabling it makes glm write its reasoning into the
// visible text (see the header), and the provider ignores effort beside it.
export function chatEffort() {
  const raw = process.env.CHAT_EFFORT
  if (raw === undefined) return 'high'
  const value = String(raw).trim()
  return value === '' || value === 'default' || value === 'off' ? null : value
}

// Set once a provider refuses the effort field (HTTP 400 naming it): a model
// switched by env whose thinking levels lack the value (on/off-only models)
// would otherwise fail every call and every visitor would get the error
// message. From then on this isolate sends no effort.
let effortRefused = false
/** Tests only. */
export function resetEffortRefusal() { effortRefused = false }

const isMessagesPost = (url, init) =>
  typeof url === 'string' && /\/v1\/messages(?:\?|$)/.test(url) && String(init?.method || '').toUpperCase() === 'POST' && typeof init?.body === 'string'

// The one choke point for every model request this client makes: create and
// stream alike (stream() runs through create), the tool decision, answers,
// retries and fallbacks, voice reasoning, the lead brief and scoring. The field
// goes in the request body here, at the fetch, so a refusal can be retried
// without it whatever SDK helper made the call.
async function effortFetch(url, init) {
  const send = globalThis.fetch // resolved per call, unbound (Workers reject a foreign `this`)
  const effort = effortRefused ? null : chatEffort()
  if (!effort || !isMessagesPost(url, init)) return send(url, init)
  let params
  try { params = JSON.parse(init.body) } catch { return send(url, init) }
  if (!params || typeof params !== 'object' || 'thinking' in params || 'output_config' in params) return send(url, init)
  const res = await send(url, { ...init, body: JSON.stringify({ ...params, output_config: { effort } }) })
  if (res.status !== 400) return res
  const detail = await res.clone().text().catch(() => '')
  if (!/think|effort|output_config/i.test(detail)) return res
  effortRefused = true
  console.error(`[models] the provider refused output_config.effort=${effort} (HTTP 400: ${detail.slice(0, 160)}); sending no effort from now on`)
  return send(url, init)
}

export function createAnthropicClient() {
  // Off Anthropic only: the field is for the thinking model behind
  // ANTHROPIC_BASE_URL, and Anthropic's own models keep their defaults.
  const host = baseUrlHost()
  const foreign = Boolean(process.env.ANTHROPIC_BASE_URL) && !/(^|\.)anthropic\.com$/.test(host)
  return new Anthropic({
    // Bearer auth (ANTHROPIC_AUTH_TOKEN) is what Ollama Cloud expects. When it is
    // set, apiKey is null (not undefined: undefined re-reads ANTHROPIC_API_KEY
    // from the env) so the Anthropic key is never sent to a foreign endpoint.
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN ? null : (process.env.ANTHROPIC_API_KEY || undefined),
    authToken: process.env.ANTHROPIC_AUTH_TOKEN || undefined,
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
    ...(foreign ? { fetch: effortFetch } : {}),
  })
}
