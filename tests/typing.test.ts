// The widget's typing speed (src/typing.ts). It released one character per
// 30ms tick, so a 973-character answer the server had finished took 29s to
// appear. Now a tick releases a sixth of the backlog, at least one character.
import { test } from "node:test";
import assert from "node:assert/strict";
import { drainStep, TYPING_TICK_MS } from "../src/typing";

const ticksToDrain = (chars: number) => {
  let left = chars;
  let ticks = 0;
  while (left > 0) {
    const step = drainStep(left);
    assert.ok(step >= 1 && step <= left, `step ${step} for a backlog of ${left}`);
    left -= step;
    ticks++;
  }
  return ticks;
};

test("a small backlog still types one character at a time", () => {
  for (const b of [1, 2, 3, 4, 5, 6]) assert.equal(drainStep(b), 1);
});

test("nothing waiting releases nothing, and a step never overshoots the backlog", () => {
  assert.equal(drainStep(0), 0);
  assert.equal(drainStep(-3), 0);
  for (let b = 1; b <= 2000; b++) assert.ok(drainStep(b) <= b);
});

test("a whole long answer is on screen in about a second, not half a minute", () => {
  const ticks = ticksToDrain(973); // the longest baseline answer (2026-10-02)
  assert.ok(ticks <= 32, `${ticks} ticks`);
  assert.ok(ticks * TYPING_TICK_MS <= 1000, `${ticks * TYPING_TICK_MS}ms`);
  assert.ok(ticksToDrain(213) <= 25);
});

test("while an answer streams in, the backlog stays small enough to read as typing", () => {
  for (const perTick of [10, 30]) {
    let backlog = 0;
    for (let i = 0; i < 200; i++) {
      backlog += perTick;
      backlog -= drainStep(backlog);
    }
    assert.ok(backlog > perTick && backlog < 200, `backlog ${backlog} at ${perTick} chars/tick`);
  }
});
