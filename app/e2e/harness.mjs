// Minimal headless-Chrome (CDP) harness shared by the e2e walkthroughs. No external network calls.
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const KEY = 'promanage-ai-visibility-demo'
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5173'
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function start({ port = 9335, width = 1440, height = 1000 } = {}) {
  const prof = mkdtempSync(join(tmpdir(), 'pm-e2e-'))
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
  let targets
  for (let i = 0; i < 60; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.find((t) => t.type === 'page')) break } catch {}
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
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })

  let passed = 0
  const failures = []
  const api = {
    send, ev, consoleErrors, failures,
    get passed() { return passed },
    check: (name, ok, detail = '') => { if (ok) { passed++; console.log(`  ✓ ${name}`) } else { failures.push(`${name} ${detail}`); console.log(`  ✗ ${name} ${detail}`) } },
    step: (t) => console.log(`\n▸ ${t}`),
    go: async (path) => { await send('Page.navigate', { url: ORIGIN + path }); await sleep(900) },
    reload: async () => { await send('Page.reload'); await sleep(1000) },
    back: async () => { await ev('history.back()'); await sleep(700) },
    text: () => ev('document.querySelector("main")?.innerText ?? document.body.innerText'),
    bodyText: () => ev('document.body.innerText'),
    has: async (s) => (await ev('document.body.innerText')).includes(s),
    path: () => ev('location.pathname'),
    state: () => ev(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}))`),
    setState: (obj) => ev(`localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify(obj))})`),
    clearState: () => ev(`localStorage.removeItem(${JSON.stringify(KEY)})`),
    /** Click the first visible enabled control whose text includes (or equals) `t`. */
    click: async (t, { exact = false, nth = 0, within } = {}) => {
      const ok = await ev(`(() => {
        const root = ${within ? `document.querySelector(${JSON.stringify(within)})` : 'document'}
        if (!root) return 'no-root'
        const els = [...root.querySelectorAll('button, a, [role=radio], [role=tab], [role=checkbox], label')].filter((e) => e.offsetParent !== null && !e.disabled && e.getAttribute('aria-disabled') !== 'true')
        const want = ${JSON.stringify(t)}
        const txt = (e) => e.innerText.replace(/\\s+/g, ' ').trim()
        const m = els.filter((e) => ${exact ? 'txt(e) === want' : 'txt(e).includes(want) || e.getAttribute("aria-label") === want'})
        const el = m[${nth}]
        if (!el) return 'missing'
        el.scrollIntoView({ block: 'center' }); el.click(); return 'ok'
      })()`)
      await sleep(450)
      if (ok !== 'ok') throw new Error(`click "${t}": ${ok}`)
    },
    exists: (t) => ev(`[...document.querySelectorAll('button, a')].some((e) => e.offsetParent !== null && e.innerText.trim().includes(${JSON.stringify(t)}))`),
    type: async (selector, value) => {
      await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })) })()`)
      await sleep(150)
    },
    shot: async (dir, name) => {
      if (!dir) return
      mkdirSync(dir, { recursive: true })
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      writeFileSync(join(dir, `${name}.png`), Buffer.from(r.data, 'base64'))
    },
    finish: () => {
      api.check('No console errors or exceptions', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
      console.log(`\n${passed} passed, ${failures.length} failed`)
      ws.close()
      chrome.kill()
      process.exit(failures.length ? 1 : 0)
    },
  }
  return api
}
