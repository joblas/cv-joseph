// Which real-time voice provider serves /api/voice-token. Shared with
// api/chat.js so the chat's "Voice mode:" runtime line and the token
// endpoint can never disagree.
export function voiceProvider() {
  const forced = process.env.VOICE_PROVIDER
  if (forced === 'gemini') return process.env.GEMINI_API_KEY ? 'gemini' : null
  if (forced === 'openai') return process.env.OPENAI_API_KEY ? 'openai' : null
  if (process.env.GEMINI_API_KEY) return 'gemini'
  if (process.env.OPENAI_API_KEY) return 'openai'
  return null
}
