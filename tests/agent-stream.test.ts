// askAgent (src/agent-stream.ts): a chat reply can never freeze the chat.
// Joe hit a reply frozen at about a minute (2026-10-02). These connections are
// fakes that hang, drop, stall mid-answer or answer normally; each must end in
// an answer or an outcome the widget can show, in bounded time, and the quiet
// automatic retry must happen only when nothing of the answer is on screen.
// The same file runs in joestechsolutions-nextjs against its twin copy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { askAgent, forgetHeartbeats, SILENCE_MS, LEGACY_SILENCE_MS, type AgentEvent } from "../src/agent-stream";

type Step = string | { wait: number } | "hang" | "end";
const enc = new TextEncoder();
const ev = (text: string) => `data: ${JSON.stringify({ text })}\n\n`;

// A response body that plays its steps, and errors as soon as the request is aborted.
function body(steps: Step[], signal?: AbortSignal | null): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(c) {
      let stopped = false;
      signal?.addEventListener("abort", () => {
        stopped = true;
        try { c.error(new DOMException("aborted", "AbortError")); } catch { /* closed */ }
      });
      for (const step of steps) {
        if (stopped) return;
        if (step === "hang") return; // nothing more, never closes
        if (step === "end") break;
        if (typeof step === "object") await new Promise((r) => setTimeout(r, step.wait));
        else if (!stopped) c.enqueue(enc.encode(step));
      }
      if (!stopped) c.close();
    },
  });
}

type Reply = Step[] | { status: number; json?: unknown } | "network-error" | "never";
function fakeFetch(replies: Reply[]) {
  const calls: { body: unknown }[] = [];
  const impl = (async (_url: string, init: RequestInit) => {
    calls.push({ body: JSON.parse(String(init.body)) });
    const reply = replies.shift() ?? "never";
    const signal = init.signal;
    if (reply === "network-error") throw new TypeError("Failed to fetch");
    if (reply === "never") {
      return new Promise<Response>((_, reject) => signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    }
    if (!Array.isArray(reply)) return new Response(JSON.stringify(reply.json ?? {}), { status: reply.status });
    return new Response(body(reply, signal), { status: 200, headers: { "content-type": "text/event-stream" } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

async function ask(replies: Reply[], extra: { signal?: AbortSignal; silenceMs?: number; legacySilenceMs?: number; isOnline?: () => boolean; remember?: boolean } = {}) {
  if (!extra.remember) forgetHeartbeats(); // each case starts on a page that has not heard the server yet
  const f = fakeFetch(replies);
  const events: AgentEvent[] = [];
  const t = Date.now();
  const outcome = await askAgent({
    url: "/api/chat", body: { messages: [{ role: "user", content: "hi" }] }, onEvent: (e) => events.push(e),
    fetchImpl: f.impl, silenceMs: extra.silenceMs ?? 120, legacySilenceMs: extra.legacySilenceMs ?? 400,
    signal: extra.signal, isOnline: extra.isOnline ?? (() => true),
  });
  const text = events.reduce((s, e) => (e.type === "text" ? s + e.text : e.type === "replace" ? e.text : s), "");
  return { outcome, events, text, calls: f.calls.length, ms: Date.now() - t };
}

const ANSWER = [": connected\n\n", ev("Hello "), ev("there."), "data: [DONE]\n\n"];

test("a normal reply arrives whole", async () => {
  const r = await ask([ANSWER]);
  assert.deepEqual(r.outcome, { ok: true });
  assert.equal(r.text, "Hello there.");
  assert.equal(r.calls, 1);
});

test("a slow reply kept alive by heartbeats is never dropped", async () => {
  const beats: Step[] = [];
  for (let i = 0; i < 8; i++) beats.push({ wait: 50 }, ": ping\n\n"); // 400ms of thinking, silence limit 120ms
  const r = await ask([[": connected\n\n", ...beats, ev("Worth the wait."), "data: [DONE]\n\n"]]);
  assert.deepEqual(r.outcome, { ok: true });
  assert.equal(r.text, "Worth the wait.");
  assert.equal(r.calls, 1);
});

test("a dead connection is dropped after the silence limit and asked again, quietly", async () => {
  const r = await ask([[": connected\n\n", "hang"], ANSWER]);
  assert.deepEqual(r.outcome, { ok: true });
  assert.equal(r.text, "Hello there.");
  assert.equal(r.calls, 2);
  assert.ok(r.events.some((e) => e.type === "status" && e.phase === "reconnecting"));
});

test("a response that never starts counts as silence too", async () => {
  const r = await ask(["never", ANSWER]);
  assert.deepEqual(r.outcome, { ok: true });
  assert.equal(r.calls, 2);
});

test("a network error is asked again once", async () => {
  const r = await ask(["network-error", ANSWER]);
  assert.deepEqual(r.outcome, { ok: true });
  assert.equal(r.calls, 2);
});

test("a server error (5xx) is asked again once", async () => {
  const r = await ask([{ status: 502 }, ANSWER]);
  assert.deepEqual(r.outcome, { ok: true });
  assert.equal(r.calls, 2);
});

test("only once: two dead connections end in a failure the widget can show, in bounded time", async () => {
  const r = await ask([[": connected\n\n", "hang"], [": connected\n\n", "hang"]]);
  assert.deepEqual(r.outcome, { ok: false, reason: "failed", shown: false });
  assert.equal(r.calls, 2);
  assert.ok(r.ms < 1000, `took ${r.ms}ms`);
});

test("words already on screen are never repeated by a retry: a drop mid-answer is a failure", async () => {
  const r = await ask([[": connected\n\n", ev("Half an ans"), "hang"], ANSWER]);
  assert.deepEqual(r.outcome, { ok: false, reason: "failed", shown: true });
  assert.equal(r.calls, 1);
  assert.equal(r.text, "Half an ans");
});

test("an answer cut off without the server's end mark is a failure, not a whole answer", async () => {
  const r = await ask([[": connected\n\n", ev("Half an ans"), "end"]]);
  assert.deepEqual(r.outcome, { ok: false, reason: "failed", shown: true });
  assert.equal(r.calls, 1);
});

test("an answer the server cleared before its own retry is not 'on screen': the drop is asked again", async () => {
  const r = await ask([[": connected\n\n", ev("Half"), `data: ${JSON.stringify({ text: "", replace: true })}\n\n`, "hang"], ANSWER]);
  assert.deepEqual(r.outcome, { ok: true });
  assert.equal(r.calls, 2);
});

test("a rate limit is reported with the server's message, never retried", async () => {
  const r = await ask([{ status: 429, json: { error: "rate_limited", message: "Slow down a little." } }, ANSWER]);
  assert.deepEqual(r.outcome, { ok: false, reason: "rate_limited", message: "Slow down a little." });
  assert.equal(r.calls, 1);
});

test("a refused request (4xx) is not retried", async () => {
  const r = await ask([{ status: 400 }, ANSWER]);
  assert.deepEqual(r.outcome, { ok: false, reason: "failed", shown: false });
  assert.equal(r.calls, 1);
});

test("Stop ends the wait at once, without a retry", async () => {
  const stop = new AbortController();
  setTimeout(() => stop.abort(), 40);
  const r = await ask([[": connected\n\n", "hang"], ANSWER], { signal: stop.signal, silenceMs: 5000 });
  assert.deepEqual(r.outcome, { ok: false, reason: "stopped" });
  assert.equal(r.calls, 1);
  assert.ok(r.ms < 1000, `took ${r.ms}ms`);
});

test("offline asks nothing", async () => {
  const r = await ask([ANSWER], { isOnline: () => false });
  assert.deepEqual(r.outcome, { ok: false, reason: "offline" });
  assert.equal(r.calls, 0);
});

test("sources, degraded, status and replace events reach the widget; heartbeats and junk do not", async () => {
  const r = await ask([[
    ": connected\n\n",
    'event: status\ndata: {"phase":"searching"}\n\n',
    ": ping\n\n",
    ev("Draft"),
    'event: rag-status\ndata: {"status":"degraded","reason":"streaming_fallback"}\n\n',
    `data: ${JSON.stringify({ text: "Final answer.", replace: true })}\n\n`,
    'event: rag-sources\ndata: [{"page_path_en":"/build"}]\n\n',
    "data: {not json}\n\n",
    "data: [DONE]\n\n",
  ]]);
  assert.deepEqual(r.outcome, { ok: true });
  assert.equal(r.text, "Final answer.");
  assert.deepEqual(r.events.map((e) => e.type), ["status", "text", "degraded", "replace", "sources"]);
});

test("an event split across network chunks is read whole", async () => {
  const r = await ask([[": conn", "ected\n\nda", 'ta: {"text":"Joined', ' up."}\n', "\ndata: [DO", "NE]\n\n"]]);
  assert.deepEqual(r.outcome, { ok: true });
  assert.equal(r.text, "Joined up.");
});

test("a server without heartbeats (an older deploy, a rollback) gets the long silence limit, so its slow replies are not cut", async () => {
  // No ": connected", no pings, 250ms of thinking: past the 120ms limit, inside the 400ms one.
  const r = await ask([[ { wait: 250 }, ev("Slow but fine."), "data: [DONE]\n\n" ]]);
  assert.deepEqual(r.outcome, { ok: true });
  assert.equal(r.calls, 1);
});

test("once the server has shown heartbeats, the short limit applies", async () => {
  const r = await ask([[": connected\n\n", "hang"], ANSWER], { legacySilenceMs: 5000 });
  assert.deepEqual(r.outcome, { ok: true });
  assert.equal(r.calls, 2);
  assert.ok(r.ms < 1000, `took ${r.ms}ms: the long limit was used`);
});

test("[DONE] ends the reply even if the connection stays open after it", async () => {
  const r = await ask([[...ANSWER, "hang"]], { silenceMs: 5000 });
  assert.deepEqual(r.outcome, { ok: true });
  assert.equal(r.text, "Hello there.");
  assert.ok(r.ms < 1000, `took ${r.ms}ms`);
});

test("the server's flagged error message is reported (Try again), never asked again automatically", async () => {
  const flagged = `data: ${JSON.stringify({ text: "Sorry, something went wrong.", replace: true, error: true })}\n\n`;
  const r = await ask([[": connected\n\n", ev("Half"), flagged, "data: [DONE]\n\n"], ANSWER]);
  assert.deepEqual(r.outcome, { ok: false, reason: "server_error", message: "Sorry, something went wrong." });
  assert.equal(r.calls, 1);
  assert.equal(r.text, "Sorry, something went wrong.");
});

test("production limits: four missed 5s heartbeats mean a dead connection; a server without them gets more than its longest healthy silence", () => {
  assert.ok(SILENCE_MS >= 20_000 && SILENCE_MS <= 30_000, `SILENCE_MS ${SILENCE_MS}`);
  assert.ok(LEGACY_SILENCE_MS >= 45_000 && LEGACY_SILENCE_MS <= 90_000, `LEGACY_SILENCE_MS ${LEGACY_SILENCE_MS}`);
});

test("a page that has seen the server's heartbeats uses the short limit from the first byte of its next request", async () => {
  await ask([ANSWER], { legacySilenceMs: 5000 }); // this page now knows the server sends heartbeats
  const r = await ask(["never", ANSWER], { legacySilenceMs: 5000, remember: true }); // the next request never answers at all
  assert.deepEqual(r.outcome, { ok: true });
  assert.equal(r.calls, 2);
  assert.ok(r.ms < 1500, `took ${r.ms}ms: the long limit was used`);
});
