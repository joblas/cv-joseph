// Build-time generator: <name>-prompt.txt → functions/api/_prompt-fallback[-<persona>].js
// (Workers bundlers can't import .txt as a module)
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const PROMPT_MODULES = [
  { file: 'chatbot-prompt.txt', module: '_prompt-fallback.js' },
  { file: 'jts-prompt.txt', module: '_prompt-fallback-jts.js' },
]
for (const { file, module } of PROMPT_MODULES) {
  const prompt = readFileSync(join(root, file), 'utf8')
  const escaped = prompt.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
  const out = `// Auto-generated from ${file} — DO NOT EDIT\nexport default \`${escaped}\`\n`
  writeFileSync(join(root, 'functions/api', module), out)
  console.log('gen-prompt-module: ok,', file, prompt.length, 'chars')
}
