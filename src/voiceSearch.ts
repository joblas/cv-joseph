// What a voice model is told after it calls search_portfolio.
//
// Shared by BOTH voice clients — useGeminiVoice (Gemini Live) and useVoiceMode
// (OpenAI Realtime) — so there is one tested path to the model instead of two
// copies drifting apart. Each used to hand the model
// `context || 'No relevant content found.'`, so a failed request (a 401 or 500,
// whose body has no context) reached the model as a confident "the site has
// nothing on this", and the agent repeated it to the caller. On 2026-09-25
// every production voice search was 401ing, and the voice agent told callers
// the site had no details about things it covers at length.
//
// The rule: the ONLY text that may tell the model a search came back empty is
// the backend's own, in a successful response. A thrown fetch, a non-2xx
// status (the backend now answers a failed retrieval with 503), a body that is
// not JSON, or a 200 whose context is missing or blank is a FAILURE. Status
// wins over body. The same rule, and the same wording, live in the
// joestechsolutions.com widget (src/components/chat/agent-api.ts there).
//
// The failure text closes both directions — don't claim the site lacks it,
// and don't claim the site covers it — and never says "answer from your
// general knowledge", which the voice prompts forbid.
export const SEARCH_FAILED_FOR_MODEL =
  "Search failed — a technical error, not an empty result. Tell the caller you couldn't look that up just now, and say nothing about whether the site covers it. Share only what is already in your instructions, and offer the contact email from your instructions for anything more.";

export interface SearchOutcome<S = unknown> {
  /** The tool result handed to the voice model. */
  result: string;
  /** Source badges; empty unless the search succeeded. */
  sources: S[];
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** What a voice client knows about the search it is running. */
export interface SearchFields {
  query: string;
  traceId: string | null;
  currentPage?: string;
}

// A hung request would otherwise leave the model waiting until the session
// cap. The backend bounds itself well inside this (retrieval 2.5s, reasoning
// 3s), so only a truly stuck request reaches it, and it then takes the
// ordinary thrown-fetch failure path.
export const SEARCH_TIMEOUT_MS = 10_000;

// AbortSignal.timeout needs Safari 16 / Chrome 103 / Firefox 100, and this
// site's build (es2022, no polyfills) does not provide it. On Safari 15 the call
// throws inside the try, so every voice search would take the failure path —
// honest, but blind. Fall back to a controller and a timer where it is missing.
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException('The operation timed out.', 'TimeoutError')), ms);
  return controller.signal;
}

export async function runSearchForModel<S = unknown>(
  fields: SearchFields,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
  timeoutMs: number = SEARCH_TIMEOUT_MS,
): Promise<SearchOutcome<S>> {
  const failed: SearchOutcome<S> = { result: SEARCH_FAILED_FOR_MODEL, sources: [] };
  let res: Response;
  try {
    res = await fetchImpl('/api/rag-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
      signal: timeoutSignal(timeoutMs),
    });
  } catch {
    return failed;
  }
  if (!res.ok) return failed;
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return failed;
  }
  const d = data as { context?: unknown; sources?: unknown } | null;
  if (typeof d?.context !== 'string' || !d.context.trim()) return failed;
  return { result: d.context, sources: Array.isArray(d.sources) ? (d.sources as S[]) : [] };
}

export interface ToolCall {
  id: string;
  name: string;
  args?: { query?: string };
}
export interface ToolResponse {
  id: string;
  name: string;
  response: { result: string };
}

/**
 * Answer one batch of Gemini Live tool calls. Pure apart from `search`, so the
 * hook's wiring is testable: the search RESULT is what the model gets, the
 * query comes from the call's args, a call cancelled before or during its
 * search gets no response and moves no badges, and a failed search clears the
 * badges. Same shape as the joestechsolutions.com widget's answerToolCalls.
 *
 * `sources` is null when no search completed (leave the badges alone), or the
 * last completed search's sources — possibly [] to clear them.
 */
export async function answerToolCalls<S = unknown>(
  calls: ToolCall[],
  opts: {
    isCancelled: (id: string) => boolean;
    traceId: string | null;
    currentPage?: string;
    search?: (fields: SearchFields) => Promise<SearchOutcome<S>>;
  },
): Promise<{ responses: ToolResponse[]; sources: S[] | null }> {
  const search = opts.search ?? ((fields: SearchFields) => runSearchForModel<S>(fields));
  const responses: ToolResponse[] = [];
  let sources: S[] | null = null;
  for (const call of calls) {
    if (opts.isCancelled(call.id)) continue;
    let outcome: SearchOutcome<S> = { result: SEARCH_FAILED_FOR_MODEL, sources: [] };
    if (call.name === 'search_portfolio') {
      outcome = await search({ query: call.args?.query || '', traceId: opts.traceId, currentPage: opts.currentPage });
    }
    // The cancellation typically arrives while the search is in flight.
    if (opts.isCancelled(call.id)) continue;
    if (call.name === 'search_portfolio') sources = outcome.sources;
    responses.push({ id: call.id, name: call.name, response: { result: outcome.result } });
  }
  return { responses, sources };
}
