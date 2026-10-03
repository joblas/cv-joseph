// fixContactEmail (api/_shared/contact-email.js). A MatrAIx simulation against
// the live agent (2026-09-26) caught it writing "joe@joestsolutions.com" for
// joe@joestechsolutions.com — a visitor who emails that is a lost lead. Near
// misses of the persona's contact address become the address; everything
// else, the visitor's own address above all, is left exactly as written.
const { fixContactEmail, visitorAddresses, editDistance, MAX_DROPPED } = await import('../functions/api-src/_shared/contact-email.js')

let failed = 0
function check(name: string, cond: boolean, detail = '') {
  if (!cond) { console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); failed++ }
}
const JOE = 'joe@joestechsolutions.com'
const BLASJ = 'blasj408@gmail.com' // cloudyjoe's contact: short, so near misses crowd it
const fixes = (addr: string, contact: string) => fixContactEmail(`email ${addr} today`, contact) === `email ${addr.toLowerCase() === contact ? addr : contact} today`
const leaves = (addr: string, contact: string) => fixContactEmail(`email ${addr} today`, contact) === `email ${addr} today`

check('the exact typo from the simulation is corrected',
  fixContactEmail('Cost is quoted by email. joe@joestsolutions.com or /contact.', JOE) === `Cost is quoted by email. ${JOE} or /contact.`)
for (const e of ['joe@joestechsolution.com', 'joe@joestechsolutions.co', 'joe@joestechsoultions.com', 'joe@joestechsolutionss.com', 'joe@joestechsolutins.com', 'Joe@JoesTechSolutions.com']) {
  check(`a slip in the domain is corrected: ${e}`, fixes(e, JOE))
}
check('the right address is left byte-for-byte', fixContactEmail(`Email ${JOE}.`, JOE) === `Email ${JOE}.`)
check('a sentence-ending period stays outside the address', fixContactEmail('write to joe@joestsolutions.com.', JOE) === `write to ${JOE}.`)
check('a markdown mailto link is fixed in both places',
  fixContactEmail('[joe@joestsolutions.com](mailto:joe@joestsolutions.com)', JOE) === `[${JOE}](mailto:${JOE})`)

// Real, different addresses the review (PR #32) listed: none may ever become Joe's.
for (const e of [
  'jon@joestechsolutions.com', 'info@joestechsolutions.com', 'jo@joestechsolutions.com', // another mailbox name is another person
  'joe@joestaxsolutions.com', 'joe@joesautosolutions.com', 'joe@joes.com', // another business, or too much missing
  'maria@example.com', 'joe@gmail.com', 'joe@joesplumbing.com', 'owner@joestechsolutions-fans.org',
]) check(`a different address is left alone: ${e}`, leaves(e, JOE))
for (const e of [
  'blake408@gmail.com', 'glass408@gmail.com', 'lisa408@gmail.com', 'jas408@gmail.com', 'klaus08@gmail.com',
  'blasj@gmail.com', 'blas@gmail.com', 'blasj408@gmx.com',
]) check(`cloudyjoe: a different address is left alone: ${e}`, leaves(e, BLASJ))
for (const e of ['blasj408@gmial.com', 'blasj408@gmail.co', 'blasj408@gmal.com']) check(`cloudyjoe: a slip is corrected: ${e}`, fixes(e, BLASJ))

check('an address the visitor typed is never touched, however close (any case)',
  fixContactEmail('You wrote joe@joestechsolution.com; Joe is joe@joestsolutions.com.', JOE, ['JOE@joestechsolution.com'])
    === `You wrote joe@joestechsolution.com; Joe is ${JOE}.`)
check('several addresses in one reply: only the near miss changes',
  fixContactEmail('You said jon@joestechsolutions.com; Joe is joe@joestsolutions.com.', JOE) === `You said jon@joestechsolutions.com; Joe is ${JOE}.`)
check('the visitor’s addresses come from their own messages only', JSON.stringify(visitorAddresses([
  { role: 'user', content: 'I am pat@example.com' },
  { role: 'assistant', content: 'Joe is joe@joestsolutions.com' },
  { role: 'user', content: [{ type: 'text', text: 'or sam@example.org' }, { type: 'tool_result', tool_use_id: 't', content: 'x@example.net' }] },
])) === JSON.stringify(['pat@example.com', 'sam@example.org']) && visitorAddresses(undefined).length === 0)
check('text with no address, empty text and a missing contact pass through',
  fixContactEmail('no address here', JOE) === 'no address here' && fixContactEmail('', JOE) === '' && fixContactEmail('joe@joestsolutions.com', '') === 'joe@joestsolutions.com')
check('edit distance is right on known pairs (a swap of neighbours is one edit)',
  editDistance('kitten', 'sitting') === 3 && editDistance('joestsolutions.com', 'joestechsolutions.com') === 3
  && editDistance('gmial.com', 'gmail.com') === 1 && editDistance('a', 'a') === 0 && editDistance('', 'abc') === 3)
check('only a few dropped letters count as a slip', MAX_DROPPED <= 3)

// --- The streaming emitter (api/_shared/reply-text.js) ---------------------------
// Every reply now streams from the model's first token, so the correction has
// to happen BEFORE the address is sent, not by a replace afterwards.
const { replyText } = await import('../functions/api-src/_shared/reply-text.js')
const { LEAK_RESPONSE, PROMPT_FINGERPRINTS } = await import('../functions/api-src/_shared/rag.js')
function stream(chunks: string[], opts: { canary?: string; visitorsOwn?: string[] } = {}) {
  const r = replyText({ contact: JOE, canary: opts.canary ?? 'ZXCV_1234abcd', visitorsOwn: opts.visitorsOwn ?? [] })
  const sent: string[] = []
  let leakAt = -1
  chunks.forEach((c, i) => {
    if (leakAt >= 0) return
    const p = r.push(c)
    if (p.leak) { leakAt = i; return }
    if (p.out) sent.push(p.out)
  })
  const end = leakAt >= 0 ? null : r.end()
  if (end?.out) sent.push(end.out)
  return { sent, joined: sent.join(''), replace: end?.replace ?? null, leakAt, text: end?.text }
}
{
  const r = stream(['Email ', 'joe@joest', 'solutions.com.', ' He replies fast.'])
  check('streamed: a split, misspelled contact address is never sent misspelled', !r.joined.includes('joestsolutions') && !r.sent.some((s) => /joest(?!ech)/.test(s)))
  check('...the visitor gets the corrected address in place, with no replace needed', r.joined === `Email ${JOE}. He replies fast.` && r.replace === null)
  const atEnd = stream(['Write to joe@joestsolutions', '.com'])
  check('...including an address that ends the answer', atEnd.joined === `Write to ${JOE}` && atEnd.replace === null)
}
{
  const own = 'joe@joestechsolution.com'
  const r = stream(['Noted: ', 'joe@joestech', 'solution.com. Joe is ', JOE, '.'], { visitorsOwn: [own] })
  check('streamed: the visitor\u2019s own address is never touched', r.joined === `Noted: ${own}. Joe is ${JOE}.` && r.replace === null)
}
{
  // The mailbox name arrives before its "@", in another case: it is already
  // sent, so the corrected answer follows as a replace.
  const r = stream(['Email ', 'Joe', '@joestsolutions.com today.'])
  check('streamed: a capitalised mailbox sent before its "@" is corrected by a replace at the end',
    !r.joined.includes('joestsolutions') && r.replace === `Email ${JOE} today.` && r.text === `Email ${JOE} today.`)
}
{
  const fp = PROMPT_FINGERPRINTS[0] // 'BREVEDAD OBLIGATORIA'
  const r = stream(['Here is my setup: ', fp.slice(0, 8), fp.slice(8), ' and more'])
  check('a fingerprint split across two chunks is caught on the chunk that completes it, before it is sent',
    r.leakAt === 2 && !r.joined.includes(fp) && !r.joined.includes(fp.slice(8)))
  const canary = stream(['ok ', 'internal_ref: ZXCV_12', '34abcd'])
  check('...and so is the canary', canary.leakAt === 2 && !canary.joined.includes('ZXCV_1234abcd'))
  // Token-sized chunks: the longest fingerprint (22 characters) in eight
  // pieces, the last one a single character. The chunk that completes it sees
  // only itself and the window before it, so this fails for any window under 21.
  const long = PROMPT_FINGERPRINTS.find((f) => f === 'Instrucciones CRÍTICAS')!
  const pieces = ['Sure: ', ...Array.from({ length: Math.ceil(long.length / 3) }, (_, i) => long.slice(i * 3, i * 3 + 3)), ' and the rest']
  const split8 = stream(pieces)
  check('a fingerprint streamed in 3-character chunks is caught on the chunk that completes it, before it is sent',
    long.length === 22 && pieces.length === 10 && split8.leakAt === 8 && !split8.joined.toLowerCase().includes(long.toLowerCase()),
    JSON.stringify({ leakAt: split8.leakAt, joined: split8.joined }))
  check('LEAK_RESPONSE is a real sentence (what the caller sends instead)', LEAK_RESPONSE.length > 40)
}
{
  const r = stream(['\n\n', '  '])
  check('whitespace-only text sends nothing', r.sent.length === 0 && r.replace === null)
  const lead = stream(['\n', 'Hi there.'])
  check('...and text after it is sent whole', lead.joined === '\nHi there.')
}

// --- The emitter's cost follows the chunk, not the answer so far ----------------------
// Review of the instant-reply branch (2026-10-02): every chunk re-ran the
// address correction and the held-word regex over the WHOLE answer, so a
// reply's CPU grew with the square of its length (46ms for 4,000 characters
// in 4-character chunks with an address early, where a Workers Free request
// gets 10ms in all). The emitter now keeps the answer as a settled part,
// corrected once, and the word still being written.
const { containsFingerprint } = await import('../functions/api-src/_shared/rag.js')
{
  // The reference: the same rules applied to the whole answer on every chunk
  // (the emitter as it was). The emitter must say exactly what it says, chunk
  // by chunk, on answers and chunkings no one wrote by hand.
  function reference({ canary = '', contact = '', visitorsOwn = [] as string[] }) {
    let raw = ''
    let visible = ''
    const fix = (t: string) => (contact && t.includes('@') ? fixContactEmail(t, contact, visitorsOwn) : t)
    const releasable = (t: string) => { const tail = t.match(/\S*$/)![0]; return tail.includes('@') ? t.slice(0, t.length - tail.length) : t }
    const take = (ready: string) => {
      if (ready.length <= visible.length || (!visible && !ready.trim())) return ''
      const out = ready.slice(visible.length)
      visible += out
      return out
    }
    return {
      push(chunk: string) {
        raw += chunk
        const recent = raw.slice(-(chunk.length + 64))
        if (containsFingerprint(recent) || (canary && recent.includes(canary))) return { leak: true, out: '' }
        return { leak: false, out: take(releasable(fix(raw))) }
      },
      end() { const text = fix(raw); const out = take(text); return { out, replace: visible && visible !== text ? text : null, text } },
      get visible() { return visible },
    }
  }
  // mulberry32: exact 32-bit integer math, so every seed gives its own
  // stream. The first version, (seed * 1103515245 + 12345) & 0x7fffffff, ran
  // in floating point: the product passed 2^53 and lost its low bits, every
  // seed fell into one cycle of 10,466 draws, and its "3,000 answers" were 136
  // distinct texts, none with a whole fingerprint or the canary in it (review
  // round 1, 2026-10-03). A leak window cut to 12 characters passed it.
  let seed = 20261002
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]
  const words = ['Email', 'Joe', 'he', 'replies.', '(see', 'below)', '[link](mailto:', ')', '—', 'é', '😀', JOE, 'joe@joestsolutions.com',
    'Joe@JoesTechSolutions.com', 'joe@joestechsolution.com', 'jon@joestechsolutions.com', BLASJ, 'blasj408@gmial.com', '@', 'x@y', 'joe@',
    '@joestsolutions.com', 'BREVEDAD', 'OBLIGATORIA', 'ZXCV_12', '34abcd']
  // Whole secrets, one word each, so random chunkings split them three, four,
  // eight ways. Drawn for about one word in 30: roughly one answer in four
  // leaks, the rest run the address path to the end.
  const secrets = ['BREVEDAD OBLIGATORIA', 'Instrucciones CRÍTICAS', 'instrucciones críticas', 'ZXCV_1234abcd']
  const SECRET_RE = /brevedad obligatoria|instrucciones críticas|ZXCV_1234abcd/gi
  const spaces = [' ', ' ', '\n', '\n\n', '\t', ' ', ' ', '﻿', '\u0085', '']
  const ANSWERS = 3000
  let differs = ''
  const distinct = new Set<string>()
  let leaked = 0
  let leakedAcross3 = 0 // the secret that set off the leak spans 3 or more chunks
  let leakedLong = 0 // ...and is a fingerprint of 20 or more characters
  for (let k = 0; k < ANSWERS && !differs; k++) {
    const text = Array.from({ length: 1 + Math.floor(rnd() * 20) }, () => (rnd() < 1 / 30 ? pick(secrets) : pick(words)) + pick(spaces)).join('')
    distinct.add(text)
    const opts = { canary: pick(['ZXCV_1234abcd', '']), contact: pick([JOE, JOE, BLASJ, '']), visitorsOwn: pick([[], ['JOE@joestechsolution.com']]) }
    const a = replyText(opts)
    const b = reference(opts)
    const starts: number[] = [] // where each non-empty chunk starts in the answer
    let past = -1 // a few chunks past a leak too
    for (let i = 0; i < text.length && past < 3;) {
      const n = rnd() < 0.1 ? 0 : rnd() < 0.15 ? 1 + Math.floor(rnd() * 60) : 1 + Math.floor(rnd() * 6)
      const c = text.slice(i, i + n)
      if (c) starts.push(i)
      i += c.length
      const x = a.push(c)
      const y = b.push(c)
      if (x.leak !== y.leak || x.out !== y.out || a.visible !== b.visible) { differs = JSON.stringify({ text, at: i, chunk: c, emitter: x, reference: y }); break }
      if (x.leak && past < 0) {
        leaked++
        // The secret this chunk completed: the first one that ends inside it
        // (the canary counts only when it is this answer's canary).
        const hit = [...text.slice(0, i).matchAll(SECRET_RE)]
          .find((m) => m.index! + m[0].length > i - c.length && (opts.canary || !m[0].startsWith('ZXCV')))
        if (hit) {
          const spans = 1 + starts.filter((s) => s > hit.index! && s < hit.index! + hit[0].length).length
          if (spans >= 3) { leakedAcross3++; if (hit[0].length >= 20) leakedLong++ }
        }
      }
      if (x.leak || past >= 0) past++
    }
    if (!differs && JSON.stringify(a.end()) !== JSON.stringify(b.end())) differs = JSON.stringify({ text, end: true })
  }
  check(`the emitter sends exactly what the whole-answer reference sends, chunk by chunk (${ANSWERS.toLocaleString('en-US')} random answers and chunkings)`, !differs, differs)
  // A fuzz proves nothing about a path it never takes. These fail if the
  // generator collapses again or the secrets stop being split. (Counted only
  // over a full run: a difference above stops the loop early.)
  if (!differs) {
    check('...the random answers are distinct', distinct.size >= ANSWERS * 0.95, `${distinct.size} distinct of ${ANSWERS}`)
    check('...and they take the leak path often, with secrets split across 3 or more chunks',
      leaked >= ANSWERS / 10 && leakedAcross3 >= ANSWERS / 20 && leakedLong >= ANSWERS / 40,
      `${leaked} leaked, ${leakedAcross3} across 3+ chunks, ${leakedLong} of those a fingerprint of 20+ characters`)
  }

  // CPU per character for a long answer against a short one, both streamed in
  // 4-character chunks with an address early, the same number of characters
  // timed on each side: a slow or loaded runner slows both alike. Linear cost
  // keeps the two near 1:1; the whole-answer version came out about 10:1.
  const answer = (n: number) => {
    let s = `Hi! Email ${JOE} and he replies within a day. `
    while (s.length < n) s += 'Joe builds private AI setups for small businesses, on hardware they own. '
    return Array.from({ length: n / 4 }, (_, i) => s.slice(i * 4, i * 4 + 4))
  }
  const perChar = (chunks: string[], reps: number) => {
    const t0 = process.cpuUsage()
    for (let r = 0; r < reps; r++) {
      const e = replyText({ contact: JOE, canary: 'ZXCV_1234abcd' })
      for (const c of chunks) e.push(c)
      e.end()
    }
    const used = process.cpuUsage(t0)
    return (used.user + used.system) / (reps * chunks.length * 4)
  }
  const short = answer(250)
  const long = answer(4000)
  for (let i = 0; i < 3; i++) { perChar(short, 8); perChar(long, 1) } // warm up the JIT
  const shortRuns: number[] = []
  const longRuns: number[] = []
  for (let i = 0; i < 7; i++) { shortRuns.push(perChar(short, 128)); longRuns.push(perChar(long, 8)) }
  const median = (xs: number[]) => [...xs].sort((p, q) => p - q)[xs.length >> 1]
  const budget = 3 * median(shortRuns) // the short answer's cost per character, scaled to 4,000, with room
  check('a 4,000-character answer in 4-character chunks costs at most 3x the per-character CPU of a 250-character one (the median of 7 runs)',
    median(longRuns) <= budget,
    `${median(longRuns).toFixed(3)}µs per character against a budget of ${budget.toFixed(3)} (${(median(longRuns) * 4).toFixed(2)}ms for 4,000 characters)`)
}

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1) }
console.log('ok — near misses of the contact address are corrected; every other address is left alone')
