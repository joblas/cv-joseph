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

// Fold text down to something a regex can actually match, because the obvious
// evasions live in the encoding, not the wording:
//   - a banned name wrapped across two lines  -> collapse whitespace
//   - "Google Maps Growth" (NBSP)     -> renders as a space, is not one
//   - "Visibility​Sprint" (zero-width)     -> invisible
//   - "Google&nbsp;Maps&nbsp;Growth" (entity)   -> renders as a space in HTML
// Applied to every guard below, not just some of them: an earlier version flattened
// only its description regex, so the name list still missed a two-line wrap and the
// commit message said otherwise.
// Soft hyphen and zero-width characters need OPPOSITE treatments, which is why a
// single rule failed both:
//   - a soft hyphen sits INSIDE a word  -> "Visi\u00adbility" must become
//     "Visibility", so it is DELETED. Spacing it gives "Visi bility" and the name
//     never matches.
//   - a zero-width char sits BETWEEN words -> "Visibility\u200bSprint" must become
//     "Visibility Sprint", so it becomes a SPACE. Deleting it joins the words into
//     "VisibilitySprint" and the name never matches either.
// Both were live misses, each demonstrated with a planted file that shipped green.
const SOFT_HYPHEN = /[\u00ad]/g;
const ZERO_WIDTH = /[\u200b\u200c\u200d\u2060\ufeff\u180e]/g;
const SPACEY = /[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g;

function safeCp(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return "";
  try {
    return String.fromCodePoint(n);
  } catch {
    return "";
  }
}

function flat(input: string): string {
  return (
    input
      // Named entities first...
      .replace(/&(nbsp|thinsp|ensp|emsp|zwnj|zwj|shy);/gi, (m) => {
        const k = m.toLowerCase().replace(/[&;]/g, "");
        if (k === "shy") return ""; // soft hyphen: delete, it splits a word
        return " "; // the rest are separators or spaces
      })
      // ...then numeric ones, decoded to the real character so the passes below
      // handle them uniformly. &#160; and &#xA0; are NBSP and render as a space;
      // only the literal &nbsp; was handled before, so both slipped through.
      .replace(/&#x([0-9a-f]{1,6});/gi, (_, h: string) => safeCp(parseInt(h, 16)))
      .replace(/&#(\d{1,7});/g, (_, d: string) => safeCp(Number(d)))
      .replace(SOFT_HYPHEN, "")
      .replace(ZERO_WIDTH, " ")
      .replace(SPACEY, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|txt|js|json|html|md|svg)$/.test(entry.name)) out.push(full);
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
  // This is a BAN on the subject, not a detector for an offer. Four review rounds
  // defeated the detector versions, each time by mutation:
  //   1. exact names only         -> a renamed offer passed
  //   2. behaviour + keyword list -> a priced offer with no keyword passed
  //   3. per-line matching        -> an offer wrapped across two lines passed
  //   4. raw-text matching        -> a banned name wrapped across lines passed
  // A detector has to guess how the next writer will word it, and this offer was
  // already pulled once (2026-09-17) and came back renamed two days later. So the
  // check bans the subject instead of guessing its phrasing.
  //
  // WHAT THIS CATCHES
  //   - every name the offer has carried, including earlier ones ("Google Maps
  //     Growth", "Visibility Sprint", "Google My Business")
  //   - the service described by its real nouns: Google within 60 characters of
  //     profile/profile(s) or listing/listing(s) or review(s), in EITHER order.
  //     Both branches carry both plurals, because a reverse-order check that only
  //     listed the singular "profile|listing" let "reviews on Google" through.
  //   - all of it after one `flat()` pass, applied to every check rather than only
  //     some. It folds the encodings that render as ordinary spaces but are not:
  //     NBSP, narrow/thin spaces, zero-width characters, and HTML entities in
  //     named (incl. numeric &[#]160;) and hex (&#xA0;) form.
  //   - across line wraps and inside code comments. A comment ships and gets read;
  //     api/_shared/rag.js already carried a dead offer slug in one.
  //
  // Soft hyphen and zero-width characters need OPPOSITE treatment, which is why a
  // single rule missed both: a soft hyphen sits INSIDE a word, so it is deleted
  // ("Visi\u00adbility" -> "Visibility"), while a zero-width character sits BETWEEN
  // words, so it becomes a space ("Visibility\u200bSprint" -> "Visibility Sprint").
  // Spacing the first or deleting the second breaks the match instead of fixing it.
  //
  // WHAT THIS DOES NOT CATCH
  // A paraphrase using none of those nouns. "An AI keeps your storefront reviews and
  // weekly updates handled" describes the pulled service and matches nothing here,
  // because flagging it would mean flagging any sentence about local marketing. Of 21
  // mutations run against this guard, 20 are caught; that one is not, and no regex
  // fixes it. Four rounds each produced a fresh wording for this offer - a lexical
  // guard cannot win that race, and pretending otherwise is what produced the earlier
  // versions' bugs.
  //
  // The durable guarantee is behavioural, not lexical: the prompts no longer offer it
  // and evals/datasets/jts-persona.json requires the chatbot to refuse - which is the
  // surface a customer actually talks to. This is the cheap backstop.
  //
  // If a genuine, non-offer mention is ever needed, add its exact string to ALLOWED
  // below, so the exception is explicit and reviewable.
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
      "\\bGMB\\b",
    ].join("|"),
    "i",
  );
  // The service by its nouns: Google near profile/listing/reviews, either order.
  const SERVICE =
    /google[^.]{0,60}?\b(?:profiles?|listings?|reviews?)\b|\b(?:profiles?|listings?|reviews?)\b[^.]{0,60}?google/i;

  // The historical blog post that records the pull is not an offer, and internal
  // tooling (scripts/visibility-audit, scripts/gbp-ops) runs no client work.
  const ALLOWED: string[] = [];
  const offenders: string[] = [];

  for (const { file, text } of readAll()) {
    if (ALLOWED.some((a) => file.includes(a))) continue;
    if (file.includes("/scripts/") || file.includes("/tests/") || file.includes("/evals/")) continue;
    // Comments are NOT stripped: a comment still ships and still gets read, and
    // api/_shared/rag.js already carried a dead offer slug in one.
    const f = flat(text);
    if (BANNED.test(f) || SERVICE.test(f)) {
      const m = f.match(BANNED) ?? f.match(SERVICE);
      const i = m && m.index !== undefined ? Math.max(0, m.index - 40) : 0;
      offenders.push(`${file}: ...${f.slice(i, i + 130)}...`);
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

test("every career timeline carries the same entries", () => {
  // The 2019-2025 stretch was closed on the main page but not on /about, which
  // keeps its own copy of the timeline in src/about-i18n.ts. A recruiter reaching
  // /about saw Pronto (2018-2019) jump straight to 2025: the same six-year gap,
  // still live after the fix, because the fix only touched one of the two files.
  //
  // So the entries are pinned per surface rather than "somewhere in the repo".
  // Adding a third timeline means adding it here, which is the point.
  const SURFACES = ["src/i18n.ts", "src/about-i18n.ts"];
  // Entries are pinned by exact period string, not by a bare "2019". The first
  // version of this test looked for "2019", which Pronto's "2018-2019" satisfies
  // anywhere in the file, so a wrong start year (2020-2025) passed in BOTH files.
  // Pinning the whole period is what makes date drift fail.
  const REQUIRED: [string, string][] = [
    ["Quadient", "the current role"],
    ["Independent &amp; Contract Work|Independent & Contract Work", "the 2019-2025 stretch"],
    ["May 2025-Present|May 2025 - Present|May 2025\u2013Present", "Quadient's start"],
    ["2019-2025|2019 - 2025|2019\u20132025", "the 2019-2025 period"],
    ["2018-2019|2018 - 2019|2018\u20132019", "Pronto"],
    ["2016-2018|2016 - 2018|2016\u20132018", "Uber ATG"],
    ["2009-2016|2009 - 2016|2009\u20132016", "Google / Waymo"],
  ];
  const missing: string[] = [];
  for (const rel of SURFACES) {
    const text = readFileSync(join(ROOT, rel), "utf8");
    for (const [needle, what] of REQUIRED) {
      const found = needle.split("|").some((n) => text.includes(n));
      if (!found) missing.push(`${rel} is missing ${what} (${needle.split("|")[0]})`);
    }
    // Ordering, checked on the ENTRY MARKERS within the TIMELINE REGION only.
    //
    // Two earlier versions of this were wrong in opposite directions, and both are
    // worth knowing about:
    //   1. It looked for "2019-", "2018-" etc. Both files write periods with an en
    //      dash ("2019\u20132025"), so every lookup missed, the list came back empty
    //      and the loop never ran. A mutation that moved the 2019-2025 entry below
    //      Pronto passed. A vacuous check is worse than none: it reads as coverage.
    //   2. Marker positions were taken across the WHOLE FILE. "Pronto" and "Uber
    //      ATG" also appear in the bio prose dozens of lines above the timeline, so
    //      the real, correctly-ordered timeline reported as out of order.
    // Slicing to the entries themselves avoids both failure modes.
    // Ordering is checked only where order actually exists.
    //
    // NOT in src/i18n.ts by position: that file is a keyed object
    // (experience.jts, experience.quadient, ...). Its file order carries no meaning
    // and does not match what a visitor sees — the page order comes from the JSX in
    // src/App.tsx. Asserting on the object's key order would test something nobody
    // experiences. Three attempts at this check were wrong before this one:
    //   1. year strings with a hyphen, which never matched (both files use en dashes)
    //      so the loop never ran and any reordering passed;
    //   2. marker positions across the whole file, where the company names also
    //      appear in bio prose above the timeline, so the correct timeline failed;
    //   3. assuming i18n.ts holds its entries in display order, which it does not.
    // So: the timeline array for /about, and the render order in App.tsx for the
    // main page. Those are the two places a reader can actually see a gap.
    const ORDERS: [string, string[]][] = [
      [
        "src/about-i18n.ts",
        // Anchor on the entry's `company:` field, not the bare name: the company
        // names also occur in the bio prose above the timeline, which is what made
        // the previous version fail on a correctly ordered file.
        [
          "company: 'Quadient'",
          "company: 'Independent & Contract Work'",
          "company: 'Pronto.ai'",
          "company: 'Uber ATG (Otto)'",
          "company: 'Google Self-Driving Car Project (Waymo)'",
        ],
      ],
      [
        "src/App.tsx",
        [
          // The </h3> is part of the anchor on purpose: the same expression also
          // appears in an <img alt=> attribute just above, so matching the bare
          // expression finds the decorative image line and the check can be fooled
          // into measuring a move that does not reorder anything a reader sees.
          "t.experience.jts.company}</h3>",
          "t.experience.quadient.company}</h3>",
          "t.experience.itAutomation.company}</h3>",
          "t.experience.pronto.company}</h3>",
          "t.experience.uberAtg.company}</h3>",
          "t.experience.google.company}</h3>",
        ],
      ],
    ];
    for (const [rel, anchors] of ORDERS) {
      const body = readFileSync(join(ROOT, rel), "utf8");
      let prev = -1;
      let prevName = "";
      for (const anchor of anchors) {
        const i = body.indexOf(anchor);
        if (i === -1) {
          missing.push(`${rel} has no "${anchor}" — cannot verify order`);
          break;
        }
        if (i < prev) {
          missing.push(`${rel} lists "${anchor}" after "${prevName}" — timeline is not newest-first`);
        }
        prev = i;
        prevName = anchor;
      }
    }
  }
  assert.deepEqual(missing, [], `career timelines disagree across surfaces:\n${missing.join("\n")}`);
});
