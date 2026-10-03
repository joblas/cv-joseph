// Every non-streaming model call a visitor can wait on ends in bounded time,
// the response body included. The SDK's own `timeout` stops counting once the
// response headers arrive, and until 2026-10-02 the site-search rerank wrote
// its bound into the request body, where it did nothing (review of PR #47).
// The fake clients here answer only by honouring the caller's abort signal.
import { test } from "node:test";
import assert from "node:assert/strict";
const { createWithin } = await import("../functions/api-src/_shared/models.js");
const { searchPortfolio } = await import("../functions/api-src/_shared/rag.js");
const { getPersona } = await import("../functions/api-src/_shared/personas.js");
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

// The search itself makes no model call at all (2026-10-02). The cloudyjoe
// corpus used to rerank with an LLM call on the thinking chat model (up to
// 2.5s on every search); both corpora now rank with Voyage, or keep the fused
// order when Voyage is down or unconfigured.
test("a portfolio search makes no model call: documents (Voyage up, down, no key) and site", async () => {
  const realFetch = globalThis.fetch;
  const saved = { ...process.env };
  Object.assign(process.env, {
    SUPABASE_URL: "https://stub-cj.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "stub",
    JTS_SUPABASE_URL: "https://stub-jts.supabase.co", JTS_SUPABASE_ANON_KEY: "stub",
  });
  const docRows = Array.from({ length: 10 }, (_, i) => ({ id: i, content: `doc ${i}`, similarity: 0.9 - i * 0.01, metadata: { article_id: `a${i % 3}`, section_id: `s${i}` } }));
  const siteRows = Array.from({ length: 10 }, (_, i) => ({ id: i, source: "page", url: `https://www.joestechsolutions.com/p${i % 3}`, title: `T${i}`, content: `site ${i}`, score: 0.9 - i * 0.01 }));
  let voyageDown = false;
  (globalThis as { fetch: unknown }).fetch = async (url: string) => {
    const u = String(url);
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (u.includes("voyageai.com/v1/embeddings")) return voyageDown ? json({}, 500) : json({ data: [{ embedding: [0.1] }], usage: { total_tokens: 1 } });
    if (u.includes("voyageai.com/v1/rerank")) return voyageDown ? json({}, 500) : json({ data: [0, 1, 2, 3, 4, 5].map((index) => ({ index, relevance_score: 0.5 })) });
    if (u.startsWith("https://stub-cj.supabase.co/rest/v1/rpc/")) return json(docRows);
    if (u.startsWith("https://stub-jts.supabase.co/rest/v1/rpc/")) return json(siteRows);
    throw new Error(`unexpected fetch ${u}`);
  };
  try {
    for (const [label, key, down, persona] of [
      ["documents, Voyage up", "k", false, "cloudyjoe"], ["documents, Voyage down", "k", true, "cloudyjoe"],
      ["documents, no Voyage key", "", false, "cloudyjoe"], ["site", "k", false, "jts"],
    ] as const) {
      if (key) process.env.VOYAGE_API_KEY = key; else delete process.env.VOYAGE_API_KEY;
      voyageDown = down;
      const { client, calls } = stalledClient();
      const result = await searchPortfolio("tell me about hermes", null, client, getPersona(persona));
      assert.equal(calls.length, 0, label);
      assert.ok(Array.isArray(result.chunks) && result.chunks.length > 0, label);
    }
  } finally {
    (globalThis as { fetch: unknown }).fetch = realFetch;
    process.env = saved;
  }
});

test("the lead summary gives up at its limit, so Joe's notice still goes", async () => {
  const { client } = stalledClient();
  const t = Date.now();
  const brief = await buildBrief([{ role: "user", content: "We need a website. pat@example.com" }], client, { timeoutMs: 150 });
  assert.equal(brief, null);
  assert.ok(Date.now() - t < 600);
});

// --- Thinking effort (CHAT_EFFORT) -------------------------------------------------
// glm-5.3-flash defaults to effort "max" on every call; "high" roughly halves the
// search decision and the first words after a search (provider bench, 2026-10-02).
// One choke point (the client's fetch) sets it on every request: create and
// stream alike. Never `thinking`: disabled thinking leaks reasoning into the text.
const { createAnthropicClient, chatEffort, resetEffortRefusal } = await import("../functions/api-src/_shared/models.js");

type Body = { stream?: boolean; output_config?: { effort?: string }; [k: string]: unknown };
type Sent = { url: string; body: Body };
function stubModel(refuseEffort = false) {
  const sent: Sent[] = [];
  const ev = (type: string, data: Record<string, unknown>) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  (globalThis as { fetch: unknown }).fetch = async (url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as Body;
    sent.push({ url: String(url), body });
    if (refuseEffort && body.output_config) {
      return new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: 'think value "high" is not supported for this model' } }), { status: 400, headers: { "content-type": "application/json" } });
    }
    if (body.stream) {
      return new Response(ev("message_start", { message: { id: "m", type: "message", role: "assistant", model: "stub", content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 0 } } })
        + ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } }) + ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: "hi" } })
        + ev("content_block_stop", { index: 0 }) + ev("message_delta", { delta: { stop_reason: "end_turn" }, usage: { output_tokens: 1 } }) + ev("message_stop", {}),
      { headers: { "content-type": "text/event-stream" } });
    }
    return new Response(JSON.stringify({ id: "m", type: "message", role: "assistant", model: "stub", stop_reason: "end_turn", content: [{ type: "text", text: "hi" }], usage: { input_tokens: 1, output_tokens: 1 } }), { headers: { "content-type": "application/json" } });
  };
  return sent;
}
async function bothKinds(baseUrl = "http://127.0.0.1:9") {
  process.env.ANTHROPIC_BASE_URL = baseUrl;
  process.env.ANTHROPIC_API_KEY = "stub";
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  const client = createAnthropicClient();
  const params = { model: "m", max_tokens: 16, messages: [{ role: "user" as const, content: "hi" }] };
  await client.messages.create(params);
  await client.messages.stream(params).finalMessage();
  await createWithin(client, params, 5000);
}

test("every model request (create, stream, bounded create) carries effort high, and never `thinking`", async () => {
  delete process.env.CHAT_EFFORT;
  resetEffortRefusal();
  const sent = stubModel();
  await bothKinds();
  assert.equal(chatEffort(), "high");
  assert.equal(sent.length, 3);
  for (const s of sent) {
    assert.equal(s.body.output_config?.effort, "high", JSON.stringify(s.body));
    assert.ok(!("thinking" in s.body));
  }
  assert.ok(sent[1].body.stream === true);
});

test("CHAT_EFFORT=max restores the provider's old level; CHAT_EFFORT=default sends no field", async () => {
  resetEffortRefusal();
  process.env.CHAT_EFFORT = "max";
  let sent = stubModel();
  await bothKinds();
  assert.ok(sent.every((s) => s.body.output_config?.effort === "max"));
  for (const off of ["default", "off", ""]) {
    process.env.CHAT_EFFORT = off;
    sent = stubModel();
    await bothKinds();
    assert.ok(sent.every((s) => !("output_config" in s.body) && !("thinking" in s.body)), `CHAT_EFFORT=${JSON.stringify(off)}`);
  }
  delete process.env.CHAT_EFFORT;
});

test("Anthropic's own endpoint gets no effort field (its models keep their defaults)", async () => {
  delete process.env.CHAT_EFFORT;
  resetEffortRefusal();
  const sent = stubModel();
  await bothKinds("https://api.anthropic.com");
  assert.equal(sent.length, 3);
  assert.ok(sent.every((s) => !("output_config" in s.body)));
});

test("a provider that refuses the effort (a model switched by env) is asked again without it, and never sent it again", async () => {
  delete process.env.CHAT_EFFORT;
  resetEffortRefusal();
  const logged: string[] = [];
  const realError = console.error;
  console.error = (...a: unknown[]) => { logged.push(a.map(String).join(" ")); };
  try {
    const sent = stubModel(true);
    await bothKinds();
    // create: refused, then retried without it; after that nothing carries it.
    assert.equal(sent.length, 4);
    assert.equal(sent[0].body.output_config?.effort, "high");
    assert.ok(sent.slice(1).every((s) => !("output_config" in s.body)));
    assert.ok(logged.some((l) => /refused output_config\.effort=high \(HTTP 400/.test(l)));
  } finally {
    console.error = realError;
    resetEffortRefusal();
  }
});
