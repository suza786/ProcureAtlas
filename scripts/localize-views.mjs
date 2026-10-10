// Idempotent source migration: explicit known UI copy only, never customer data.
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
const bundle = path.resolve('.private/i18n-source-migration.cjs')
buildSync({ entryPoints: ['src/lib/i18n.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: bundle })
const { translations } = createRequire(import.meta.url)(bundle)
const known = new Set(Object.keys(translations.en).concat(Object.values(translations.en)))
const files = ['src/components/views', 'src/components/account'].flatMap(directory => fs.readdirSync(directory).filter(file => file.endsWith('.tsx')).map(file => path.join(directory, file)))
let phrases = 0
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const edits = [], needs = new Map()
  const component = node => {
    if (ts.isFunctionDeclaration(node)) return /^[A-Z]/.test(node.name?.text ?? '') && node.body
    return ts.isArrowFunction(node) && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name) && /^[A-Z]/.test(node.parent.name.text) && ts.isBlock(node.body)
  }
  const owner = node => { for (let current = node.parent; current; current = current.parent) if (component(current)) return current; return null }
  const mark = (fn, name) => { if (!needs.has(fn)) needs.set(fn, new Set()); needs.get(fn).add(name) }
  const replace = (node, value) => edits.push({ start: node.getStart(source), end: node.end, value })
  const visit = node => {
    const fn = owner(node)
    if (fn && ts.isJsxText(node)) {
      const value = node.text.replace(/\s+/g, ' ').trim().replaceAll('&amp;', '&')
      if (known.has(value) && value.length) {
        const singleLine = !node.text.includes('\n')
        const before = singleLine && /^\s/.test(node.text) ? "{' '}" : ''
        const after = singleLine && /\s$/.test(node.text) ? "{' '}" : ''
        replace(node, `${before}{t(${JSON.stringify(value)})}${after}`); mark(fn, 't'); phrases++
      }
    }
    if (fn && ts.isStringLiteral(node) && ts.isJsxAttribute(node.parent) && ['label','title','placeholder','aria-label','description'].includes(node.parent.name.getText(source)) && known.has(node.text)) {
      replace(node, `{t(${JSON.stringify(node.text)})}`); mark(fn, 't'); phrases++
    }
    if (fn && ts.isStringLiteral(node) && ts.isConditionalExpression(node.parent) && (node.parent.whenTrue === node || node.parent.whenFalse === node) && known.has(node.text)) {
      let inJsx = false
      for (let parent = node.parent; parent && parent !== fn; parent = parent.parent) if (ts.isJsxExpression(parent)) { inJsx = true; break }
      if (inJsx) { replace(node, `t(${JSON.stringify(node.text)})`); mark(fn, 't'); phrases++ }
    }
    if (fn && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['formatDate','formatDateTime'].includes(node.expression.text)) {
      let name = node.expression.text
      if (name === 'formatDate' && /[Dd]eadline|\.dueAt/.test(node.arguments[0]?.getText(source) ?? '')) { name = 'formatDateTime'; replace(node.expression, name) }
      mark(fn, name)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  for (const [fn, names] of needs) {
    const existing = fn.body.statements.find(statement => ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => ts.isCallExpression(declaration.initializer) && declaration.initializer.expression.getText(source) === 'useTranslation'))
    if (existing) {
      const binding = existing.declarationList.declarations.find(declaration => ts.isCallExpression(declaration.initializer) && declaration.initializer.expression.getText(source) === 'useTranslation').name
      if (ts.isObjectBindingPattern(binding)) { const current = new Set(binding.elements.map(element => element.name.getText(source))); const extra = [...names].filter(name => !current.has(name)); if (extra.length) edits.push({ start: binding.end - 1, end: binding.end - 1, value: ', ' + extra.join(', ') }) }
    } else edits.push({ start: fn.body.getStart(source) + 1, end: fn.body.getStart(source) + 1, value: `\n  const { ${[...names].join(', ')} } = useTranslation()\n` })
  }
  if (needs.size && !text.includes("from '@/hooks/use-translation'")) {
    const directive = source.statements[0]
    const position = ts.isExpressionStatement(directive) && ts.isStringLiteral(directive.expression) ? directive.end : 0
    edits.push({ start: position, end: position, value: "\nimport { useTranslation } from '@/hooks/use-translation'\n" })
  }
  let result = text
  for (const edit of edits.sort((a, b) => b.start - a.start)) result = result.slice(0, edit.start) + edit.value + result.slice(edit.end)
  if (result !== text) fs.writeFileSync(file, result)
}
fs.unlinkSync(bundle)
console.log(`Localized ${phrases} static UI strings; customer data and API state values preserved.`)
