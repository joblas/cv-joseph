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

export function createAnthropicClient() {
  return new Anthropic({
    // Bearer auth (ANTHROPIC_AUTH_TOKEN) is what Ollama Cloud expects. When it is
    // set, apiKey is null (not undefined: undefined re-reads ANTHROPIC_API_KEY
    // from the env) so the Anthropic key is never sent to a foreign endpoint.
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN ? null : (process.env.ANTHROPIC_API_KEY || undefined),
    authToken: process.env.ANTHROPIC_AUTH_TOKEN || undefined,
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  })
}
