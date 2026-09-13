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
