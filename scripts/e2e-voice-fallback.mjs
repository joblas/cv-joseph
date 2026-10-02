// Browser check of the voice widget's relay fallback (src/useGeminiVoice.ts).
// On a VPN, voice failed with "Connection error" (2026-10-02); the widget now
// goes through this site's relay, and if the relay itself fails before the
// session starts it tries Google's address once. Here the real widget runs in
// a real browser with a fake microphone; the token endpoint and both sockets
// (the relay, Google) are mocked, so nothing reaches production or Google.
//
// Manual, not in CI (it needs a browser and a built site):
//   npm run build && npx vite preview --port 4011
//   node scripts/e2e-voice-fallback.mjs http://localhost:4011/
// Env: PLAYWRIGHT_CORE (path or package name, default "playwright-core"),
// CHROMIUM_PATH (a Chromium or headless-shell binary; default: Playwright's).
// About a minute (one scenario waits out the real connect limit); ONLY=<part
// of a title> runs one scenario.
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core");
const SITE = process.argv[2] || "http://localhost:4011/";
const RELAY = "wss://cloudyjoe.com/api/voice-live";
const GOOGLE = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";
const TICKET = "auth_tokens/T1~0123456789abcdef0123456789abcdef", BARE = "auth_tokens/T1";
const LISTENING = "Listening...", ERROR = "Connection error. Please try again.";

// Endpoint behaviours. Each gets Playwright's WebSocketRoute.
const works = (ws) => ws.onMessage((m) => { if (String(m).includes('"setup"')) ws.send(JSON.stringify({ setupComplete: {} })); });
const closes = (code, reason) => (ws) => ws.close({ code, reason });
const silent = () => {};
const worksThenDrops = (ws) => ws.onMessage((m) => {
  if (String(m).includes('"setup"')) { ws.send(JSON.stringify({ setupComplete: {} })); setTimeout(() => ws.close({ code: 1011, reason: "dropped mid-session" }), 1500); }
});

const SCENARIOS = [
  { name: "relay works: the session runs through the relay, Google's address is never tried", relay: works, google: works, expect: LISTENING, relayConns: 1, googleConns: 0 },
  { name: "relay refused (1011): one fallback to Google's address with the bare token, and the session runs", relay: closes(1011, "the voice service refused the connection (HTTP 403)"), google: works, expect: LISTENING, relayConns: 1, googleConns: 1 },
  { name: "relay silent: after the connect limit, one fallback, and the session runs", relay: silent, google: works, expect: LISTENING, relayConns: 1, googleConns: 1, slow: true },
  { name: "relay and Google both fail: the error shows, after exactly one fallback (no loop)", relay: closes(1011, "x"), google: closes(1008, "token used"), expect: ERROR, relayConns: 1, googleConns: 1 },
  { name: "an older server (no direct fallback offered): a relay failure shows the error, nothing else is tried", relay: closes(1011, "x"), google: works, expect: ERROR, relayConns: 1, googleConns: 0, noDirect: true },
  { name: "a drop after the session started is not retried on the other address", relay: worksThenDrops, google: works, expect: LISTENING, then: ERROR, relayConns: 1, googleConns: 0 },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
let failed = 0;
const only = process.env.ONLY;
for (const s of SCENARIOS) {
  if (only && !s.name.includes(only)) continue;
  const ctx = await browser.newContext({ permissions: ["microphone"] });
  const page = await ctx.newPage();
  const conns = { relay: [], google: [] };
  await page.route("**/api/voice-token", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { provider: "gemini" } });
    const body = { provider: "gemini", token: TICKET, model: "models/test", wsUrl: RELAY, traceId: null };
    if (!s.noDirect) body.direct = { wsUrl: GOOGLE, token: BARE };
    return route.fulfill({ json: body });
  });
  await page.route("**/api/voice-trace", (route) => route.fulfill({ json: { ok: true } }));
  await page.routeWebSocket((u) => u.href.startsWith(RELAY), (ws) => { conns.relay.push(ws.url()); s.relay(ws); });
  await page.routeWebSocket((u) => u.href.startsWith(GOOGLE), (ws) => { conns.google.push(ws.url()); s.google(ws); });
  const t0 = Date.now();
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Open chat with Cloudy-Joe Agent" }).click();
  const mic = page.getByRole("button", { name: "Talk to Cloudy-Joe" });
  await mic.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForFunction(() => { const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Talk to Cloudy-Joe"); return b && !b.disabled; }, null, { timeout: 15000 });
  await mic.click();
  const checks = [];
  try {
    await page.getByText(s.expect, { exact: true }).first().waitFor({ timeout: s.slow ? 30000 : 8000 });
    checks.push([`shows "${s.expect}"`, true]);
  } catch { checks.push([`shows "${s.expect}"`, false]); }
  if (s.then) {
    try { await page.getByText(s.then, { exact: true }).first().waitFor({ timeout: 8000 }); checks.push([`then shows "${s.then}"`, true]); }
    catch { checks.push([`then shows "${s.then}"`, false]); }
  }
  await page.waitForTimeout(1000); // anything late (a second fallback) would show up here
  checks.push([`relay connections ${conns.relay.length} == ${s.relayConns}`, conns.relay.length === s.relayConns]);
  checks.push([`Google connections ${conns.google.length} == ${s.googleConns}`, conns.google.length === s.googleConns]);
  if (conns.relay[0]) checks.push(["relay got the ticket", new URL(conns.relay[0]).searchParams.get("access_token") === TICKET]);
  if (conns.google[0]) checks.push(["Google got the bare token", new URL(conns.google[0]).searchParams.get("access_token") === BARE]);
  const ok = checks.every(([, v]) => v);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} (${((Date.now() - t0) / 1000).toFixed(1)}s) ${s.name}`);
  for (const [n, v] of checks) if (!v) console.log(`   ✗ ${n}`);
  await ctx.close();
}
await browser.close();
console.log(failed ? `${failed} scenario(s) failed` : "all scenarios passed");
process.exit(failed ? 1 : 0);
