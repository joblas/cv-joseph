// ---------------------------------------------------------------------------
// System prompt per persona. The cloudyjoe persona can be overridden by the
// Langfuse-managed prompt (label "production") when Langfuse is configured;
// every persona falls back to its file prompt (bundled at build time).
// ---------------------------------------------------------------------------
import { getPersona } from './personas.js'

export async function getSystemPrompt(langfuse, persona = getPersona()) {
  try {
    if (langfuse && persona.langfusePrompt) {
      const prompt = await langfuse.getPrompt(persona.langfusePrompt, undefined, {
        type: 'text', label: 'production', cacheTtlSeconds: 300,
      })
      return { text: prompt.prompt, version: prompt.version }
    }
  } catch { /* fallback to file */ }
  return { text: persona.prompt, version: 'file' }
}
