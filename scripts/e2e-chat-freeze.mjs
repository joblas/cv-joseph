// End-to-end check that a chat reply can never freeze the widget (2026-10-02:
// Joe hit a reply frozen at about a minute). The real widget runs in a real
// browser; its chat request is intercepted and handed to a local fake server
// that streams like the real one and misbehaves on cue: the connection dies
// after the server answered, a reply is cut off, the server reports an error,
// an older server without heartbeats is slow. Nothing reaches production.
//
// Manual, not in CI (it needs a browser and a built site). Run it against a
// built site served locally, for either widget:
//   cloudyjoe.com:       npm run build && npx vite preview --port 4001
//     node scripts/e2e-chat-freeze.mjs http://localhost:4001/ http://localhost:4001/api/chat "Open chat with Cloudy-Joe Agent" "Type your question..."
//   joestechsolutions.com (that repo): next build && next start -p 3999
//     node scripts/e2e-chat-freeze.mjs http://localhost:3999/ https://cloudyjoe.com/api/chat "Open chat with Joe's Tech Agent" "Ask anything about what Joe builds…"
// Env: PLAYWRIGHT_CORE (path or package name, default "playwright-core"),
// CHROMIUM_PATH (a Chromium or headless-shell binary; default: Playwright's).
// Takes about 3 minutes (two scenarios wait out the real 20s silence limit);
// E2E_ONLY=<part of a title> runs one scenario.
import http from "node:http";
import https from "node:https";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core");
const [site, chatUrl, openName, placeholder] = process.argv.slice(2);
const data = (text) => `data: ${JSON.stringify({ text })}\n\n`;
const ANSWER = [": connected\n\n", ": ping\n\n", 'event: status\ndata: {"phase":"searching"}\n\n', data("Here is the "), data("answer."), "data: [DONE]\n\n"];
const STEPS = {
  answer: async (send) => { for (const c of ANSWER) send(c); return "end"; },
  slowAnswer: async (send) => { send(": connected\n\n"); await sleep(1500); for (const c of ANSWER.slice(1)) send(c); return "end"; },
  hang: async (send) => { send(": connected\n\n"); return "hang"; }, // the server answered, then the connection died
  cut: async (send) => { send(": connected\n\n"); send(data("Half an ans")); return "end"; },
  serverError: async (send) => { send(": connected\n\n"); send(`data: ${JSON.stringify({ text: "Sorry, something went wrong. Try again.", replace: true, error: true })}\n\n`); send("data: [DONE]\n\n"); return "end"; },
  serverRetry: async (send) => { send(": connected\n\n"); send(data("Half an ans")); send(`data: ${JSON.stringify({ text: "", replace: true })}\n\n`); send('event: status\ndata: {"phase":"retrying"}\n\n'); send(data("Here is the answer.")); send("data: [DONE]\n\n"); return "end"; },
  degradedThenDead: async (send) => { send(": connected\n\n"); send('event: rag-status\ndata: {"status":"degraded","reason":"streaming_fallback"}\n\n'); return "hang"; },
  oldServerSlow: async (send) => { await sleep(25000); send(data("Here is the answer.")); send("data: [DONE]\n\n"); return "end"; }, // no heartbeats, first byte at 25s
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The fake chat server: the step arrives in a header set by the interception.
const secure = new URL(chatUrl).protocol === "https:"; // a redirected request keeps its protocol
const handler = async (req, res) => {
  const step = req.headers["x-e2e-step"] || "answer";
  const cors = { "access-control-allow-origin": "*" };
  if (step !== "oldServerSlow") res.writeHead(200, { ...cors, "content-type": "text/event-stream" });
  else { await sleep(1); }
  let headersSent = step !== "oldServerSlow";
  const send = (chunk) => {
    if (!headersSent) { res.writeHead(200, { ...cors, "content-type": "text/event-stream" }); headersSent = true; }
    res.write(chunk);
  };
  const how = await STEPS[step](send);
  if (how === "end") res.end(); // "hang": leave the connection open with nothing coming
};
// A redirected https request needs an https fake: a throwaway self-signed certificate.
function throwawayCert() {
  const dir = mkdtempSync(join(tmpdir(), "e2e-chat-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem"), "-days", "1", "-subj", "/CN=127.0.0.1"], { stdio: "ignore" });
  return { key: readFileSync(join(dir, "key.pem")), cert: readFileSync(join(dir, "cert.pem")) };
}
const fake = secure ? https.createServer(throwawayCert(), handler) : http.createServer(handler);
await new Promise((r) => fake.listen(4100, "127.0.0.1", r));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true });
let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "  ok" : "  ✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`); if (!ok) failed++; };

async function scenario(title, plan, drive) {
  if (process.env.E2E_ONLY && !title.includes(process.env.E2E_ONLY)) return; // run one scenario
  console.log(`\n## ${title}`);
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const posts = [];
  const origin = new URL(site).origin;
  const cors = { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" };
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (req.url() !== chatUrl) return route.fulfill({ status: 404, headers: cors, body: "" });
    posts.push({ at: Date.now(), body: req.postDataJSON() });
    const step = plan.shift() ?? "answer";
    return route.continue({ url: `${secure ? "https" : "http"}://127.0.0.1:4100/chat`, headers: { ...req.headers(), "x-e2e-step": step } });
  });
  await page.goto(site, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: openName }).click();
  const input = page.getByPlaceholder(placeholder);
  await input.waitFor({ timeout: 15000 });
  const t0 = Date.now();
  try {
    await drive({ page, input, posts, t0 });
  } catch (err) {
    check("scenario ran to the end", false, String(err).slice(0, 200));
  }
  await context.close();
}

const seen = async (page, text, timeout) => page.getByText(text).first().waitFor({ timeout }).then(() => true, () => false);
const ask = async (input, q) => { await input.fill(q); await input.press("Enter"); };

await scenario("a connection that dies after the server answered is dropped and asked again by itself", ["hang", "slowAnswer"], async ({ page, input, posts, t0 }) => {
  await ask(input, "Hi");
  const slowHint = await seen(page, /still working on it/i, 16000);
  check("a long wait says it is still working (about 12s)", slowHint && Date.now() - t0 >= 11000, `at ${Date.now() - t0}ms`);
  const reconnecting = await seen(page, /Reconnecting/, 30000);
  const answered = await seen(page, "Here is the answer.", 15000);
  check("the visitor sees it reconnecting", reconnecting);
  check("...then the answer, without doing anything", answered);
  check("two requests, the second about 20s after the first", posts.length === 2 && posts[1].at - posts[0].at >= 19000 && posts[1].at - posts[0].at < 26000,
    `posts=${posts.length} gap=${posts[1] ? posts[1].at - posts[0].at : "-"}ms`);
  check("...asking the same question", JSON.stringify(posts[1]?.body?.messages) === JSON.stringify(posts[0]?.body?.messages));
  check("the chat is usable again", await page.getByRole("button", { name: "Send message" }).isVisible() && await input.isEnabled());
});

await scenario("Stop ends the wait at once", ["hang"], async ({ page, input, posts }) => {
  await ask(input, "Hi");
  const stop = page.getByRole("button", { name: "Stop" });
  await stop.waitFor({ timeout: 5000 });
  await page.waitForTimeout(1500);
  await stop.click();
  const unlocked = await page.getByRole("button", { name: "Send message" }).waitFor({ timeout: 3000 }).then(() => true, () => false);
  check("the chat unlocks at once", unlocked && await input.isEnabled());
  await page.waitForTimeout(3000);
  check("no error and no retry after Stop", posts.length === 1 && !(await page.getByText(/Error sending|dropped/).count()));
});

await scenario("two dead connections end in a note and Try again, which works", ["hang", "hang", "answer"], async ({ page, input, posts }) => {
  await ask(input, "What does Joe build?");
  const retryButton = page.getByRole("button", { name: "Try again" });
  const offered = await retryButton.waitFor({ timeout: 50000 }).then(() => true, () => false);
  check("after both tries a note and Try again appear (bounded wait)", offered && posts.length === 2);
  check("the chat is not locked meanwhile", await input.isEnabled());
  await retryButton.click();
  check("Try again gets the answer", await seen(page, "Here is the answer.", 15000));
  const sent = posts[2]?.body?.messages || [];
  check("...asking the same question, without the failure note in the history",
    posts.length === 3 && sent.at(-1)?.content === "What does Joe build?" && !sent.some((m) => /Error sending|dropped/.test(m.content)),
    JSON.stringify(sent).slice(0, 200));
  check("the failure note is gone once answered", !(await page.getByText(/Error sending/).count()));
});

await scenario("an answer cut off midway keeps what arrived, says so, offers Try again", ["cut"], async ({ page, input, posts }) => {
  await ask(input, "Hi");
  const note = await seen(page, "The connection dropped before the answer finished.", 10000);
  check("the half answer stays on screen", await seen(page, "Half an ans", 2000));
  check("...with a plain note and Try again, no automatic repeat", note && posts.length === 1 && await page.getByRole("button", { name: "Try again" }).isVisible());
});

await scenario("a normal reply with heartbeats reads normally", ["answer"], async ({ page, input, posts }) => {
  await ask(input, "Hi");
  check("the answer shows", await seen(page, "Here is the answer.", 10000));
  check("one request", posts.length === 1);
});

await scenario("the server's own retry replaces a half answer instead of gluing onto it", ["serverRetry"], async ({ page, input, posts }) => {
  await ask(input, "Hi");
  check("the fresh answer shows", await seen(page, "Here is the answer.", 10000));
  await page.waitForTimeout(1500); // let the typing effect finish
  check("...and the half answer is gone", !(await page.getByText("Half an ans").count()) && posts.length === 1);
});

await scenario("a double-click on Send still asks the question", ["slowAnswer"], async ({ page, input, posts }) => {
  await input.fill("Hi");
  await page.getByRole("button", { name: "Send message" }).dblclick();
  check("the answer arrives (the second click did not land on Stop)", await seen(page, "Here is the answer.", 10000));
  check("one request", posts.length === 1);
});

await scenario("a server-flagged error shows its message and Try again, which works", ["serverError", "answer"], async ({ page, input, posts }) => {
  await ask(input, "Hi");
  check("the server's message shows", await seen(page, "Sorry, something went wrong. Try again.", 10000));
  const retry = page.getByRole("button", { name: "Try again" });
  check("...with Try again, and no automatic repeat", await retry.waitFor({ timeout: 3000 }).then(() => true, () => false) && posts.length === 1);
  await retry.click();
  check("Try again answers", await seen(page, "Here is the answer.", 10000));
  check("...and the error text was not sent back as the agent's words", !(posts[1]?.body?.messages || []).some((m) => /something went wrong/.test(m.content)));
});

await scenario("an older server without heartbeats is not cut off at 20s (first byte at 25s)", ["oldServerSlow"], async ({ page, input, posts }) => {
  await ask(input, "Hi");
  check("the slow answer arrives", await seen(page, "Here is the answer.", 40000));
  check("one request, no reconnect", posts.length === 1 && !(await page.getByText(/Reconnecting/).count()));
});

await scenario("a dropped try's 'degraded' mark does not carry over to the answer asked again", ["degradedThenDead", "answer"], async ({ page, input }) => {
  await ask(input, "Hi");
  check("the answer arrives", await seen(page, "Here is the answer.", 35000));
  check("...without the degraded banner from the dropped try", !(await page.getByText(/Answering without full access/).count()));
});

await browser.close();
fake.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall end-to-end checks passed");
process.exit(failed ? 1 : 0);
