// Build-time generator: chatbot-prompt.txt → functions/api/_prompt-fallback.js
// (Workers bundlers can't import .txt as a module)
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const prompt = readFileSync(join(root, 'chatbot-prompt.txt'), 'utf8')
const escaped = prompt.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
const out = `// Auto-generated from chatbot-prompt.txt — DO NOT EDIT
export default \`${escaped}\`
`
writeFileSync(join(root, 'functions/api/_prompt-fallback.js'), out)
console.log('gen-prompt-module: ok,', prompt.length, 'chars')