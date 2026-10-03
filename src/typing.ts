// How fast the chat widget types out an answer it has already received.
//
// Until 2026-10-02 it released ONE character per 30ms tick (33 characters a
// second) whatever had arrived, so a 900-character answer the server finished
// in 2-3 seconds took 27 seconds to appear. Now each tick releases a sixth of
// what is waiting (at least one character): a small backlog still types one
// character at a time, and a whole answer that arrived at once is on screen in
// about a second (973 characters in 32 ticks). While the answer streams in,
// the backlog settles around 45-150 characters, so it still reads as typing.
// The first character is unchanged: it shows on the first tick.
export const TYPING_TICK_MS = 30;

/** Characters to release this tick, given how many are waiting. */
export function drainStep(backlog: number): number {
  if (!(backlog > 0)) return 0;
  return Math.min(backlog, Math.max(1, Math.ceil(backlog / 6)));
}
