import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Career claims have to say the same thing everywhere they appear.
//
// Why this exists: "30+ executive and investor demonstrations" survived in
// src/i18n.ts and chatbot-prompt.txt after public/llms.txt had already been
// corrected to "10+". Two files disagreed about the same fact and nothing
// noticed, because no test asserted a number. A recruiter clicking through from
// a resume can hit the page and the chatbot in the same visit and get two
// different numbers, so the drift is a credibility problem, not a cosmetic one.
//
// The rule: every claim below appears in more than one file, so the test walks
// the whole source tree and fails on any file that states a DIFFERENT value.
// Adding a new file that repeats the claim is covered automatically.

// Resolved from cwd, not import.meta.url: the runner executes from the repo
// root, and the URL-based path produced a leading-slash mismatch that silently
// matched no files (the "four role titles" test failed with find() returning
// undefined rather than naming a real missing title). Same approach the other
// tests in this directory use.
const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|txt|js|json|html)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function sources(): string[] {
  return walk(ROOT).filter((f) => !f.includes("/tests/") && !f.includes("/evals/") && !f.includes("/node_modules/"));
}

function readAll(): { file: string; text: string }[] {
  return sources().map((f) => ({ file: f.replace(ROOT, ""), text: readFileSync(f, "utf8") }));
}

test("the Pronto.ai demo count is 10+, never 30+", () => {
  // Correct per Joe's resumes: 10+ executive and investor demonstrations.
  // "30+" was the old, inflated figure.
  const wrong: string[] = [];
  for (const { file, text } of readAll()) {
    if (/\b30\+\s*executive/i.test(text)) wrong.push(file);
    if (/\b30\+\s*executive\/investor/i.test(text)) wrong.push(file);
  }
  assert.deepEqual(
    wrong,
    [],
    "these files still claim 30+ demonstrations (the correct figure is 10+):\n" + wrong.join("\n"),
  );
});

test("10+ is stated in every file that carries the claim, so it did not simply vanish", () => {
  // A guard that only forbids the wrong number would pass if the whole claim
  // were deleted. The honest version has to be present.
  //
  // Pinned per file rather than as a "at least two files" floor: with a floor,
  // deleting the claim from any one of the three still passed because the other
  // two carried it, so the one place a reader actually looks could lose it
  // silently. Each file below must state it.
  const mustState = ["src/i18n.ts", "chatbot-prompt.txt", "public/llms.txt"];
  const missing = mustState.filter(
    (rel) => !/\b10\+\s*executive/i.test(readFileSync(join(ROOT, rel), "utf8")),
  );
  assert.deepEqual(
    missing,
    [],
    "these files no longer state the corrected 10+ figure (the claim was dropped rather than fixed):\n" +
      missing.join("\n"),
  );
});

test("no AV copy claims 15+ years", () => {
  // About 10 years of direct AV work (2009 to 2019). "15+" was the stale figure
  // in the abandoned cv-joseph fork; it must not come back anywhere.
  const wrong: string[] = [];
  for (const { file, text } of readAll()) {
    if (/\b15\+\s*years?\b/i.test(text)) wrong.push(file);
  }
  assert.deepEqual(wrong, [], "these files claim 15+ years (correct is about 10):\n" + wrong.join("\n"));
});

test("the four role titles match the resumes", () => {
  // Where Joe's own sources disagreed, the resume version wins: a verifier
  // never objects to a modest title.
  const expected = [
    "Program Manager (L4) / Fleet Technician",
    "Hardware Integration & Test Operations",
    "Autonomous Systems Operations",
    "Founder & AI Systems Developer",
  ];
  const { text: i18n } = readAll().find((f) => f.file.endsWith("/src/i18n.ts"))!;
  for (const title of expected) {
    assert.ok(i18n.includes(title), `src/i18n.ts is missing the resume title: ${title}`);
  }
});

test("the superseded titles are gone", () => {
  const wrong: string[] = [];
  for (const { file, text } of readAll()) {
    for (const stale of [
      "Founder and Builder",
      "Founder & AI Developer",
      "Program Manager L4 / Operations & Sensor Readiness Lead",
      "Autonomous Truck Technician",
      "Autonomous Vehicle Technician / Operations",
    ]) {
      if (text.includes(stale)) wrong.push(`${file}: ${stale}`);
    }
  }
  assert.deepEqual(wrong, [], "superseded titles still present:\n" + wrong.join("\n"));
});

test("Joe's Tech Solutions dates are 2025 to present, not 2023", () => {
  const wrong: string[] = [];
  for (const { file, text } of readAll()) {
    // 2023 is only legal as the OvationCXM period, which is a separate question
    // and deliberately left alone pending Joe's answer.
    const re = /Joe'?s Tech Solutions[^.\n]{0,80}?(2023)/gi;
    if (re.test(text)) wrong.push(file);
  }
  assert.deepEqual(
    wrong,
    [],
    "these files date Joe's Tech Solutions to 2023 (it is 2025-present):\n" + wrong.join("\n"),
  );
});

test("the 10+ figure is not written with an em dash around it", () => {
  // Joe asked for no em dashes in NEW copy. This does NOT scan the files for em
  // dashes: chatbot-prompt.txt and public/llms.txt are dense with them already
  // (42 in the prompt alone), all pre-existing, and none introduced by the 30+ ->
  // 10+ change. Failing on those would mean rewriting unrelated prose that
  // nobody asked to touch.
  //
  // What it does check: the sentence carrying the corrected figure does not use
  // one, so the rule is honoured where the edit actually is.
  const offenders: string[] = [];
  for (const rel of ["chatbot-prompt.txt", "public/llms.txt"]) {
    const text = readFileSync(join(ROOT, rel), "utf8");
    for (const line of text.split("\n")) {
      // Sentence-scoped, not line-scoped. chatbot-prompt.txt line 76 is a whole
      // Pronto.ai bullet whose em dash belongs to an unrelated clause ("Sole
      // technician — owned end-to-end fleet integration") written long before
      // this change. Flagging the line would mean rewriting prose nobody asked
      // to touch; what matters is that the corrected figure itself is not
      // carried by an em dash.
      for (const sentence of line.split(/(?<=[.!?])\s+/)) {
        if (/10\+\s*executive/i.test(sentence) && sentence.includes("\u2014")) {
          offenders.push(`${rel}: ${sentence.trim().slice(0, 90)}`);
        }
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "the corrected claims use an em dash; use a comma or a colon instead:\n" + offenders.join("\n"),
  );
});
