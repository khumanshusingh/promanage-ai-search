// PRD v9 · MVP Executive AI Visibility Report: real PDF downloads from Detect.
// Usage: dev server on :5173, then `node e2e/report.e2e.mjs` (REPORT_DIR=<dir> keeps the PDFs).
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { start, sleep } from './harness.mjs'

const DIR = process.env.REPORT_DIR ?? mkdtempSync(join(tmpdir(), 'pm-reports-'))
const t = await start({ port: 9349 })
const { check, step, go, click, has, ev, exists, send, state } = t
await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DIR })
const pdfs = () => readdirSync(DIR).filter((f) => f.endsWith('.pdf'))
const waitFor = async (n, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (pdfs().length >= n && !readdirSync(DIR).some((f) => f.endsWith('.crdownload'))) return true; await sleep(200) } return false }
const pageCount = (buf) => (buf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length
const isPdf = (buf) => buf.subarray(0, 5).toString() === '%PDF-' && buf.toString('latin1').trimEnd().endsWith('%%EOF')

try {
  step('UC-01 · No completed check: no fake report')
  await go('/'); await t.clearState(); await go('/detect'); await sleep(700)
  check('No download action before a check', !(await exists('Download AI Visibility Report (PDF)')))
  check('Landing offers only the check (report comes after)', await exists('Run AI Visibility Check'))

  step('UC-02 · Default pilot check → executive PDF (MVP only, no V1/V2 use)')
  await click('Run AI Visibility Check'); await click('Start check'); await sleep(6000)
  const s0 = await state()
  check('Report CTA shown after the check', (await has('Your AI visibility report is ready.')) && (await exists('Download AI Visibility Report (PDF)')) && (await exists('Review suggested improvements')))
  const dash = await ev(`(() => { const t = document.querySelector('main').innerText; return { rate: t.match(/Eligible mention rate[\\s\\S]*?(\\d+)%/i)?.[1], of: t.match(/(\\d+) of (\\d+) eligible/)?.slice(1, 3), acc: t.match(/verified fact match rate (\\d+)% \\((\\d+)\\/(\\d+)\\)/)?.slice(1, 4) } })()`)
  check('Dashboard shows the shared scores', dash.rate === '41' && dash.of?.join('/') === '14/34' && dash.acc?.join('/') === '83/30/36', JSON.stringify(dash))
  await click('Download AI Visibility Report (PDF)')
  await sleep(400)
  check('Dialog shows exact scope (brand, centres, questions, answers, surface)', (await has('Download AI Visibility Report')) && (await has('10 centres · 8 questions per centre · 80 sampled answers')) && (await has('Demo AI search (Surface A)')) && (await has('Includes simulated audit data')))
  check('Dialog scores match the dashboard', (await has('Discoverability 41% (14 of 34)')) && (await has('Information accuracy 83% (30 of 36 verified claims)')))
  await click('Download PDF')
  check('Executive PDF downloaded', await waitFor(1))
  const exec = pdfs().find((f) => f.endsWith('_Executive.pdf'))
  const execBuf = exec ? readFileSync(join(DIR, exec)) : Buffer.alloc(0)
  check('File is a valid PDF with a meaningful name', !!exec && isPdf(execBuf) && /^ProManage_AI_Visibility_BrightNest-Preschools_\d{4}-\d{2}-\d{2}_aud-\d+_Executive\.pdf$/.test(exec), exec)
  check('Executive edition is 2 pages for the 10-centre pilot', pageCount(execBuf) === 2, String(pageCount(execBuf)))
  check('Success state with page count and soft Explore Improve link', (await has('PDF downloaded · 2 pages')) && (await has('Want to address the findings? Explore Improve')))

  step('UC-03 · Detailed edition')
  await click('Detailed report')
  await click('Download PDF')
  check('Detailed PDF downloaded', await waitFor(2))
  const det = pdfs().find((f) => f.endsWith('_Detailed.pdf'))
  const detBuf = det ? readFileSync(join(DIR, det)) : Buffer.alloc(0)
  check('Detailed edition is a valid multi-page PDF', !!det && isPdf(detBuf) && pageCount(detBuf) > 4, String(pageCount(detBuf)))

  step('UC-04 · Subset of centres recomputes the report')
  await ev(`document.querySelector('details summary')?.click()`)
  await sleep(200)
  for (const n of ['HSR Layout', 'Koramangala', 'Indiranagar', 'Sarjapur', 'Jayanagar', 'Bellandur', 'Brookefield', 'Electronic City']) await click(`Include BrightNest ${n}`)
  check('Scope shows 2 of 10 centres and recalculated figures', (await has('Centres included · 2 of 10')) && (await has('2 centres · 8 questions per centre · 16 sampled answers')))
  await click('Executive summary')
  await click('Download PDF')
  check('Subset PDF downloaded with a scoped name', await waitFor(3) && pdfs().some((f) => f.includes('_2-centres_Executive')))

  step('UC-10 · Rapid clicks give one download; failure then retry')
  const done = async () => (await state()).activity.filter((a) => a.text.startsWith('executive_report_download_completed')).length
  const latest = () => Math.max(...pdfs().map((f) => statSync(join(DIR, f)).mtimeMs))
  const before = await done()
  const t0 = latest()
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /Download again|Download PDF/.test(x.innerText)); b.click(); b.click(); b.click() })()`)
  await sleep(2500)
  check('Triple click produced exactly one download', (await done()) === before + 1 && latest() > t0, `${before} → ${await done()}`)
  await ev('window.__pmFailNextReport = true')
  await click('Download again')
  await sleep(500)
  check('Failure shows an actionable message, results kept', (await has('The PDF couldn’t be generated. Your check and results are unchanged.')) && (await exists('Retry')))
  const t1 = latest()
  await click('Retry')
  await sleep(2000)
  check('Retry succeeds', (await done()) === before + 2 && latest() > t1 && (await has('PDF downloaded')))

  step('No data changes; V2 stays user-triggered')
  const s1 = await state()
  check('Report export changed no audits, approvals, publications or follow-ups', JSON.stringify(s1.audits) === JSON.stringify(s0.audits) && !(s1.approvals?.length) && !(s1.publications?.length) && !(s1.rechecks?.length))
  check('Export events logged locally (no personal data)', ['executive_report_export_started', 'executive_report_download_completed', 'executive_report_export_failed', 'report_edition_selected'].every((e) => s1.activity.some((a) => a.text.startsWith(e))))
  await click('Want to address the findings? Explore Improve')
  await sleep(1200)
  const s2 = await state()
  check('Explore Improve opens 02 Improve without approving anything', (await t.path()) === '/improve' && !(s2.approvals?.length) && !(s2.publications?.length))

  step('UC-12/13 · Refresh and re-download give the same contents')
  await go('/detect'); await t.reload(); await sleep(800)
  await click('Download AI Visibility Report (PDF)'); await sleep(300)
  const n0 = pdfs().length
  await click('Download PDF')
  await waitFor(n0 + 1)
  const newest = pdfs().map((f) => ({ f, m: statSync(join(DIR, f)).mtimeMs })).sort((a, b) => b.m - a.m)[0].f
  check('After refresh the executive report is still 2 pages', pageCount(readFileSync(join(DIR, newest))) === 2)

  step('Mobile')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await go('/detect'); await sleep(800)
  check('Mobile: report CTA visible, no horizontal overflow', (await exists('Download AI Visibility Report (PDF)')) && (await ev('document.documentElement.scrollWidth')) <= 392)
} catch (e) {
  check(`ABORTED: ${e.message}`, false)
}
console.log(`\nPDFs in ${DIR}`)
t.finish()
