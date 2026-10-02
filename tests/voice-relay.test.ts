/* eslint-disable @typescript-eslint/no-explicit-any --
 * Fakes for Cloudflare WebSocket pairs and responses: shapes are loose on purpose.
 */
// The voice relay (api/voice-live.js). On a VPN, a phone could reach this site
// but not Google's voice address ("Connection error", 2026-10-02), so a page
// that asks is now pointed at this site, which pipes the session to Google
// unchanged. Cloudflare's WebSocket pairs and status-101 responses do not
// exist in Node, so small fakes stand in for them here.
import { test } from "node:test";
import assert from "node:assert/strict";

for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "LANGFUSE_SECRET_KEY", "OPENAI_API_KEY", "VOICE_PROVIDER", "VOICE_RELAY", "VOICE_RELAY_SECRET"]) delete process.env[k];
process.env.GEMINI_API_KEY = "test-gemini-key";

// --- fakes: a linked pair of sockets, and a Response that allows 101 -----------
type Listener = (e: any) => void;
class FakeSocket {
  peer: FakeSocket | null = null;
  accepted = false;
  closed: { code: number; reason: string } | null = null;
  received: unknown[] = [];
  listeners: Record<string, Listener[]> = {};
  accept() { this.accepted = true; }
  addEventListener(type: string, fn: Listener) { (this.listeners[type] ||= []).push(fn); }
  emit(type: string, e: unknown) { for (const fn of this.listeners[type] || []) fn(e); }
  send(data: unknown) {
    if (this.closed) throw new Error("socket closed");
    this.peer?.received.push(data);
    this.peer?.emit("message", { data });
  }
  close(code = 1000, reason = "") {
    if (code !== 1000 && (code < 1001 || code > 4999 || [1004, 1005, 1006, 1015].includes(code))) throw new Error(`a socket may not send close code ${code}`);
    if (this.closed) throw new Error("already closed");
    this.closed = { code, reason };
    if (this.peer && !this.peer.closed) {
      this.peer.closed = { code, reason };
      this.peer.emit("close", { code, reason });
    }
  }
}
function pair(): [FakeSocket, FakeSocket] {
  const a = new FakeSocket(), b = new FakeSocket();
  a.peer = b; b.peer = a;
  return [a, b];
}
(globalThis as any).WebSocketPair = function () { const [a, b] = pair(); return { 0: a, 1: b }; };
class FakeResponse {
  status: number; webSocket: unknown; body: unknown; headers: Headers;
  constructor(body: unknown, init: { status?: number; webSocket?: unknown; headers?: HeadersInit } = {}) {
    this.body = body; this.status = init.status ?? 200; this.webSocket = init.webSocket; this.headers = new Headers(init.headers);
  }
}
const RealResponse = globalThis.Response;
async function withFakeResponse<T>(fn: () => Promise<T>): Promise<T> {
  (globalThis as any).Response = FakeResponse;
  try { return await fn(); } finally { (globalThis as any).Response = RealResponse; }
}

// Google's upstream connection, as the relay's fetch would get it.
let handedBack: FakeSocket | null = null; // the end of Google's connection the relay's fetch receives
let upstreamCalls: { url: string; upgrade: string | null }[] = [];
let upstreamMode: "ok" | "refused" | "down" = "ok";
const realFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: any, init: any = {}) => {
  const u = String(url);
  if (u.startsWith("https://generativelanguage.googleapis.com/ws/")) {
    upstreamCalls.push({ url: u, upgrade: new Headers(init.headers).get("upgrade") });
    if (upstreamMode === "down") throw new Error("connect ECONNREFUSED");
    if (upstreamMode === "refused") return { status: 502, webSocket: null };
    const [relaySide, googleSide] = pair();
    handedBack = relaySide;
    googleSide.accept();
    return { status: 101, webSocket: relaySide };
  }
  if (u === "https://generativelanguage.googleapis.com/v1beta/auth_tokens") {
    return new RealResponse(JSON.stringify({ name: "auth_tokens/abc123" }), { headers: { "content-type": "application/json" } });
  }
  return realFetch(url, init);
};

const { signVoiceTicket, verifyVoiceTicket } = await import("../functions/api-src/_shared/voice-ticket.js");
const relay = (await import("../functions/api-src/voice-live.js")).default;
const voiceToken = (await import("../functions/api-src/voice-token.js")).default;

async function connect(ticket: string | null, headers: Record<string, string> = { Upgrade: "websocket" }) {
  handedBack = null; upstreamCalls = [];
  const url = `https://cloudyjoe.com/api/voice-live${ticket === null ? "" : `?access_token=${encodeURIComponent(ticket)}`}`;
  const res: any = await withFakeResponse(() => relay(new RealRequest(url, { headers })));
  const browser: FakeSocket | null = res.webSocket || null;
  return { res, browser };
}
const RealRequest = globalThis.Request;

// --- the ticket -------------------------------------------------------------------
test("a ticket this server signed opens; a forged, altered or bare one does not", async () => {
  const ticket = await signVoiceTicket("auth_tokens/abc123");
  assert.equal(await verifyVoiceTicket(ticket), "auth_tokens/abc123");
  assert.equal(await verifyVoiceTicket(ticket.replace("abc123", "abc124")), null);
  assert.equal(await verifyVoiceTicket(ticket.slice(0, -1) + (ticket.endsWith("0") ? "1" : "0")), null);
  assert.equal(await verifyVoiceTicket("auth_tokens/abc123"), null);
  assert.equal(await verifyVoiceTicket("auth_tokens/abc123~" + "0".repeat(32)), null);
  // the ticket key is derived for this purpose: an HMAC under the raw secret is not a ticket
  const raw = await crypto.subtle.importKey("raw", new TextEncoder().encode("test-gemini-key"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const rawMac = new Uint8Array(await crypto.subtle.sign("HMAC", raw, new TextEncoder().encode("auth_tokens/abc123")));
  const rawHex = Array.from(rawMac.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
  assert.equal(await verifyVoiceTicket(`auth_tokens/abc123~${rawHex}`), null);
  const key = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    assert.equal(await verifyVoiceTicket(ticket), null, "no secret, no relay");
  } finally {
    process.env.GEMINI_API_KEY = key;
  }
});

// --- /api/voice-token points a page that asks at the relay ---------------------------
async function token(body: Record<string, unknown>) {
  const res = await voiceToken(new RealRequest("https://cloudyjoe.com/api/voice-token", {
    method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9" }, body: JSON.stringify(body),
  }));
  return { status: res.status, data: await res.json() };
}
test("a page that asks for the relay gets this site's address and a signed ticket for Google's token", async () => {
  const { status, data } = await token({ lang: "en", sessionId: "s1", relay: true });
  assert.equal(status, 200);
  assert.equal(data.wsUrl, "wss://cloudyjoe.com/api/voice-live");
  assert.equal(await verifyVoiceTicket(data.token), "auth_tokens/abc123");
  assert.ok(data.model);
  // ...and Google's own address with the bare token, for the widget's one fallback if the relay fails
  assert.match(data.direct.wsUrl, /^wss:\/\/generativelanguage\.googleapis\.com\/ws\/.*BidiGenerateContentConstrained$/);
  assert.equal(data.direct.token, "auth_tokens/abc123");
});
test("an older page that does not ask still gets Google's address and the bare token", async () => {
  const { data } = await token({ lang: "en", sessionId: "s2" });
  assert.match(data.wsUrl, /^wss:\/\/generativelanguage\.googleapis\.com\//);
  assert.equal(data.token, "auth_tokens/abc123");
  assert.equal(data.direct, undefined);
});
test("VOICE_RELAY=off turns the relay off for everyone", async () => {
  process.env.VOICE_RELAY = "off";
  const { data } = await token({ lang: "en", sessionId: "s3", relay: true });
  delete process.env.VOICE_RELAY;
  assert.match(data.wsUrl, /^wss:\/\/generativelanguage\.googleapis\.com\//);
  assert.equal(data.token, "auth_tokens/abc123");
});

// --- the relay ------------------------------------------------------------------------
test("anything but a WebSocket upgrade is refused (426)", async () => {
  const { res } = await connect(await signVoiceTicket("auth_tokens/abc123"), {});
  assert.equal(res.status, 426);
});

test("an unsigned ticket is closed with a reason the widget can show, and Google is never called", async () => {
  const { res, browser } = await connect("auth_tokens/someone-elses");
  assert.equal(res.status, 101);
  assert.deepEqual(browser?.closed, { code: 1008, reason: "invalid voice ticket" });
  assert.equal(upstreamCalls.length, 0);
});

test("a signed ticket opens Google's constrained Live endpoint, and Google's socket is handed back unaccepted, so the runtime pipes the frames", async () => {
  const { res, browser } = await connect(await signVoiceTicket("auth_tokens/abc123"));
  assert.equal(res.status, 101);
  assert.equal(upstreamCalls.length, 1);
  // Spelled out, not GOOGLE_LIVE: the relay must only ever reach the constrained endpoint.
  assert.equal(upstreamCalls[0].url, `https://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent("auth_tokens/abc123")}`);
  assert.equal(upstreamCalls[0].upgrade, "websocket");
  assert.equal(browser, handedBack, "the browser gets Google's own socket");
  assert.equal(handedBack!.accepted, false, "accepting it would make every frame this code's work");
  assert.deepEqual(Object.keys(handedBack!.listeners), [], "no code runs per frame");
});

test("close codes a socket may not send are mapped; long reasons are cut to 123 bytes", async () => {
  const { closeWith } = await import("../functions/api-src/voice-live.js");
  const target = new FakeSocket();
  closeWith(target, 1006, "abnormal");
  assert.deepEqual(target.closed, { code: 1011, reason: "abnormal" });
  const t2 = new FakeSocket();
  closeWith(t2, 1005, "");
  assert.deepEqual(t2.closed, { code: 1000, reason: "" });
  const t3 = new FakeSocket();
  closeWith(t3, 1007, "é".repeat(100));
  assert.ok(new TextEncoder().encode(t3.closed!.reason).length <= 123);
  closeWith(t3, 1000, "twice"); // closing a closed socket is harmless
});

test("Google refusing or unreachable: the visitor gets a close with the reason, not a bare 1006", async () => {
  upstreamMode = "refused";
  let c = await connect(await signVoiceTicket("auth_tokens/abc123"));
  assert.equal(c.browser!.closed?.code, 1011);
  assert.match(c.browser!.closed!.reason, /refused the connection \(HTTP 502\)/);
  upstreamMode = "down";
  c = await connect(await signVoiceTicket("auth_tokens/abc123"));
  assert.deepEqual(c.browser!.closed, { code: 1011, reason: "the voice service is unreachable" });
  upstreamMode = "ok";
});

// --- the router lets the handshake through untouched ---------------------------------
test("the router passes the relay's handshake through as-is (re-wrapping would drop its socket), and refuses foreign origins", async () => {
  const { onRequest } = await import("../functions/api/[[path]].js");
  const ticket = await signVoiceTicket("auth_tokens/abc123");
  const call = (origin: string) => withFakeResponse(() => onRequest({
    request: new RealRequest(`https://cloudyjoe.com/api/voice-live?access_token=${encodeURIComponent(ticket)}`, {
      headers: { Upgrade: "websocket", Origin: origin, "cf-connecting-ip": "203.0.113.9" },
    }),
    env: {}, params: { path: ["voice-live"] }, waitUntil: () => {},
  }));
  const res: any = await call("https://www.joestechsolutions.com");
  assert.equal(res.status, 101);
  assert.ok(res.webSocket, "the socket survived the router");
  const foreign: any = await call("https://evil.example");
  assert.equal(foreign.status, 403);
});
