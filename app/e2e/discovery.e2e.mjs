// End-to-end walkthrough of the Discoverability + Accuracy journeys (headless Chrome via CDP).
// Usage: dev server on :5173, then `node e2e/discovery.e2e.mjs`. No external network calls.
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5173'
const KEY = 'promanage-ai-visibility-demo'
const SHOTS = process.env.SHOTS
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const prof = mkdtempSync(join(tmpdir(), 'pm-e2e-'))
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9334', `--user-data-dir=${prof}`, '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 60; i++) {
  try { targets = await (await fetch('http://127.0.0.1:9334/json/list')).json(); if (targets.find((t) => t.type === 'page')) break } catch {}
  await sleep(200)
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let seq = 0
const pending = new Map()
const consoleErrors = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(' '))
})
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++seq; pending.set(i, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval error'); return r.result.value }
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })

let passed = 0
const failures = []
const check = (name, ok, detail = '') => { if (ok) { passed++; console.log(`  ✓ ${name}`) } else { failures.push(`${name} ${detail}`); console.log(`  ✗ ${name} ${detail}`) } }
const step = (t) => console.log(`\n▸ ${t}`)

const go = async (path) => { await send('Page.navigate', { url: ORIGIN + path }); await sleep(900) }
const text = () => ev('document.querySelector("main")?.innerText ?? document.body.innerText')
const bodyText = () => ev('document.body.innerText')
const has = async (s) => (await bodyText()).includes(s)
const state = () => ev(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}))`)
const patch = async (fn) => { await ev(`(() => { const s = JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})); (${fn})(s); localStorage.setItem(${JSON.stringify(KEY)}, JSON.stringify(s)) })()`); }
const role = (r) => patch(`(s) => { s.role = '${r}' }`)
const release = (r) => patch(`(s) => { s.release = '${r}' }`)
/** Click the first visible enabled button/link/label whose text includes `t` (scoped to an optional container selector). */
const click = async (t, { within, exact = false, nth = 0 } = {}) => {
  const ok = await ev(`(() => {
    const root = ${within ? `document.querySelector(${JSON.stringify(within)})` : 'document'}
    if (!root) return 'no-root'
    const els = [...root.querySelectorAll('button, a, [role=radio], [role=tab], label')].filter((e) => e.offsetParent !== null && !e.disabled)
    const want = ${JSON.stringify(t)}
    const m = els.filter((e) => ${exact ? 'e.innerText.trim() === want' : 'e.innerText.trim().includes(want)'})
    const el = m[${nth}]
    if (!el) return 'missing'
    el.scrollIntoView({ block: 'center' }); el.click(); return 'ok'
  })()`)
  await sleep(450)
  if (ok !== 'ok') throw new Error(`click "${t}": ${ok}`)
}
const tryClick = async (t, o) => { try { await click(t, o); return true } catch { return false } }
const typeInto = async (selector, value) => {
  await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await sleep(150)
}
const shot = async (name) => {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.data, 'base64'))
}

const AUDIT = { id: 'aud-001', name: 'Bengaluru pilot — first check', createdAt: '2026-10-21T07:24:37.480Z', createdBy: 'brand', locationIds: ['whitefield', 'hsr-layout', 'koramangala', 'indiranagar', 'sarjapur', 'jayanagar', 'bellandur', 'brookefield', 'electronic-city', 'marathahalli'], promptIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'], surface: 'AI search · Surface A', status: 'complete', mode: 'self-serve', simulated: true }
const fresh = { version: 7, release: 'MVP', role: 'brand', onboardingDismissed: true, audits: [AUDIT], customPrompts: [], reviews: {}, tasks: [], rechecks: [], monitoring: { enabled: false, day: 'Monday', cohortAuditId: 'aud-001' }, ackedAlerts: [], notifyRequests: [], activity: [], factEdits: {}, assets: {}, showSimLabels: false, discoveryEligibility: {}, discovery: {}, dispositions: {}, sourceUpdates: {}, investigations: {}, plans: {}, checkRequests: [] }
const WF = 'disc-aud-001-whitefield'

try {
  await go('/')
  await ev(`localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify(fresh))})`)

  step('MVP · Brand · discovery observation (UC-D1)')
  await go('/overview')
  check('Overview shows separate discovery card', await has('Being found in AI search') && await has('Selected searches where your centres weren’t mentioned'))
  check('Raw non-mentions are counted from the 50 unbranded observations', /\d+ of 50/.test(await text()))
  check('Accuracy items still listed', await has('What needs your attention'))
  await shot('01-brand-overview-mvp')
  await go(`/attention/discovery/${WF}`)
  check('Whitefield page shows exact sampled question', await has('Play-based Montessori preschool options in Whitefield'))
  check('Non-mention caveat shown', await has('Not mentioned isn’t necessarily an error'))
  check('Not counted as a factual mismatch', !(await has('Confirmed incorrect information')))
  check('Montessori needs Brand confirmation first', await has('Confirm: we offer Montessori programme'))
  await click('Confirm: we offer Montessori programme')
  check('Service confirmed → Montessori search now eligible', (await state()).factEdits['whitefield:programs']?.status === 'verified')
  await click('Worth investigating')
  check('MVP: saved as worth investigating', await has('Worth investigating — saved for ProManage'))
  await shot('02-brand-whitefield-mvp')

  step('MVP · negative control (UC-D2)')
  await go('/attention/discovery/disc-aud-001-electronic-city')
  check('Electronic City Saturday-tours search awaits relevance review', await has('Your record says “No Saturday tours (weekday visits only)”'))
  const before = (await state()).discoveryEligibility
  await click('Not relevant to this search')
  await click('Mark not relevant')
  const el = (await state()).discoveryEligibility
  check('Not relevant stored with reason, evidence retained', Object.keys(el).length === Object.keys(before).length + 1 && Object.values(el).some((x) => x.status === 'not_relevant' && x.reason === 'service_mismatch'))
  await go('/overview')
  check('Overview counts marked-not-relevant', /1 marked not relevant/.test(await text()))

  step('MVP · ProManage can review eligibility (Investigations → Discoverability)')
  await role('promanage')
  await go('/issues?tab=discovery')
  check('Discoverability tab available in MVP', await has('Eligible outlet mention rate') && await has('BrightNest Whitefield'))
  await go(`/discovery/${WF}`)
  check('MVP scope note (no readiness checks yet)', await has('MVP scope'))

  step('V1 · ProManage readiness checks + composer (UC-D3/D4/D6/D7)')
  await release('V1')
  await go(`/discovery/${WF}`)
  await click('Run readiness check')
  check('Findings shown with provenance', await has('Content & direct answers') && await has('Connected listing') && await has('Structured data'))
  check('Cause of non-mention stays unknown', await has('Cause of non-mention') && await has('Unknown'))
  check('Crawl/freshness needs site-owner confirmation', await has('Needs site-owner confirmation'))
  for (let i = 0; i < 4; i++) await click('Confirm gap', { exact: true })
  await click('Prepare improvement plan')
  check('Composer lists evidence-backed recommendations', await has('Recommendation composer') && await has('Add a factual Montessori summary'))
  check('Composer uses only verified claims', !(await has('not verified')))
  await click('Send to Brand for approval')
  check('Plan awaits Brand approval; ProManage cannot approve', (await state()).discovery[WF].plan.status === 'awaiting_brand_approval' && !(await has('Approve plan')))
  await shot('03-pm-whitefield-plan')

  step('V1 · No controllable gap → monitor only (UC-D8)')
  await go('/discovery/disc-aud-001-koramangala')
  await click('Run readiness check')
  check('No confirmable gaps for Koramangala', !(await tryClick('Confirm gap', { exact: true })))
  await click('No controllable gap — monitor only')
  await click('Monitor this query')
  check('Monitor-only recorded without a plan', (await state()).discovery['disc-aud-001-koramangala'].monitorOnly && !(await state()).discovery['disc-aud-001-koramangala'].plan)

  step('V1 · Indiranagar (persistent) + Jayanagar (inconclusive) + HSR plans')
  for (const loc of ['indiranagar', 'jayanagar', 'hsr-layout']) {
    await go(`/discovery/disc-aud-001-${loc}`)
    await click('Run readiness check')
    await click('Confirm gap', { exact: true })
    await click('Prepare improvement plan')
    await click('Send to Brand for approval')
    check(`${loc} plan sent`, (await state()).discovery[`disc-aud-001-${loc}`].plan?.status === 'awaiting_brand_approval')
  }

  step('V1 · Brand approves / requests changes / declines')
  await role('brand')
  await go('/overview')
  check('Overview CTA: review suggested improvements', await has('Review suggested improvements'))
  await go(`/attention/discovery/${WF}`)
  check('Plain current vs proposed, no JSON-LD code', await has('Current info') && await has('Proposed info') && !(await has('"@context"')) && !(await has('JSON-LD')))
  check('Technical item in plain language', await has('Technical information prepared by ProManage'))
  await shot('04-brand-whitefield-approval')
  await click('Approve plan')
  await click('Approve', { exact: true })
  const tasksAfter = (await state()).tasks.filter((t) => t.opportunityId === WF)
  check('Approval creates one task per non-technical recommendation (2 website, 1 listing)', tasksAfter.length === 3 && tasksAfter.filter((t) => t.channel === 'owned_website').length === 2, `got ${tasksAfter.length}`)
  check('JSON-LD attached to the website task (reused GEO Readiness asset)', tasksAfter.some((t) => t.assetKinds.includes('jsonld')))
  check('Original AI observation unchanged by approval', await (async () => { await go(`/attention/discovery/${WF}`); return has('Your centre wasn’t mentioned in this selected AI answer') })())
  await go('/attention/discovery/disc-aud-001-indiranagar'); await click('Approve plan'); await click('Approve', { exact: true })
  await go('/attention/discovery/disc-aud-001-jayanagar'); await click('Request changes'); await typeInto('textarea[aria-label="Comment"]', 'Please keep it shorter.'); await click('Send request')
  check('Changes requested recorded', (await state()).discovery['disc-aud-001-jayanagar'].plan.status === 'changes_requested')
  await go('/attention/discovery/disc-aud-001-hsr-layout'); await click('Decline', { exact: true }); await typeInto('textarea[aria-label="Comment"]', 'Fix the hours first.'); await click('Decline', { exact: true, nth: 1 })
  const s1 = await state()
  check('Declined plan creates no tasks', s1.discovery['disc-aud-001-hsr-layout'].plan.status === 'declined' && !s1.tasks.some((t) => t.opportunityId === 'disc-aud-001-hsr-layout'))
  check('Changes-requested plan creates no tasks', !s1.tasks.some((t) => t.opportunityId === 'disc-aud-001-jayanagar'))

  step('V1 · ProManage revises Jayanagar, Brand approves')
  await role('promanage')
  await go('/discovery/disc-aud-001-jayanagar')
  await click('Send to Brand for approval')
  await role('brand')
  await go('/attention/discovery/disc-aud-001-jayanagar'); await click('Approve plan'); await click('Approve', { exact: true })
  check('Jayanagar approved after revision', (await state()).discovery['disc-aud-001-jayanagar'].plan.status === 'approved')

  step('V1 · ProManage records simulated publication with evidence')
  await role('promanage')
  const discTasks = (await state()).tasks.filter((t) => t.opportunityId)
  for (const t of discTasks) {
    await go(`/tasks/${t.id}`)
    if (t.status === 'open') { await click('Start work') }
    await click(t.channel === 'external_request' ? 'Record request sent' : 'Record update (simulated)')
    await typeInto('#pub-evidence', `Recorded by test on 22 Oct for ${t.id} (simulated)`)
    await click('Record update', { exact: true })
  }
  const s2 = await state()
  check('All discovery tasks recorded with evidence', s2.tasks.filter((t) => t.opportunityId).every((t) => ['awaiting_recheck', 'source_updated'].includes(t.status) && t.evidence.some((e) => /evidence/i.test(e.label))))
  await go(`/geo-readiness/whitefield?tab=content`)
  check('GEO Readiness → Content improvements shows approved diff', await has('Improvement plan · round 1') && await has('Approved by Brand'))
  await go(`/attention/discovery/${WF}`)
  check('Brand redirect away from ProManage route', true)
  await role('brand')
  await go(`/attention/discovery/${WF}`)
  check('Brand sees “update recorded — waiting for next AI check”, not “fixed”', await has('waiting for the next AI check') && !(await has('Discoverability fixed')))

  step('V2 · matched recheck (UC-D9/D10, inconclusive)')
  await release('V2')
  await role('promanage')
  await go(`/discovery/${WF}`)
  await click('Run follow-up check')
  const wfText = await text()
  check('Whitefield: before/after counts from fixtures (3 of 5 → 5 of 5)', wfText.includes('3 of 5') && wfText.includes('5 of 5'), wfText.match(/Mentioned in .*follow-up \d/)?.[0])
  check('Causal caveat present', wfText.includes('not proof the updates caused it'))
  await shot('05-pm-whitefield-recheck')
  await go('/discovery/disc-aud-001-indiranagar')
  check('Indiranagar: still absent, honest next step offered', await has('Still absent') && await has('Start new investigation round'))
  await go('/discovery/disc-aud-001-jayanagar')
  check('Jayanagar: inconclusive, no before/after delta', await has('Inconclusive') && await has('city-wide location setting'))
  await go('/monitoring')
  check('Monitoring discovery cohort panel', await has('Discovery cohort · matched rechecks'))
  await go('/reports')
  check('Internal report has discoverability section', await has('Discoverability improvement') && await has('Eligible unbranded outlet mention rate'))

  step('V2 · Brand view of outcomes')
  await role('brand')
  await go(`/attention/discovery/${WF}`)
  check('Brand: mentioned in latest follow-up + caveat', await has('Mentioned in the latest follow-up AI check') && await has('not proof the updates caused it'))
  await go('/attention/discovery/disc-aud-001-indiranagar')
  check('Brand: still not mentioned, no red failure wording', await has('Still not mentioned in the selected searches') && await has('ProManage is reviewing next steps'))
  await go('/progress')
  check('Progress shows Accuracy/Discovery category tags', await has('Discovery') && await has('being found in AI search'))
  await shot('06-brand-progress')
  await go('/reports')
  check('Brand report: Discoverability checks with denominators', await has('Discoverability checks') && /mentioned in \d+ of \d+/.test(await text()))

  step('Accuracy journey still works and stays separate (HSR, UC-D11)')
  await go('/attention/issue-hsr-hours')
  check('HSR accuracy question intact', await has('Are the opening hours in your business record correct?'))
  await click('Yes, these are correct')
  await click('Confirm opening hours')
  await click('Confirm', { exact: true })
  check('HSR accuracy confirmed independently of discovery', (await state()).reviews['aud-001-hsr-layout-p7']?.status === 'confirmed' && (await state()).discovery['disc-aud-001-hsr-layout'].plan.status === 'declined')
  const nav = await ev('[...document.querySelectorAll("aside nav a")].map((a) => a.innerText.trim().split("\\n")[0])')
  check('Brand sidebar stays at five items', JSON.stringify(nav) === JSON.stringify(['Overview', 'My Locations', 'Needs My Attention', 'Progress', 'Reports']), JSON.stringify(nav))
} catch (e) {
  failures.push(`ABORTED: ${e.message}`)
  console.log(`  ✗ ABORTED: ${e.message}`)
  await shot('zz-failure')
}

check('No console errors or exceptions', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
console.log(`\n${passed} passed, ${failures.length} failed`)
ws.close()
chrome.kill()
process.exit(failures.length ? 1 : 0)
