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
//
// Each chunk costs work in proportion to itself (plus the 64-character leak
// window), never to the answer so far. Until the review of the instant-reply
// branch (2026-10-02) every chunk re-ran the address correction and a regex
// for the trailing word over the WHOLE answer, so a reply's CPU grew with the
// square of its length: 46ms for 4,000 characters in 4-character chunks with
// an address in them, where a Workers Free request gets 10ms in all. Now the
// answer is kept as two parts. Everything up to its last whitespace is
// SETTLED: an address cannot span whitespace, so no later chunk can change
// how it reads, and it is corrected once, the moment it settles. After it
// comes the trailing word, the only part still growing.
import { containsFingerprint } from './rag.js'
import { fixContactEmail } from './contact-email.js'

// Exactly the characters /\s/ matches: tab to carriage return and the space,
// then the Unicode spaces, which are rare enough to ask the regex about.
const isSpace = (c) => c === 32 || (c >= 9 && c <= 13) || (c > 127 && /\s/.test(String.fromCharCode(c)))
// Where `s`'s trailing run of non-space characters starts (0: `s` has no
// whitespace at all), found by scanning back from its end.
function wordStart(s) {
  let i = s.length
  while (i > 0 && !isSpace(s.charCodeAt(i - 1))) i--
  return i
}

export function replyText({ canary = '', contact = '', visitorsOwn = [] } = {}) {
  const fix = (text) => (contact && text.includes('@') ? fixContactEmail(text, contact, visitorsOwn) : text)
  let visible = '' // exactly what the visitor has been sent so far
  let last64 = '' // the answer's last 64 characters, for a leak split across chunks
  // The answer so far is `settled` (corrected) followed by `word` (as written).
  let settled = ''
  let settledShows = false // `settled` has a visible character
  let word = ''
  let held = false // `word` contains "@": it may still become an address
  // What is ready and not yet sent: the end of `settled` (whitespace only,
  // while nothing visible has been sent) and the end of `word` (unless held).
  let unsentSettled = ''
  let unsentWord = ''
  // What is ready to go is `settled`, then `word` unless it is held. A
  // correction only ever rewrites an address, and only the "@" word is held,
  // so what is ready extends what was sent, except when a mailbox name was sent
  // before its "@": same length, so continuing past what was sent stays right.
  const take = () => {
    const ready = settled.length + (held ? 0 : word.length)
    if (ready <= visible.length || (!visible && !settledShows && (held || !word))) return ''
    const out = unsentSettled + (held ? '' : unsentWord)
    unsentSettled = ''
    if (!held) unsentWord = ''
    visible += out
    return out
  }
  return {
    /** One more chunk of the model's text: `leak` means send none of it, ever. */
    push(chunk) {
      const recent = last64 + chunk
      last64 = recent.length > 64 ? recent.slice(-64) : recent
      const cut = wordStart(chunk)
      if (cut) {
        // The chunk ends a word: the answer up to its last whitespace settles,
        // corrected once, here. What was sent may reach into it (the start of
        // a word sent before its "@" arrived).
        const part = fix(word + chunk.slice(0, cut))
        const sentOfPart = visible.length - settled.length
        unsentSettled = sentOfPart <= 0 ? unsentSettled + part : part.slice(sentOfPart)
        settled += part
        settledShows ||= /\S/.test(part)
        word = chunk.slice(cut)
        held = word.includes('@')
        unsentWord = word
      } else {
        word += chunk
        held ||= chunk.includes('@')
        if (!held) unsentWord += chunk
      }
      if (containsFingerprint(recent) || (canary && recent.includes(canary))) return { leak: true, out: '' }
      return { leak: false, out: take() }
    },
    /** The answer is complete: what is left to send, and the whole corrected
     * answer as `replace` when what the visitor has differs from it. */
    end() {
      const text = settled + fix(word)
      let out = ''
      if (text.length > visible.length && (visible || text.trim())) {
        out = text.slice(visible.length)
        visible += out
      }
      return { out, replace: visible && visible !== text ? text : null, text }
    },
    get visible() { return visible },
  }
}
