// How a chat widget asks the agent (/api/chat) so that a reply can never
// freeze the chat. Written 2026-10-02, after Joe hit a reply frozen at about a
// minute: the widgets had no time limit, no way out and no retry, so one stuck
// request or a dropped phone connection locked the chat until a reload.
//
// Twin copies, kept identical: cv-joseph src/agent-stream.ts and
// joestechsolutions-nextjs src/components/chat/agent-stream.ts.
//
// - Silence: the server sends a heartbeat every few seconds for as long as an
//   answer takes, so silenceMs with no bytes at all means the connection is
//   dead (a phone switching networks leaves it open with nothing coming). The
//   request is dropped then, the wait for the response included.
// - Retry: a dropped or failed request is asked again, once and quietly, when
//   none of the answer is on screen. Never once words are showing (they would
//   repeat), never on a rate limit or a refused request, never after Stop.
// - Done: an answer counts only when the server says it is finished; an
//   answer cut off midway is a failure the widget can offer to retry.
// - Stop: the caller's signal ends the request at once.

export type AgentEvent =
  | { type: "text"; text: string } // more of the answer
  | { type: "replace"; text: string } // the whole answer so far ("" clears it before a server-side retry)
  | { type: "sources"; sources: unknown[] }
  | { type: "degraded" }
  | { type: "status"; phase: string } // "searching" | "retrying" (server), "reconnecting" (here)

export type AskOutcome =
  | { ok: true }
  | { ok: false; reason: "stopped" }
  | { ok: false; reason: "offline" }
  | { ok: false; reason: "rate_limited"; message: string | null }
  | { ok: false; reason: "failed"; shown: boolean } // shown: part of an answer is on screen

export interface AskOptions {
  url: string;
  body: unknown;
  onEvent: (event: AgentEvent) => void;
  signal?: AbortSignal;
  silenceMs?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
  isOnline?: () => boolean;
}

// Four missed heartbeats (the server sends one every 5s).
export const SILENCE_MS = 20_000;

type Attempt =
  | { kind: "done" }
  | { kind: "stopped" }
  | { kind: "rate_limited"; message: string | null }
  | { kind: "refused" } // a 4xx: the same request would be refused again
  | { kind: "dropped"; shown: boolean }; // silence, a network error, a 5xx, or an end without a finished answer

export async function askAgent(options: AskOptions): Promise<AskOutcome> {
  const retries = options.retries ?? 1;
  const online = options.isOnline ?? (() => typeof navigator === "undefined" || navigator.onLine !== false);
  for (let attempt = 0; ; attempt++) {
    if (options.signal?.aborted) return { ok: false, reason: "stopped" };
    if (!online()) return { ok: false, reason: "offline" };
    if (attempt > 0) options.onEvent({ type: "status", phase: "reconnecting" });
    const result = await askOnce(options);
    if (result.kind === "done") return { ok: true };
    if (result.kind === "stopped") return { ok: false, reason: "stopped" };
    if (result.kind === "rate_limited") return { ok: false, reason: "rate_limited", message: result.message };
    const shown = result.kind === "dropped" && result.shown;
    if (result.kind === "refused" || shown || attempt >= retries) return { ok: false, reason: "failed", shown };
  }
}

async function askOnce(options: AskOptions): Promise<Attempt> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const silenceMs = options.silenceMs ?? SILENCE_MS;
  const request = new AbortController();
  let silent = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      silent = true;
      request.abort();
    }, silenceMs);
  };
  const stop = () => request.abort();
  options.signal?.addEventListener("abort", stop);
  let visible = false; // part of the answer is on screen right now
  arm(); // the wait for the response counts as silence too
  try {
    const res = await fetchImpl(options.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options.body),
      signal: request.signal,
    });
    if (res.status === 429) {
      let message: string | null = null;
      try {
        const data = await res.json();
        message = typeof data?.message === "string" ? data.message : null;
      } catch {
        // no message, the caller has its own
      }
      return { kind: "rate_limited", message };
    }
    if (res.status >= 400 && res.status < 500) return { kind: "refused" };
    if (!res.ok || !res.body) return { kind: "dropped", shown: false };

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let eventType = "";
    let finished = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      arm();
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line.startsWith("event: ")) {
          eventType = line.slice(7);
          continue;
        }
        if (!line.startsWith("data: ")) continue; // blank lines and heartbeats
        const kind = eventType;
        eventType = "";
        if (line === "data: [DONE]") {
          finished = true;
          continue;
        }
        let data: { text?: unknown; replace?: unknown; status?: unknown; phase?: unknown } | unknown[];
        try {
          data = JSON.parse(line.slice(6));
        } catch {
          continue;
        }
        if (kind === "rag-sources") {
          if (Array.isArray(data)) options.onEvent({ type: "sources", sources: data });
          continue;
        }
        if (Array.isArray(data) || data === null || typeof data !== "object") continue;
        if (kind === "rag-status") {
          if (data.status === "degraded") options.onEvent({ type: "degraded" });
          continue;
        }
        if (kind === "status") {
          if (typeof data.phase === "string") options.onEvent({ type: "status", phase: data.phase });
          continue;
        }
        if (typeof data.text !== "string") continue;
        if (data.replace) {
          options.onEvent({ type: "replace", text: data.text });
          visible = data.text !== "";
        } else if (data.text) {
          options.onEvent({ type: "text", text: data.text });
          visible = true;
        }
      }
    }
    // The server ends every reply with an answer (or its error message) and
    // [DONE]; anything less is a connection that dropped.
    return finished && visible ? { kind: "done" } : { kind: "dropped", shown: visible };
  } catch {
    if (options.signal?.aborted && !silent) return { kind: "stopped" };
    return { kind: "dropped", shown: visible };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", stop);
  }
}
