// Workers-compatible process.env + waitUntil shim.
// Original Vercel functions read process.env directly; Workers exposes env
// via the context object. Pages Functions set globals before dispatch.

export function installEnv(env) {
  globalThis.process = globalThis.process || {}
}

// waitUntil: buffer tasks, flush via ctx.waitUntil in the router entry
export function createWaitUntil() {
  const tasks = []
  const waitUntil = (p) => { tasks.push(Promise.resolve(p).catch(() => {})) }
  return { waitUntil, flush: (ctx) => { for (const t of tasks) ctx.waitUntil(Promise.resolve(t)) } }
}