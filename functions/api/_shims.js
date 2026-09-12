// process.env for the ported Vercel handlers.
// With nodejs_compat and compatibility_date ≥ 2025-04-01 the runtime already
// populates process.env from the Worker's bindings; this asserts that (a
// missing flag would otherwise surface as a TypeError inside every route)
// and mirrors env on top so local dev and older dates behave the same.
export function installEnv(env) {
  if (!globalThis.process || typeof globalThis.process.env !== 'object') {
    throw new Error('Pages Functions require the nodejs_compat compatibility flag (process.env is not populated) — see wrangler.toml')
  }
  Object.assign(globalThis.process.env, env)
}
