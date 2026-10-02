import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
    else if (/\.(ts|tsx|txt|js|json|html|md)$/.test(entry.name)) out.push(full);
  }
  return out;
}

// Only tracked files. dist/ and functions/api/_prompt-fallback*.js are build
// output (gitignored) regenerated from these sources — scanning them would flag
// the stale copy of a file that was already fixed, and hand-editing build output
// is not a fix. The build regenerates them from source.
function tracked(): Set<string> {
  const out = new Set<string>();
  try {
    const r = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" });
    for (const rel of r.split("\0")) if (rel) out.add(join(ROOT, rel));
  } catch {
    return new Set(); // no git (tarball): fall back to walking everything
  }
  return out;
}

function sources(): string[] {
  const t = tracked();
  const walked = walk(ROOT).filter(
    (f) => !f.includes("/tests/") && !f.includes("/evals/") && !f.includes("/node_modules/"),
  );
  if (t.size === 0) return walked;
  return walked.filter((f) => t.has(f));
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

test("Google Business Profile work appears nowhere, under any name", () => {
  // Joe, 2026-10-01: it is "definitely going to be a product and service that I
  // want to offer once it's actually vetted and proven that it works." Until then
  // it is gone from every surface that sells work.
  //
  // This is deliberately a BAN on the subject, not a detector for an offer.
  // Two rounds of review defeated the detector versions, each time by mutation:
  //   1. exact names only        -> a renamed offer passed
  //   2. behaviour + keyword list -> a priced offer with no keyword passed
  //   3. per-line matching        -> an offer wrapped across two lines passed
  // A detector has to guess how the next person will word it. After the offer was
  // already pulled once (2026-09-17) and returned renamed two days later, guessing
  // again is the wrong shape for this check.
  //
  // So: NO file sells or describes running a client's Google Business Profile, and
  // the old offer names do not come back. Legitimate mentions have been removed
  // from the site and the prompts, so the clean state is that the subject simply
  // does not appear. Whole-text matching, so line wrapping cannot hide it.
  //
  // If a genuine, non-offer mention is ever needed, add its exact allowed string to
  // ALLOWED — that makes the exception explicit and reviewable, which is the point.
  //
  // KNOWN LIMIT, stated so nobody trusts this further than it goes: a description
  // that never names Google, the profile or the listing is undetectable here. Ten
  // mutations were run against this guard; nine are caught. The tenth —
  // "**Local Reputation Care** — an AI keeps your storefront reviews and weekly
  // updates handled." — describes the service with no banned term, and no pattern
  // can flag it without also flagging legitimate copy about other work. That case is
  // covered by the behavioural evals (evals/datasets/jts-persona.json) and by human
  // review, not by this file. This guard is a backstop for the wording we have
  // actually seen, not a semantic classifier.
  const BANNED = new RegExp(
    [
      "Google Maps Growth",
      "visibility audit",
      "Visibility Sprint",
      "Google Business Profile",
      "Google My Business",
      "business profile",
      "business listing",
      "profile upkeep",
      "listing fresh",
      "\\bGBP\\b",
    ].join("|"),
    "i",
  );
  // A description of the service, independent of what it is called.
  //
  // PROFILE requires a qualifier on purpose. An earlier version allowed a bare
  // "profile", and matched unrelated prose ("...archetypes and CV templates for my
  // profile, and now run it daily..."), so it flagged three innocent files. Google
  // Business Profile, business profile, Google listing — but never a bare
  // "profile" or "listing".
  const PROFILE =
    "(?:google\\s+)?(?:business\\s+)?(?:profile|listing)";
  const QUALIFIED =
    "(?:google\\s+business\\s+profile|google\\s+profile|google\\s+listing|business\\s+profile|business\\s+listing|google\\s+my\\s+business)";
  const DESCRIPTION = new RegExp(
    [
      // "an agent runs / manages / posts to ... the listing"
      "\\b(?:agent|bot|assistant|we|joe)\\b[\\s\\S]{0,60}?\\b(?:runs?|running|manages?|managing|managed|posts?|posting|replies|replying|answers?|answering|maintains?|maintaining|handles?|handling)\\b[\\s\\S]{0,60}?" +
        QUALIFIED,
      // the reverse order
      QUALIFIED +
        "[\\s\\S]{0,60}?\\b(?:run|runs|running|managed|posts|posting|replies|replying|answered|upkeep|maintain|maintained)\\b",
      // Google-adjacent upkeep phrasing
      "\\bgoogle\\b[\\s\\S]{0,40}?\\b(?:upkeep|posts|posting|replies|listing|profile)\\b",
    ].join("|"),
    "i",
  );
  // PROFILE is kept for the banned-name pass so an unqualified mention still trips
  // the name check above via the explicit strings.
  void PROFILE;

  // The historical blog post that records the pull is not an offer, and internal
  // tooling (scripts/visibility-audit, scripts/gbp-ops) runs no client work.
  const ALLOWED: string[] = [];
  const offenders: string[] = [];

  for (const { file, text } of readAll()) {
    if (ALLOWED.some((a) => file.includes(a))) continue;
    if (file.includes("/scripts/") || file.includes("/tests/") || file.includes("/evals/")) continue;
    // Comments are NOT stripped. An earlier version skipped them, and two things
    // escaped as a result: a markdown '* ' bullet in a .txt file (treated as a
    // comment) and an offer written in a .ts comment. A comment can still ship and
    // still be read — api/_shared/rag.js already carried a dead offer slug in one —
    // so it is not a safe harbour. Verified this causes no false positives: the only
    // comment hits were real leftovers, now removed.
    const stripped = text;
    const flat = stripped.replace(/\s+/g, " ").trim();
    if (BANNED.test(stripped) || DESCRIPTION.test(flat)) {
      const m = stripped.match(BANNED) || flat.match(DESCRIPTION);
      const i = m && m.index !== undefined ? Math.max(0, m.index - 40) : 0;
      offenders.push(`${file}: ...${flat.slice(i, i + 120)}...`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "these files mention or sell Google Business Profile work (pulled 2026-10-01; it returns only once vetted and proven):\n" +
      offenders.join("\n"),
  );
});

test("the resume-facing surfaces do not title him Forward Deployed Engineer", () => {
  // The resumes say "Founder & AI Systems Developer". "Forward Deployed Engineer"
  // appeared in several places and was cut from the hero, but an independent review
  // found it surviving on the rendered About page (src/about-i18n.ts) and in the
  // chatbot and llms.txt — so the title was removed in one place and left in three.
  // This pins the surfaces a recruiter reads.
  //
  // Exempt: jts-prompt.txt and api/_shared/personas.js, which describe the JTS
  // business to its own clients ("a solo Forward Deployed Engineer based in San
  // Diego"). That is an agency descriptor, not his resume, and changing it is a
  // separate positioning decision rather than a fidelity fix.
  const FDE = /forward deployed engineer/i;
  const EXEMPT = ["/jts-prompt.txt", "/api/_shared/personas.js"];
  const offenders: string[] = [];
  for (const { file, text } of readAll()) {
    if (file.includes("/tests/")) continue;
    if (EXEMPT.some((e) => file.endsWith(e))) continue;
    for (const line of text.split("\n")) {
      if (FDE.test(line)) offenders.push(`${file}: ${line.trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "these resume-facing files still title him Forward Deployed Engineer (the resumes say Founder & AI Systems Developer):\n" +
      offenders.join("\n"),
  );
});
