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

export async function runSearchForModel<S = unknown>(
  body: Record<string, unknown>,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
): Promise<SearchOutcome<S>> {
  const failed: SearchOutcome<S> = { result: SEARCH_FAILED_FOR_MODEL, sources: [] };
  let res: Response;
  try {
    res = await fetchImpl('/api/rag-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
