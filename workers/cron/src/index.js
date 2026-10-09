// Cloudy-Joe daily eval cron — Cloudflare Cron Trigger → Pages Function.
//
// Daily at 08:00 UTC this calls POST CRON_URL on the cloudyjoe Pages project
// with `Authorization: Bearer CRON_SECRET` — the auth shape
// api/cron/evaluate.js already expects (docs/cron-eval.md).
//
// Both bindings are set in the Cloudflare dashboard:
//   CRON_URL      — plain var (https://cloudyjoe.com/api/cron/evaluate)
//   CRON_SECRET   — secret, same value as the Pages project's CRON_SECRET
// This file never holds values.

export default {
  async scheduled(controller, env, ctx) {
    if (!env.CRON_URL || !env.CRON_SECRET) throw new Error('[cloudyjoe-cron] CRON_URL / CRON_SECRET not set on the Worker')

    const response = await fetch(env.CRON_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    })

    if (!response.ok) {
      throw new Error(`[cloudyjoe-cron] ${response.status} from ${env.CRON_URL} — see the cron log for the run`)
    }
  },
}