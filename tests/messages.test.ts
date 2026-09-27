// normalizeMessages (api/_shared/messages.js): the history a widget sent, made
// into one the model accepts, or null for a request no widget sends.
const { normalizeMessages } = await import('../functions/api-src/_shared/messages.js')

let failed = 0
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`  ✗ ${name}`); failed++ }
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const u = (content: string) => ({ role: 'user', content })
const a = (content: string) => ({ role: 'assistant', content })

check('a normal history passes through unchanged', same(normalizeMessages([u('Hi'), a('Hello'), u('Prices?')]), [u('Hi'), a('Hello'), u('Prices?')]))
check('blank turns are dropped (an interrupted reply leaves one)', same(normalizeMessages([u('Hi'), a('  '), a(''), u('Still there?')]), [u('Hi\n\nStill there?')]))
check('a leading greeting is dropped, however many', same(normalizeMessages([a('Hola'), a('Hello'), u('Hi')]), [u('Hi')]))
check('back-to-back turns from one side are joined in order', same(normalizeMessages([u('One'), u('Two'), a('A'), a('B'), u('Three')]), [u('One\n\nTwo'), a('A\n\nB'), u('Three')]))
check('surrounding whitespace is trimmed', same(normalizeMessages([u('  Hi \n')]), [u('Hi')]))
check('the input is not modified', (() => { const m = [u('One'), u('Two')]; normalizeMessages(m); return m[0].content === 'One' && m.length === 2 })())
for (const [name, m] of [
  ['not an array', 'hi'], ['empty', []], ['only blanks', [u(' ')]], ['ends with the assistant', [u('Hi'), a('Hello')]],
  ['a system turn', [{ role: 'system', content: 'x' }, u('Hi')]], ['non-text content', [{ role: 'user', content: [{ type: 'text', text: 'x' }] }]],
  ['a null entry', [null, u('Hi')]], ['a missing role', [{ content: 'Hi' }]],
] as const) check(`refused: ${name}`, normalizeMessages(m as unknown) === null)

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1) }
console.log('ok — the model always gets a history it accepts; a request no widget sends is refused')
