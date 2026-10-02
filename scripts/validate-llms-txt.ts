/**
 * Build-time validation: checks that llms.txt stays in sync with i18n.ts content.
 *
 * Defines "proof points" — key terms/phrases that MUST appear in llms.txt
 * because they represent real content from the website. When i18n.ts adds
 * new sections or projects, add matching proof points here so the check
 * catches the drift on next build.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.app.json scripts/validate-llms-txt.ts
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// Proof points: key terms that MUST appear in llms.txt
// Grouped by source section for readable error messages.
// ---------------------------------------------------------------------------

interface ProofPoint {
  /** Where this content lives in the codebase */
  source: string
  /** Terms that must ALL appear in llms.txt (case-insensitive) */
  terms: string[]
}

const PROOF_POINTS: ProofPoint[] = [
  // -- Projects (i18n.ts → projects) --
  {
    source: 'i18n.ts → projects → Hermes',
    terms: ['Hermes', '16', 'composab'],
  },
  {
    source: 'i18n.ts → projects → OpenClaw → Hermes Migration',
    terms: ['OpenClaw', 'Hermes', 'migration'],
  },
  {
    source: 'i18n.ts → projects → Skate Workshop',
    terms: ['Skate Workshop', 'React Native', 'Supabase'],
  },
  {
    source: 'i18n.ts → projects → Career Ops',
    terms: ['Career Ops'],
  },
  {
    source: 'i18n.ts → projects → cv-joseph',
    terms: ['cv-joseph', 'chatbot', 'RAG'],
  },
  {
    source: 'i18n.ts → projects → DALL-E',
    terms: ['DALL-E'],
  },
  {
    source: 'i18n.ts → projects → Whisper Walkie',
    terms: ['Whisper Walkie'],
  },

  // -- AI Coding Power User (i18n.ts → claudeCode) --
  {
    source: 'i18n.ts → claudeCode',
    terms: ['multi-agent', 'RAG', 'prompt engineering'],
  },

  // -- Self-Healing Chatbot (chatbot-i18n.ts): deliberately NOT required. --
  // That article tells the cv-santiago template author's build history and
  // numbers (71 evals, $0.005 per conversation, Langfuse tracing) in Joe's first
  // person; on this site the eval workflow is manual-only and Langfuse is not
  // configured in production. The 2026-10-02 knowledge audit marked it EXCLUDE,
  // so llms.txt no longer carries it, and this check must not force it back.

  // -- Articles published (registry.ts) --
  {
    source: 'articles/registry.ts',
    terms: ['Hermes', 'Career Ops'],
  },

  // -- Key experience points --
  {
    source: 'i18n.ts → experience → Google / Waymo',
    terms: ['Firefly', 'drive-by-wire', 'sensor calibration'],
  },
  {
    // No mileage figure: the bio's 2,900 and the public record's ~3,099
    // disagree, so the agent surfaces say "cross-country, San Francisco to
    // New York" (Joe, 2026-10-02). tests/agent-knowledge.test.ts bans the
    // figure on every bot surface, so this check must not require it.
    source: 'i18n.ts → experience → Pronto / Uber',
    terms: ['Pronto', 'cross-country', 'San Francisco to New York', 'autonomous'],
  },
]

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const llmsTxtPath = resolve(root, 'public/llms.txt')
let llmsTxt: string

try {
  llmsTxt = readFileSync(llmsTxtPath, 'utf-8').toLowerCase()
} catch {
  console.error(`\n❌ public/llms.txt not found\n`)
  process.exit(1)
}

let errors = 0

for (const pp of PROOF_POINTS) {
  const missing = pp.terms.filter(t => !llmsTxt.includes(t.toLowerCase()))
  if (missing.length > 0) {
    errors++
    console.error(
      `❌ llms.txt missing content from [${pp.source}]:\n` +
      `   Missing terms: ${missing.map(t => `"${t}"`).join(', ')}\n`
    )
  }
}

if (errors > 0) {
  console.error(
    `\n🔴 llms.txt is out of sync — ${errors} section(s) have missing content.\n` +
    `   Update public/llms.txt to include the missing information,\n` +
    `   or add the proof point to scripts/validate-llms-txt.ts if intentionally omitted.\n`
  )
  process.exit(1)
} else {
  console.log('✅ llms.txt is in sync with i18n content')
}
