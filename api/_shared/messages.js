// The chat history as the model must see it, from what a widget sent.
//
// Both widgets send their visible history, and the model API is stricter than
// either widget: it rejects a blank message, and a history that opens with the
// assistant or carries two turns from one side in a row is outside the shape it
// expects. The widgets can produce all three: cloudyjoe.com does not filter an
// empty assistant bubble left by an interrupted reply, and a greeting in the
// other language survives both greeting filters. A request the model rejects
// costs the visitor their answer after three attempts, so the history is made
// valid here instead: blank turns and leading greetings are dropped, and
// consecutive turns from one side are joined.
//
// Returns null for a request no widget sends (not an array, a role other than
// user/assistant, non-text content) or one with nothing left to answer.
export function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return null
  const out = []
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return null
    const content = m.content.trim()
    if (!content) continue
    if (!out.length && m.role === 'assistant') continue
    const last = out[out.length - 1]
    if (last && last.role === m.role) last.content += `\n\n${content}`
    else out.push({ role: m.role, content })
  }
  return out.length && out[out.length - 1].role === 'user' ? out : null
}
