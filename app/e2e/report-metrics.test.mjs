// Unit tests for the shared report scoring (src/lib/reportMetrics.ts), run in plain Node.
// Usage: node e2e/report-metrics.test.mjs
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '../src/lib/reportMetrics.ts'), 'utf8')
const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
const file = join(mkdtempSync(join(tmpdir(), 'pm-report-')), 'reportMetrics.mjs')
writeFileSync(file, out)
const { discoveryScore, accuracyScore, buildReportSnapshot, formatScore } = await import(file)

let passed = 0
const failures = []
const check = (name, ok, detail = '') => { if (ok) { passed++; console.log(`  ✓ ${name}`) } else { failures.push(name); console.log(`  ✗ ${name} ${detail}`) } }

const row = (o) => ({ locationId: 'a', questionId: 'p1', question: 'q', category: 'discovery', sampledAt: '2026-10-24T06:00:00Z', answer: '', citations: [], claims: [], ...o })
const claim = (evaluation) => ({ label: 'Hours', value: 'x', expected: 'y', evaluation })

// Discovery: 34 eligible (14 mentioned), 16 relevance not confirmed, 2 not relevant
const disc = [
  ...Array.from({ length: 14 }, () => row({ eligibility: 'eligible', mentioned: true })),
  ...Array.from({ length: 20 }, () => row({ eligibility: 'eligible', mentioned: false })),
  ...Array.from({ length: 16 }, () => row({ eligibility: 'unknown', mentioned: false })),
  ...Array.from({ length: 2 }, () => row({ eligibility: 'not_relevant', mentioned: false })),
]
const d = discoveryScore(disc)
check('Discovery 14/34 = 41.2% (uncertain/irrelevant excluded, not negative)', d.numerator === 14 && d.denominator === 34 && d.percentage === 41.2 && d.excludedCount === 18, JSON.stringify(d))
check('Discovery formats as 41%', formatScore(d) === '41%')

// Accuracy: 30 match, 6 mismatch, 4 unverifiable/cannot_evaluate
const fact = [
  row({ category: 'factual', claims: [...Array(30).fill(0).map(() => claim('match')), ...Array(6).fill(0).map(() => claim('mismatch'))] }),
  row({ category: 'factual', claims: [claim('unverifiable'), claim('unverifiable'), claim('cannot_evaluate'), claim('cannot_evaluate')] }),
]
const a = accuracyScore(fact)
check('Accuracy 30/(30+6) = 83.3%, 4 unverified excluded', a.numerator === 30 && a.denominator === 36 && a.percentage === 83.3 && a.excludedCount === 4, JSON.stringify(a))
check('Discovery rows never count toward accuracy (and vice versa)', accuracyScore(disc).denominator === 0 && discoveryScore(fact).denominator === 0)

// Zero denominators
const z = accuracyScore([row({ category: 'factual', claims: [claim('unverifiable')] })])
check('0 verified claims → percentage null, “Not enough verified data”, never 0%', z.percentage === null && formatScore(z) === 'Not enough verified data')

// Snapshot scope: subset recomputes everything
const input = {
  brandId: 'org', brandName: 'Brand', totalLocations: 150, auditId: 'aud', auditTitle: 'Check', auditedAt: '2026-10-24T06:00:00Z', surfaceLabel: 'Demo', simulated: true,
  locations: [{ id: 'a', name: 'Centre A', neighborhood: 'A', city: 'X' }, { id: 'b', name: 'Centre B', neighborhood: 'B', city: 'X' }],
  questionTemplates: [{ id: 'p1', template: 'q', category: 'discovery' }],
  rows: [row({ locationId: 'a', eligibility: 'eligible', mentioned: true }), row({ locationId: 'b', eligibility: 'eligible', mentioned: false }), row({ locationId: 'b', eligibility: 'eligible', mentioned: false })],
  flagged: [],
}
const all = buildReportSnapshot(input)
const onlyB = buildReportSnapshot(input, ['b'])
check('Full scope: 1 of 3', all.discovery.numerator === 1 && all.discovery.denominator === 3 && !all.partialScope)
check('Subset recomputes (B only: 0 of 2), no global reuse', onlyB.discovery.numerator === 0 && onlyB.discovery.denominator === 2 && onlyB.partialScope && onlyB.locationScores.length === 1 && onlyB.sampledAnswers === 2)
check('Same input → identical snapshot (deterministic)', JSON.stringify(buildReportSnapshot(input)) === JSON.stringify(all))
check('Per-centre table covers every scoped centre once', all.locationScores.map((l) => l.locationId).join() === 'a,b')

console.log(`\n${passed} passed, ${failures.length} failed`)
process.exit(failures.length ? 1 : 0)
