// Every non-streaming model call a visitor can wait on ends in bounded time,
// the response body included. The SDK's own `timeout` stops counting once the
// response headers arrive, and until 2026-10-02 the site-search rerank wrote
// its bound into the request body, where it did nothing (review of PR #47).
// The fake clients here answer only by honouring the caller's abort signal.
import { test } from "node:test";
import assert from "node:assert/strict";
const { createWithin } = await import("../functions/api-src/_shared/models.js");
const { rerankChunks, LLM_RERANK_TIMEOUT_MS } = await import("../functions/api-src/_shared/rag.js");
const { buildBrief } = await import("../functions/api-src/_shared/leads.js");

type Call = { params: Record<string, unknown>; options: { timeout?: number; maxRetries?: number; signal?: AbortSignal } };
// A provider that sent its headers and will never send the body.
function stalledClient() {
  const calls: Call[] = [];
  const client = {
    messages: {
      create: (params: Record<string, unknown>, options: Call["options"]) => {
        calls.push({ params, options });
        return new Promise((_, reject) => options?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
      },
    },
  };
  return { client, calls };
}

test("createWithin ends a call whose body never arrives", async () => {
  const { client } = stalledClient();
  const t = Date.now();
  await assert.rejects(createWithin(client, { model: "m" }, 150));
  const ms = Date.now() - t;
  assert.ok(ms >= 140 && ms < 600, `took ${ms}ms`);
});

test("createWithin ends at once when its caller's signal aborts (the visitor left)", async () => {
  const { client } = stalledClient();
  const leave = new AbortController();
  setTimeout(() => leave.abort(), 50);
  const t = Date.now();
  await assert.rejects(createWithin(client, { model: "m" }, 5000, { signal: leave.signal }));
  assert.ok(Date.now() - t < 500);
});

test("createWithin puts its limits in the request options, never in the body", async () => {
  const { client, calls } = stalledClient();
  await assert.rejects(createWithin(client, { model: "m" }, 50));
  assert.deepEqual(Object.keys(calls[0].params), ["model"]);
  assert.equal(calls[0].options.timeout, 50);
  assert.equal(calls[0].options.maxRetries, 0);
  assert.ok(calls[0].options.signal);
});

test("the site-search rerank falls back to the fused order at its limit, and sends no limits as body fields", async () => {
  const { client, calls } = stalledClient();
  const chunks = Array.from({ length: 6 }, (_, i) => ({ content: `chunk ${i}`, metadata: { article_id: `a${i}` } }));
  const t = Date.now();
  const result = await rerankChunks("query", chunks, client);
  const ms = Date.now() - t;
  assert.ok(ms >= LLM_RERANK_TIMEOUT_MS - 50 && ms < LLM_RERANK_TIMEOUT_MS + 1000, `took ${ms}ms`);
  assert.ok(Array.isArray(result.chunks) && result.chunks.length > 0);
  assert.equal(result.rerankedOrder, null);
  assert.ok(!("timeout" in calls[0].params) && !("maxRetries" in calls[0].params));
});

test("the lead summary gives up at its limit, so Joe's notice still goes", async () => {
  const { client } = stalledClient();
  const t = Date.now();
  const brief = await buildBrief([{ role: "user", content: "We need a website. pat@example.com" }], client, { timeoutMs: 150 });
  assert.equal(brief, null);
  assert.ok(Date.now() - t < 600);
});
