// Serves dist/ under /solfege-hero/ and checks, in a real browser, that any html served at any path boots:
// stale-fallback case (home html served at /daily/), cold loads, and offline reload. Run after `npm run build`.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const BASE = '/solfege-hero/'
const DIST = fileURLToPath(new URL('../dist/', import.meta.url))
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' }
// Paths where the server answers with the home html, like a stale worker or a host fallback would.
const HOME_AT = new Set([`${BASE}daily/`])
let staleMode = false

const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://x').pathname
  if (!path.startsWith(BASE)) return void response.writeHead(404).end()
  let rel = path.slice(BASE.length)
  if (staleMode && HOME_AT.has(path)) rel = 'index.html'
  else if (rel === '' || rel.endsWith('/')) rel += 'index.html'
  try {
    const body = await readFile(join(DIST, normalize(rel)))
    response.writeHead(200, { 'Content-Type': TYPES[extname(rel)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(body)
  } catch {
    response.writeHead(404).end('not found')
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`

const TODAY = new Date().toISOString().slice(0, 10).replaceAll('-', '')
const SETTINGS =JSON.stringify({ onboarded: true, muted: true })
const results = []
function check(name, ok, detail = '') {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`)
}

const browser = await chromium.launch({ channel: 'chrome' })
async function open() {
  const context = await browser.newContext({ serviceWorkers: 'allow' })
  await context.addInitScript((settings) => localStorage.setItem('solfege.settings.v2', settings), SETTINGS)
  const page = await context.newPage()
  const failed = []
  page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`))
  return { context, page, failed }
}
const ready = async (page) => {
  try {
    await page.waitForSelector('#app .app', { state: 'attached', timeout: 8000 })
  } catch (error) {
    console.log(page.url(), (await page.evaluate(() => document.body.innerHTML)).slice(0, 500))
    throw error
  }
}

try {
  // (a) register the worker on the home, wait for control
  const { context, page, failed } = await open()
  await page.goto(`${origin}${BASE}`)
  await ready(page)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 8000 })
  const reg = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration()
    return { script: r?.active?.scriptURL, scope: r?.scope }
  })
  check('home boots, worker registered with absolute script and scope', reg.script === `${origin}${BASE}sw.js` && reg.scope === `${origin}${BASE}`, JSON.stringify(reg))
  check('home has no failed request', failed.length === 0, failed.join(' '))

  // (d) offline reload of learn/ after one visit
  await page.goto(`${origin}${BASE}learn/`)
  await ready(page)
  await context.setOffline(true)
  await page.reload()
  await ready(page)
  check('learn/ reloads offline', (await page.locator('.learn-start').count()) > 0)
  await context.setOffline(false)
  await context.close()

  // (b) stale case: home html served at /daily/
  staleMode = true
  const stale = await open()
  await stale.page.goto(`${origin}${BASE}daily/#daily=${TODAY}`)
  await ready(stale.page)
  await stale.page.waitForSelector('.challenge-intro', { timeout: 8000 })
  check('home html served at /daily/ boots and shows the daily intro', true)
  check('stale case has no failed request', stale.failed.length === 0, stale.failed.join(' '))
  // the worker it registers is the root one
  await stale.page.waitForFunction(() => navigator.serviceWorker.getRegistration().then((r) => Boolean(r?.active)), null, { timeout: 8000 })
  const scope = await stale.page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope)
  check('stale page registers the root-scope worker', scope === `${origin}${BASE}`, String(scope))
  await stale.context.close()
  staleMode = false

  // (b2) with the root worker installed, an unknown nested path falls back to a booting index.html
  const nested = await open()
  await nested.page.goto(`${origin}${BASE}`)
  await ready(nested.page)
  await nested.page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 8000 })
  await nested.page.goto(`${origin}${BASE}daily/#daily=${TODAY}`)
  await nested.page.waitForSelector('.challenge-intro', { timeout: 8000 })
  check('daily/ cold link with the worker installed shows the intro', true)
  await nested.context.close()

  // (c) challenge and scores cold loads
  const cold = await open()
  await cold.page.goto(`${origin}${BASE}challenge/#s=4821&c=sol-fa&k=1&v=2&t=47`)
  await cold.page.waitForSelector('.challenge-intro', { timeout: 8000 })
  check('challenge/#s=… cold load shows the intro', true)
  await cold.page.goto(`${origin}${BASE}scores/`)
  await cold.page.waitForSelector('.library', { timeout: 8000 })
  check('scores/ cold load shows the library', true)
  check('cold loads have no failed request', cold.failed.length === 0, cold.failed.join(' '))
  await cold.context.close()
} catch (error) {
  check('script ran to the end', false, String(error))
} finally {
  await browser.close()
  server.close()
}
process.exit(results.every(Boolean) ? 0 : 1)
