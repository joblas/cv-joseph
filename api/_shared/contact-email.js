// The one address a visitor must copy exactly is the one a model may misspell.
// Found 2026-09-26 in a MatrAIx simulation against the live agent: it wrote
// "joe@joestsolutions.com" for joe@joestechsolutions.com, and apologised two
// replies later. A visitor who emails the first one is a lost lead.
//
// So every reply is checked: an address within a few edits of the persona's
// contact address IS that address. Anything further away — the visitor's own
// address, a real third party — is left exactly as written.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
export const MAX_EDITS = 4

export function editDistance(a, b) {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = up
    }
  }
  return prev[b.length]
}

export function fixContactEmail(text, contact) {
  if (typeof text !== 'string' || !text || !contact) return text
  const target = contact.toLowerCase()
  return text.replace(EMAIL_RE, (addr) => {
    const a = addr.toLowerCase()
    if (a === target) return addr
    return editDistance(a, target) <= MAX_EDITS ? contact : addr
  })
}
