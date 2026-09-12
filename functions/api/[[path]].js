// ---------------------------------------------------------------------------
// functions/api/[[path]].js — CF Pages Functions router for the Vercel→CF
// migration. Maps /api/* onto the original edge handlers (unmodified sources,
// patched copies in ./api-src/), with Workers shims for process.env/waitUntil.
// ---------------------------------------------------------------------------

import { installEnv } from './_shims.js'

function drainWaitUntilTasks() {
  const tasks = globalThis.__cfWaitUntilTasks || []
  globalThis.__cfWaitUntilTasks = []
  return tasks
}

export const onRequest = async (ctx) => {
  const { request, env, params, waitUntil } = ctx
  const url = new URL(request.url)
  // [[path]] yields an array of segments on Pages ('ops/stats' → ['ops','stats'])
  const raw = params.path
  const segs = (Array.isArray(raw) ? raw : String(raw || '').split('/')).filter(Boolean)

  installEnv(env)

  const mods = {
    'ops/auth': () => import('../api-src/ops/auth.js'),
    'ops/evals': () => import('../api-src/ops/evals.js'),
    'ops/prompts': () => import('../api-src/ops/prompts.js'),
    'ops/rag-stats': () => import('../api-src/ops/rag-stats.js'),
    'ops/stats': () => import('../api-src/ops/stats.js'),
    'ops/traces': () => import('../api-src/ops/traces.js'),
    'chat': () => import('../api-src/chat.js'),
    'rag-search': () => import('../api-src/rag-search.js'),
    'voice-token': () => import('../api-src/voice-token.js'),
    'voice-trace': () => import('../api-src/voice-trace.js'),
  }

  const key = segs.join('/')
  const loader = mods[key]
  if (!loader) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  }

  const mod = await loader()
  // Vercel edge handlers are default exports
  const handler = mod.default || mod.handler
  // Pre-drain so a slow prior request's tasks don't pile up unbounded
  for (const t of drainWaitUntilTasks()) ctx.waitUntil(Promise.resolve(t).catch(() => {}))
  try {
    return await handler(request)
  } finally {
    for (const t of drainWaitUntilTasks()) ctx.waitUntil(Promise.resolve(t).catch(() => {}))
  }
}