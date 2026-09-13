// ---------------------------------------------------------------------------
// functions/api/[[path]].js — CF Pages Functions router for the Vercel→CF
// migration. Maps /api/* onto the original edge handlers (unmodified sources
// in api/, build-time patched copies in ../api-src/ via `npm run cf:prep`).
//
// Two Workers adaptations live here:
//  - process.env: the runtime populates it from bindings (nodejs_compat,
//    compatibility_date ≥ 2025-04-01); installEnv() asserts that and mirrors
//    env on top so a missing flag fails loudly instead of as a 500 per route.
//  - waitUntil: the patched handlers call a shim that resolves the CURRENT
//    request's ctx through AsyncLocalStorage. This must be request-scoped
//    (not a global queue) because chat.js returns its Response before the
//    stream body runs, and the Langfuse flush / leak alerts fire inside
//    that body, after the handler has already returned.
// ---------------------------------------------------------------------------

import { AsyncLocalStorage } from 'node:async_hooks'
import { installEnv } from './_shims.js'
import { corsHeaders } from '../api-src/_shared/personas.js'

const ctxStore = new AsyncLocalStorage()
globalThis.__cfCtxStore = ctxStore

const mods = {
  'ops/auth': () => import('../api-src/ops/auth.js'),
  'ops/evals': () => import('../api-src/ops/evals.js'),
  'ops/prompts': () => import('../api-src/ops/prompts.js'),
  'ops/rag-stats': () => import('../api-src/ops/rag-stats.js'),
  'ops/stats': () => import('../api-src/ops/stats.js'),
  'ops/traces': () => import('../api-src/ops/traces.js'),
  'ops/trace': () => import('../api-src/ops/trace/[id].js'), // /api/ops/trace/:id (id read from URL)
  'chat': () => import('../api-src/chat.js'),
  'rag-search': () => import('../api-src/rag-search.js'),
  'voice-token': () => import('../api-src/voice-token.js'),
  'voice-trace': () => import('../api-src/voice-trace.js'),
}

function routeKey(segs) {
  if (segs[0] === 'ops' && segs[1] === 'trace' && segs.length === 3) return 'ops/trace'
  return segs.join('/')
}

// Cloudflare appends to a client-supplied X-Forwarded-For instead of replacing
// it, so handlers that read XFF[0] (voice-token rate limit) would trust the
// client. Pin both proxy headers to the edge-verified connecting IP.
function withTrustedIp(request) {
  const ip = request.headers.get('cf-connecting-ip')
  if (!ip) return request
  const headers = new Headers(request.headers)
  headers.set('x-forwarded-for', ip)
  headers.set('x-real-ip', ip)
  return new Request(request, { headers })
}

export const onRequest = async (ctx) => {
  const { request, env, params } = ctx
  // [[path]] yields an array of segments on Pages ('ops/stats' → ['ops','stats'])
  const raw = params.path
  const segs = (Array.isArray(raw) ? raw : String(raw || '').split('/')).filter(Boolean)

  installEnv(env)

  // CORS for the other sites this brain serves (joestechsolutions.com). Only
  // origins listed by a persona get headers; same-origin requests are untouched.
  const cors = corsHeaders(request)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: Object.keys(cors).length ? 204 : 405, headers: cors })
  }

  const loader = mods[routeKey(segs)]
  if (!loader) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...cors } })
  }

  const mod = await loader()
  const response = await ctxStore.run(ctx, () => mod.default(withTrustedIp(request)))
  if (!Object.keys(cors).length) return response
  const headers = new Headers(response.headers)
  for (const [k, v] of Object.entries(cors)) headers.set(k, v)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}
