// What the visitor is sent of one answer, chunk by chunk, as the model writes
// it. Every reply path (the first call, every retry, the fallback) streams
// through one of these, so the two guards below hold everywhere at once:
//
// - Leaks. Each chunk is checked for a prompt fingerprint or the canary BEFORE
//   any of it is sent, over the chunk plus the 64 characters before it (the
//   longest fingerprint is 22, the canary 13), so one split across two chunks
//   is caught on the chunk that completes it. The caller then replaces the
//   answer with LEAK_RESPONSE. Until 2026-10-02 a streamed answer was checked
//   about every 200 characters, and a plain answer only once it was whole.
// - The contact address. A model may misspell the one address a visitor must
//   copy exactly (contact-email.js). A trailing word that contains "@" is held
//   back until it ends (whitespace, or the end of the answer), so a near miss
//   is corrected before any of it is sent. Only when the mailbox name arrived
//   before its "@" and differs in case from the contact's ("Joe@...") does the
//   visitor see the address in the model's case first; end() then returns the
//   corrected whole answer as a replace.
//
// Nothing is sent until the answer has a visible character.
import { containsFingerprint } from './rag.js'
import { fixContactEmail } from './contact-email.js'

export function replyText({ canary = '', contact = '', visitorsOwn = [] } = {}) {
  let raw = ''
  let visible = '' // exactly what the visitor has been sent so far
  const fix = (text) => (contact && text.includes('@') ? fixContactEmail(text, contact, visitorsOwn) : text)
  // The answer so far minus a trailing word that may still become an address.
  const releasable = (text) => {
    const tail = text.match(/\S*$/)[0]
    return tail.includes('@') ? text.slice(0, text.length - tail.length) : text
  }
  // A correction only ever rewrites an address, and only the "@" word is held,
  // so `ready` extends what was sent except in the case of a mailbox name sent
  // before its "@": same length, so continuing past what was sent stays right.
  const take = (ready) => {
    if (ready.length <= visible.length || (!visible && !ready.trim())) return ''
    const out = ready.slice(visible.length)
    visible += out
    return out
  }
  return {
    /** One more chunk of the model's text: `leak` means send none of it, ever. */
    push(chunk) {
      raw += chunk
      const recent = raw.slice(-(chunk.length + 64))
      if (containsFingerprint(recent) || (canary && recent.includes(canary))) return { leak: true, out: '' }
      return { leak: false, out: take(releasable(fix(raw))) }
    },
    /** The answer is complete: what is left to send, and the whole corrected
     * answer as `replace` when what the visitor has differs from it. */
    end() {
      const text = fix(raw)
      const out = take(text)
      return { out, replace: visible && visible !== text ? text : null, text }
    },
    get visible() { return visible },
  }
}
