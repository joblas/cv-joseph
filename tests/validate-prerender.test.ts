import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// scripts/validate-prerender.ts is the build's last gate: only ERRORS fail it.
// Two of its checks could not fail anything:
//   - a broken internal link was a WARNING, so the 404 links from #36 shipped;
//   - nothing checked that the og:image file exists, so four article share cards
//     pointed at images that were never committed and 404'd live.
// And /privacy was on the link skip list and never validated as a page, so the
// page that fixed the /privacy 404 could be dropped with the build still green.
//
// Each case runs the real script against a small fixture tree (PRERENDER_DIST),
// so it needs no build. The fixture is deliberately incomplete; the assertions
// look only at the issues this test is about, by section.

const ROOT = process.cwd();
const TSX = join(ROOT, "node_modules", ".bin", "tsx");

function page(canonical: string, og: string, links: string[]): string {
  return (
    `<!doctype html><html><head><title>Fixture</title>` +
    `<link rel="canonical" href="https://cloudyjoe.com/${canonical}" />` +
    `<meta property="og:image" content="${og}" /></head><body><h1>Fixture</h1>` +
    links.map((h) => `<a href="${h}">link</a>`).join("") +
    `</body></html>`
  );
}

function run(build: (dist: string) => void): { status: number | null; sections: Map<string, string[]> } {
  const dist = mkdtempSync(join(tmpdir(), "validate-prerender-"));
  try {
    build(dist);
    const r = spawnSync(TSX, ["--tsconfig", "tsconfig.app.json", "scripts/validate-prerender.ts"], {
      cwd: ROOT,
      env: { ...process.env, PRERENDER_DIST: dist },
      encoding: "utf8",
    });
    // eslint-disable-next-line no-control-regex -- strips the ANSI colours the script prints
    const out = (r.stdout + r.stderr).replace(/\x1b\[[0-9;]*m/g, "");
    // Split into sections: "✗ label — ..." / "⚠ label — ..." followed by issue lines.
    const sections = new Map<string, string[]>();
    let current = "";
    for (const line of out.split("\n")) {
      const head = line.match(/^[✗⚠✓] (\S+)/);
      if (head) {
        current = head[1];
        sections.set(current, []);
      } else if (/^\s+(ERR|WARN)\s/.test(line) && current) {
        sections.get(current)!.push(line.trim().replace(/\s+→ run .*$/, ""));
      }
    }
    sections.set("__all__", out.split("\n"));
    return { status: r.status, sections };
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
}

test("a broken internal link and a missing og:image file are errors, and /privacy must exist", () => {
  const { status, sections } = run((dist) => {
    mkdirSync(join(dist, "salon-beta-loop"), { recursive: true });
    writeFileSync(
      join(dist, "salon-beta-loop", "index.html"),
      page("salon-beta-loop", "https://cloudyjoe.com/articles/salon-beta-loop/og-missing.webp", [
        "/articles/salon-beta-loop", // the planted 404
        "/privacy", // not skipped any more, and absent here
        "/hermes", // exists below: must NOT be flagged
      ]),
    );
    mkdirSync(join(dist, "hermes"), { recursive: true });
    writeFileSync(join(dist, "hermes", "index.html"), page("hermes", "https://cloudyjoe.com/og-present.webp", []));
    writeFileSync(join(dist, "og-present.webp"), "x");
  });

  const abl = sections.get("salon-beta-loop") ?? [];
  assert.ok(abl.includes("ERR  Broken internal link: /articles/salon-beta-loop"), abl.join("\n"));
  assert.ok(abl.includes("ERR  Broken internal link: /privacy"), abl.join("\n"));
  assert.ok(
    abl.includes(
      "ERR  og:image file missing: dist/articles/salon-beta-loop/og-missing.webp (from https://cloudyjoe.com/articles/salon-beta-loop/og-missing.webp)",
    ),
    abl.join("\n"),
  );
  assert.ok(!abl.some((l) => l.includes("/hermes")), "an existing page was flagged:\n" + abl.join("\n"));
  const hermes = sections.get("hermes") ?? [];
  assert.ok(!hermes.some((l) => l.includes("og:image file missing")), "an existing og image was flagged");

  const privacy = sections.get("privacy") ?? [];
  assert.ok(privacy.includes("ERR  Prerendered HTML not found: dist/privacy/index.html"), privacy.join("\n"));
  assert.ok(
    (sections.get("__all__") ?? []).some((l) => /^Pages: 8 \|/.test(l)),
    "the page count should include /privacy (7 articles + 1)",
  );
  assert.notEqual(status, 0, "validation must fail");
});

test("the privacy page's own links are checked", () => {
  const { sections } = run((dist) => {
    mkdirSync(join(dist, "privacy"), { recursive: true });
    writeFileSync(join(dist, "privacy", "index.html"), page("privacy", "https://cloudyjoe.com/og-present.webp", ["/", "/en"]));
    writeFileSync(join(dist, "index.html"), "<html></html>");
    writeFileSync(join(dist, "og-present.webp"), "x");
  });
  const privacy = sections.get("privacy") ?? [];
  assert.deepEqual(privacy, ["ERR  Broken internal link: /en"]);
});
