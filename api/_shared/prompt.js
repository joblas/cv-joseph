// ---------------------------------------------------------------------------
// System prompt per persona. The cloudyjoe persona can be overridden by the
// Langfuse-managed prompt (label "production") when Langfuse is configured;
// every persona falls back to its file prompt (bundled at build time).
// ---------------------------------------------------------------------------
//
// The work list (api/_shared/work.js) is composed into EVERY prompt this
// returns, the Langfuse one included: scripts/sync-prompt-to-langfuse.ts uploads
// the raw chatbot-prompt.txt (marker and all), and a Langfuse copy synced
// before the work list existed has neither marker nor list. Either way the
// visitor's agent gets the same facts as the bundled file.
//
// `version` pins a specific Langfuse version (chat.js, the X-Prompt-Version
// regression header); without it the "production" label is used. Both go
// through this one function so neither can skip the composition.
import { getPersona } from './personas.js'
import { composeTextPrompt } from './work.js'

export async function getSystemPrompt(langfuse, persona = getPersona(), { version } = {}) {
  try {
    if (langfuse && persona.langfusePrompt) {
      const prompt = version !== undefined
        ? await langfuse.getPrompt(persona.langfusePrompt, version, { type: 'text', cacheTtlSeconds: 0 })
        : await langfuse.getPrompt(persona.langfusePrompt, undefined, {
          type: 'text', label: 'production', cacheTtlSeconds: 300,
        })
      return { text: composeTextPrompt(prompt.prompt, persona.id), version: prompt.version }
    }
  } catch { /* fallback to file */ }
  return { text: persona.prompt, version: 'file' }
}
