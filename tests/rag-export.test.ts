/* eslint-disable @typescript-eslint/no-explicit-any --
 * The work list is plain JavaScript (api/_shared/work.js) with no type surface.
 */
// `npm run rag:export` really writes the work fact cards.
//
// tests/agent-knowledge.test.ts checks factCardChunks(), but nothing ran the
// export script itself: a broken main guard, or a dropped write of
// scripts/chunks/work-facts.json, would let the next manual `npm run rag:sync`
// ingest no fact cards at all, with every suite green (review, 2026-10-02).
//
// Offline: the export reads repo files and writes scripts/chunks/ (gitignored).
// It never touches the database; only rag:ingest does, and nothing here runs it.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const out = fileURLToPath(new URL('../scripts/chunks/work-facts.json', import.meta.url))

const { WORK_ITEMS, FACT_CARDS_ID }: any = await import('../api/_shared/work.js')
const { factCardChunks }: any = await import('../scripts/export-chunks.ts')

let failed = 0
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`  ✗ ${name}`); failed++ }
}

check('the fact cards export under work-facts', FACT_CARDS_ID === 'work-facts')
// A stale file from an earlier run must not pass for a fresh one.
rmSync(out, { force: true })
let log = ''
try {
  log = execFileSync('npm', ['run', 'rag:export'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
} catch (err: any) {
  console.error(err.stdout || '', err.stderr || '')
  check('npm run rag:export exits 0', false)
}
check('rag:export wrote scripts/chunks/work-facts.json', existsSync(out))
const cards: any[] = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : []
check(`it holds one card per work item plus the credits card (${WORK_ITEMS.length + 1}; got ${cards.length})`, cards.length === WORK_ITEMS.length + 1)
check('it is exactly what factCardChunks() builds', JSON.stringify(cards) === JSON.stringify(factCardChunks()))
check('the Shopify card is in it', cards.some((c) => c.metadata?.section_id === 'cbarrgs-shop' && c.content.includes('shopify.cbarrgs.com')))
check('the export reports the cards', new RegExp(`${FACT_CARDS_ID} → ${WORK_ITEMS.length + 1} fact cards`).test(log))

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log(`ok — rag:export writes ${cards.length} work fact cards to scripts/chunks/work-facts.json`)
