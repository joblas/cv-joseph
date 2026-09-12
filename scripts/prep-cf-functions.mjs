// Build script: prepare Cloudflare Pages Functions from the Vercel api/ dir.
// 1. Copy api/ → functions/api-src/ (workers-vite plugin bundles from functions/)
// 2. Patch Vercel-isms:
//    - @vercel/functions waitUntil → shim (second handler arg)
//    - chatbot-prompt.txt import   → generated module
//    - _shared/leads.js            → copy (exists only at newer upstream)
// 3. Generate headers/redirects from vercel.json → dist/_headers, dist/_redirects

import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs'
import { join, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcApi = join(root, 'api')
const dstApi = join(root, 'functions', 'api-src')

// 1. fresh copy
rmSync(dstApi, { recursive: true, force: true })
mkdirSync(dstApi, { recursive: true })
cpSync(srcApi, dstApi, { recursive: true })

if (!existsSync(join(dstApi, '_shared', 'leads.js'))) {
  console.error('FATAL: api/_shared/leads.js missing — chat.js imports it; rebase onto main')
  process.exit(1)
}

// Generated prompt module (scripts/gen-prompt-module.mjs) lives at
// functions/api/_prompt-fallback.js; copy it to api-src/ root so every
// patched import below can reach it with a depth-relative path.
const promptSrc = join(root, 'functions', 'api', '_prompt-fallback.js')
if (!existsSync(promptSrc)) {
  console.error('FATAL: run scripts/gen-prompt-module.mjs first (missing functions/api/_prompt-fallback.js)')
  process.exit(1)
}
cpSync(promptSrc, join(dstApi, '_prompt-fallback.js'))

// 2a. Patch waitUntil imports + prompt import + add process.env shim usage
function walk(dir, cb) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name)
    if (f.isDirectory()) walk(p, cb)
    else if (f.name.endsWith('.js')) cb(p)
  }
}

// Replacement for `import { waitUntil } from '@vercel/functions'`: resolve the
// current request's Pages ctx (set by functions/api/[[path]].js) so tasks fired
// inside a streaming Response body still attach to THIS request's waitUntil.
const waitUntilShim = `function waitUntil(p) { const c = globalThis.__cfCtxStore && globalThis.__cfCtxStore.getStore(); if (c) c.waitUntil(Promise.resolve(p).catch(() => {})); else console.error('[cf] waitUntil called outside a request context — task dropped') }`

let patchedWaitUntil = 0
walk(dstApi, (p) => {
  let raw = readFileSync(p, 'utf8')
  let out = raw

  // Replace @vercel/functions import with local shim
  out = out.replace(/import \{\s*waitUntil\s*\} from ['"]@vercel\/functions['"]/, () => { patchedWaitUntil++; return waitUntilShim })

  // Replace txt import with generated module, relative to this file's depth
  // under api-src/ (chat.js → './', _shared/prompt.js → '../').
  const depth = relative(dstApi, dirname(p)).split(sep).filter(Boolean).length
  const rel = depth === 0 ? './_prompt-fallback.js' : '../'.repeat(depth) + '_prompt-fallback.js'
  out = out.replace(
    /import (\w+) from ['"](?:\.\.\/)+chatbot-prompt\.txt['"]/,
    (_, name) => `import ${name} from '${rel}'`,
  )

  if (out !== raw) {
    writeFileSync(p, out)
    console.log('patched:', p.replace(dstApi, 'api'))
  }
})

// 2b. Nothing may still reference @vercel/functions: its waitUntil is
// `getContext().waitUntil?.()` — a silent no-op outside Vercel.
let leftovers = []
walk(dstApi, (p) => { if (readFileSync(p, 'utf8').includes('@vercel/functions')) leftovers.push(p.replace(dstApi, 'api')) })
if (leftovers.length) {
  console.error('FATAL: unpatched @vercel/functions import in:', leftovers.join(', '))
  process.exit(1)
}
console.log(`prep-cf: patched waitUntil in ${patchedWaitUntil} file(s)`)

// 3. _headers + _redirects from vercel.json → cf-headers.txt / cf-redirects.txt
//    (npm run cf:post copies them into dist/ after vite build wipes it)
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
// Vercel path pattern → Pages pattern. Sources use '*', destinations ':splat'.
function convertSource(s) {
  return s.replace(/:path\+/g, '*').replace('(.*)', '*').replace('//', '/')
}
function convertDest(s) {
  return s.replace(/:path\+/g, ':splat').replace('(.*)', ':splat')
}
// Hosts that only exist on the Vercel platform (toolbar, live feedback,
// speed insights). Nothing is served from them on Pages, so drop them
// from the CSP rather than carry dead allowlist entries.
const VERCEL_CSP_HOSTS = [
  'https://vercel.live', 'https://*.pusher.com', 'wss://*.pusher.com',
  'https://va.vercel-scripts.com', 'https://vitals.vercel-insights.com',
]
function stripVercelCsp(value) {
  let out = value
  for (const h of VERCEL_CSP_HOSTS) out = out.split(' ' + h).join('')
  return out
}
let headers = ''
for (const rule of vercel.headers || []) {
  headers += convertSource(rule.source) + '\n'
  for (const h of rule.headers || []) {
    const v = h.key.toLowerCase() === 'content-security-policy' ? stripVercelCsp(h.value) : h.value
    headers += `  ${h.key}: ${v}\n`
  }
  headers += '\n'
}
writeFileSync(join(root, 'cf-headers.txt'), headers)

// Pages canonicalizes directory indexes TO a trailing slash (308 /x → /x/),
// so Vercel's strip-trailing-slash rule (/:path+/ → /:path+) would loop
// against it. Drop it; Pages owns slash handling.
const seen = new Set()
let redirects = ''
function addRule(src, dest, status) {
  if (seen.has(src)) return // first rule per source wins (matches Vercel order)
  seen.add(src)
  redirects += `${src}  ${dest}  ${status}\n`
  // Vercel normalised '/x/' → '/x' before matching; Pages matches exact
  // paths, so emit the slash variant for every exact-path rule.
  if (!src.includes('*') && !src.endsWith('/')) addRule(src + '/', dest, status)
}
for (const r of vercel.redirects || []) {
  if (r.source === '/:path+/') continue
  addRule(convertSource(r.source), convertDest(r.destination), r.permanent === false ? 302 : 301)
}
// Vercel rewrites → Pages 200 rules. Identity rewrites (/x → /x/index.html)
// are what Pages does natively for a directory index, so only aliases whose
// destination differs from the source are emitted.
for (const r of vercel.rewrites || []) {
  const dest = r.destination.replace(/\/index\.html$/, '')
  if (dest === r.source) continue
  addRule(convertSource(r.source), convertDest(dest) + '/', 200)
}
writeFileSync(join(root, 'cf-redirects.txt'), redirects)

console.log('prep-functions: done')
