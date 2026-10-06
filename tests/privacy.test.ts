// The public privacy page (src/PrivacyPolicy.tsx) must tell the truth about
// what the site does. Review of #41 (findings CV41-F1/F2/F3) found it named
// processors the site no longer uses (Anthropic for chat, OpenAI for voice),
// claimed usage analytics that do not exist, said no emails are collected while
// the chatbot records emails visitors type (api/_shared/leads.js), linked
// "Back to home" to /en (an in-app 404), gave a contact address with no MX
// record, and the prerendered meta description said something else again.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import PrivacyPolicy from "../src/PrivacyPolicy.tsx";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const html = renderToString(
  React.createElement(StaticRouter, { location: "/privacy" }, React.createElement(PrivacyPolicy)),
);
const source = read("src/PrivacyPolicy.tsx");

test("the back link goes to the home page, not /en (an in-app 404)", () => {
  const hrefs = [...html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>[^<]*(?:<!-- -->)?[^<]*Back to home/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, ["/"]);
});

test("the processor list names the services the api code actually calls", () => {
  // Chat completions: Ollama Cloud via ANTHROPIC_BASE_URL (api/_shared/models.js).
  // Voice: Gemini Live (api/voice-live.js, api/_shared/voice-provider.js).
  // Leads + rate limits + search: Supabase. Lead notices: Resend. Traces: Langfuse.
  for (const name of ["Ollama", "Gemini", "Supabase", "Resend", "Langfuse", "Cloudflare"]) {
    assert.ok(html.includes(name), `privacy page should name ${name}`);
  }
  assert.ok(!/Anthropic \(Claude\)/.test(source), "chat no longer runs on an Anthropic account");
  assert.ok(!/OpenAI \(Realtime API\)/.test(source), "voice runs on Gemini Live, not OpenAI");
});

test("no false analytics or 'no emails collected' claims, in either language", () => {
  for (const s of ["Usage analytics", "Analytics data", "Analiticas de uso", "datos de analiticas",
    "No names, emails", "No se recopilan nombres, emails"]) {
    assert.ok(!source.includes(s), `privacy page still says "${s}"`);
  }
  assert.ok(/email/i.test(html) && /chat/i.test(html));
  assert.ok(html.includes("chat_leads") || /email address you type/i.test(html),
    "the page should disclose that emails typed into the chat are recorded");
});

test("the privacy contact is an address that receives mail (cloudyjoe.com has no MX)", () => {
  assert.ok(!source.includes("hola@cloudyjoe.com"));
  assert.ok(!read("src/SelfHealingChatbot.tsx").includes("hola@cloudyjoe.com"));
  assert.ok(html.includes("mailto:blasj408@gmail.com"));
});

test("the prerendered meta description is the component's own description", () => {
  const prerender = read("scripts/prerender.tsx");
  assert.ok(!prerender.includes("no analytics"), "prerender meta still claims 'no analytics'");
  assert.match(prerender, /import PrivacyPolicy, \{ PRIVACY_DESCRIPTION \} from '\.\.\/src\/PrivacyPolicy\.tsx'/);
  assert.match(prerender, /content="\$\{esc\(PRIVACY_DESCRIPTION\)\}"/);
  assert.match(source, /desc\.content = PRIVACY_DESCRIPTION/);
});
