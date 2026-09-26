// The one address a visitor must copy exactly is the one a model may misspell.
// Found 2026-09-26 in a MatrAIx simulation against the live agent: it wrote
// "joe@joestsolutions.com" for joe@joestechsolutions.com, and apologised two
// replies later. A visitor who emails the first one is a lost lead.
//
// So every reply is checked, narrowly. An address IS the contact address only
// when its mailbox name is the contact's exactly and its domain is one slip
// away (a wrong, missing, extra or swapped letter) or has merely lost a few
// letters. A different mailbox name is a different person (jon@, info@), a
// domain with other letters is a different business (joestaxsolutions.com),
// and an address the visitor typed is theirs — never touched, however close.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
export const MAX_DROPPED = 3

// Edit distance counting a swap of two adjacent letters as one edit.
export function editDistance(a, b) {
  if (a === b) return 0
  let before = null
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (before && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], before[j - 2] + 1)
    }
    before = prev
    prev = row
  }
  return prev[b.length]
}

// How many letters `domain` is missing, when it is `target` with letters
// dropped and nothing else changed; -1 when it is not.
function droppedLetters(domain, target) {
  let k = 0
  for (const ch of target) if (ch === domain[k]) k++
  return k === domain.length ? target.length - domain.length : -1
}

// Every address the visitor wrote in these messages (their own words, not
// replies or tool results).
export function visitorAddresses(messages) {
  if (!Array.isArray(messages)) return []
  return messages
    .filter((m) => m?.role === 'user')
    .flatMap((m) => typeof m.content === 'string' ? [m.content]
      : Array.isArray(m.content) ? m.content.filter((b) => b?.type === 'text').map((b) => String(b.text ?? '')) : [])
    .flatMap((t) => t.match(EMAIL_RE) || [])
}

export function fixContactEmail(text, contact, visitorsOwn = []) {
  if (typeof text !== 'string' || !text || !contact) return text
  const target = contact.toLowerCase()
  const at = target.lastIndexOf('@')
  const name = target.slice(0, at)
  const host = target.slice(at + 1)
  const theirs = new Set(visitorsOwn.map((e) => String(e).toLowerCase()))
  return text.replace(EMAIL_RE, (addr) => {
    const a = addr.toLowerCase()
    if (a === target || theirs.has(a)) return addr
    const split = a.lastIndexOf('@')
    if (a.slice(0, split) !== name) return addr
    const domain = a.slice(split + 1)
    const dropped = droppedLetters(domain, host)
    return editDistance(domain, host) <= 1 || (dropped > 0 && dropped <= MAX_DROPPED) ? contact : addr
  })
}
