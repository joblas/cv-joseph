# Fix 14b — the daily cron that died with Vercel, and its Cloudflare equivalent

`vercel.json` declared a Vercel Cron Job on this site:

- path: `/api/cron/evaluate`
- schedule: `0 8 * * *` (daily 08:00 UTC)
- handler: `api/cron/evaluate.js` (source) → `functions/api-src/cron/evaluate.js`
  (the Cloudflare copy `scripts/prep-cf-functions.mjs` makes at build time)

## What the job does

An LLM-as-judge batch evaluator over the chatbot's traces ("Batch eval" in
`src/chatbot-i18n.ts`):

1. Authenticates the caller: requires `Authorization: Bearer $CRON_SECRET`,
   otherwise `401`.
2. Fetches up to 50 traces from Langfuse, keeps those from the last 24 h,
   skips traces already scored (`intent_category` / `quality` present).
3. Scores each remaining trace with Claude (`@anthropic-ai/sdk`): intent
   category, response_quality (0–1), safety_score (0–1), is_jailbreak_attempt.
4. Writes the scores back to Langfuse (plus `jailbreak_attempt = 1` on hits).
5. Emails a digest via Resend when there are jailbreak attempts or
   `safety_score < 0.5` (skipped unless `RESEND_API_KEY` + `ALERT_EMAIL` set).
6. Returns a JSON summary: evaluated / jailbreaks / lowSafety / errors /
   tracesChecked / alertsSent / lowQualityTraces.

Environment the handler reads: `CRON_SECRET`, `LANGFUSE_PUBLIC_KEY`,
`LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`, `ANTHROPIC_API_KEY`,
`RESEND_API_KEY`, `ALERT_EMAIL`.

## Current state: not running anywhere

- **Vercel** — retired (site lives on Cloudflare Pages since 2026-09-12); its
  cron has not fired since.
- **Cloudflare Pages** — Pages has no cron-trigger facility, and the endpoint
  is not even mounted: `functions/api/[[path]].js` dispatches only the routes
  in its `mods` map, which has no `cron/evaluate` entry. Live probe:

  ```
  $ curl -X POST https://cloudyjoe.com/api/cron/evaluate
  404 {"error":"Not found"}
  ```

  So the job would 404 even if something called it with the right secret.
- **GitHub Actions** — `evals.yml` and `adversarial.yml` are
  `workflow_dispatch`-only; nothing schedules the endpoint.

**Stale without it:** new chat traces stop receiving daily quality/safety
scores, and the jailbreak-alert email digest stops — the self-checking loop
the site documents is silently off; only the trace recording (online scoring
inside the chat call) still works.

## Proposal: a tiny Cron-Trigger Worker (`workers/cron/`)

Cloudflare Pages cannot schedule anything; cron triggers are a Workers
feature. The minimal Cloudflare-native shape is a Worker whose `scheduled()`
handler POSTs the deployed Pages Function with the `Bearer CRON_SECRET`
header the handler already expects. A scheduled GitHub Action would work too
but costs Actions minutes and stores the secret in a second platform; the
Worker keeps trigger + site in one Cloudflare account.

- `workers/cron/wrangler.toml` — `[triggers] crons = ["0 8 * * *"]` (same UTC
  schedule), plus the endpoint URL as an ordinary `CRON_URL` var.
- `workers/cron/src/index.js` — `scheduled()` → `POST CRON_URL` with
  `Authorization: Bearer CRON_SECRET`; non-2xx throws so failures show up in
  the Worker's cron execution logs instead of vanishing.

`functions/api/[[path]].js` gets the missing route (+1 line) so the endpoint
actually exists on Pages.

## What Joe sets (names only — no values live in this repo)

Worker `cloudyjoe-cron` → Variables and Secrets:

- `CRON_URL` — plain var: `https://cloudyjoe.com/api/cron/evaluate`
- `CRON_SECRET` — secret. Generate it once:

  ```
  python3 -c "import secrets; print(secrets.token_hex(24))"
  ```

Cloudflare Pages project `cloudyjoe` → production Variables and Secrets:

- `CRON_SECRET` — the **same value** as the Worker's (two bindings, one
  secret). Binding it does not reach already-uploaded Functions code, so
  redeploy Pages once after binding.

## Deploy steps (manual — nothing in this PR deploys)

```
cd workers/cron
npx wrangler deploy                  # registers the cron trigger + code
npx wrangler secret put CRON_SECRET  # run this right after the deploy
npx wrangler secret list             # confirm CRON_SECRET is bound
```

(Run from the repo root after `npm ci` so `npx` resolves the pinned wrangler.
Do not leave the deploy overnight before setting the secret — the first
cron fire at 08:00 UTC would fail auth, visibly, in the cron log.)

Then bind `CRON_SECRET` on the Pages project (dashboard) and trigger one
Pages production redeploy.

## Verify after deploy

- `curl -X POST https://cloudyjoe.com/api/cron/evaluate` → `401` with no
  auth, `200 {"success":true,...}` with the correct bearer.
- Next morning: Cloudflare dashboard → Workers → `cloudyjoe-cron` → cron
  logs show `HTTP 200`; the Langfuse dashboard shows fresh daily scores.

## Rollback

- Revert this PR — the endpoint goes back to 404 and nothing references the
  schedule.
- Delete the `cloudyjoe-cron` Worker (or disable its cron trigger) in the
  Cloudflare dashboard. No other surface holds a reference to it.

## What stays unverified

- The handler's first real end-to-end run under Workers (everything is
  I/O-bound — Langfuse, Anthropic, Resend over HTTPS — so CPU limits are
  unlikely to bite, but watch the first cron execution).
- That the Pages project picked up the new `CRON_SECRET` binding (the 401/200
  curl above is the cheap probe before the first run).
- The `CRON_URL` default assumes production; if a staging hostname is ever
  used, set `CRON_URL` rather than editing code.