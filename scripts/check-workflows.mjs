// Static checks of .github/workflows that actionlint does not cover. Exits non-zero on any problem.
// - A plain (unquoted) YAML value containing ` #` is cut there: the rest becomes a comment. A comment holding `${{`
//   means an expression was silently dropped from the value.
// - The per-PR run budget in opencode.yml finds earlier runs by their title and admitted attempts by a step name, so
//   run-name, the title filter and the step name must agree.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isPair, isScalar, parseDocument, visit } from 'yaml'

const dir = '.github/workflows'
const problems = []

for (const file of readdirSync(dir).filter((name) => /\.ya?ml$/.test(name))) {
  const path = join(dir, file)
  const source = readFileSync(path, 'utf8')
  const doc = parseDocument(source)
  for (const error of doc.errors) problems.push(`${path}: ${error.message}`)
  visit(doc, {
    Pair(_, pair) {
      const value = pair.value
      if (!isScalar(value) || value.type !== 'PLAIN' || !value.comment?.includes('${{')) return
      const line = source.slice(0, value.range[0]).split('\n').length
      problems.push(
        `${path}:${line}: value of "${pair.key}" is cut at " #", "#${value.comment}" became a comment; quote the value`,
      )
    },
  })
}

const opencodePath = join(dir, 'opencode.yml')
const opencode = parseDocument(readFileSync(opencodePath, 'utf8')).toJS()
const runName = String(opencode['run-name'] ?? '')
const titlePrefix = runName.split('${{')[0]
const steps = opencode.jobs?.agent?.steps ?? []
const budget = steps.find((step) => step.id === 'budget')?.run ?? ''
if (!runName.includes('${{')) {
  problems.push(`${opencodePath}: run-name "${runName}" has no PR number, the budget cannot tell PRs apart`)
}
if (!budget.includes(`display_title == \\"${titlePrefix}$PR\\"`)) {
  problems.push(`${opencodePath}: the budget step does not filter runs by the run-name title "${titlePrefix}<PR>"`)
}
if (!steps.some((step) => step.name === 'Admit request') || !budget.includes('.name == "Admit request"')) {
  problems.push(`${opencodePath}: the budget counts step "Admit request", which must exist in job "agent"`)
}

if (problems.length > 0) {
  console.error('check:workflows:')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log('check:workflows: workflow values are intact and the run budget matches run-name.')
