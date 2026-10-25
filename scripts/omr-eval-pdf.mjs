// Runs the OMR pipeline on pages of a PDF inside headless Chromium (pdfjs + the TypeScript sources served by a throwaway Vite server).
// Usage: node scripts/omr-eval-pdf.mjs <file.pdf> [pages, e.g. 1,5] [--staff N] [--truth file.json] [--out prefix]
// OMR_QUERY="width=1400" forces the render width, OMR_QUERY="memory=4" plays a phone with 4 GB (phone width cap).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PAGE_URL_PATH = '/scripts/omr-eval-pdf/page.html'

const args = process.argv.slice(2)
const option = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args.splice(index, 2)[1] : undefined
}
const staffIndex = Number(option('--staff') ?? 0)
const truthPath = option('--truth')
const outPrefix = option('--out')
const [pdfPath, pagesArgument = '1'] = args
if (!pdfPath) {
  console.error('usage: node scripts/omr-eval-pdf.mjs <file.pdf> [pages] [--staff N] [--truth file.json] [--out prefix]')
  process.exit(1)
}
const pages = pagesArgument.split(',').map(Number)
const truth = truthPath ? JSON.parse(readFileSync(truthPath, 'utf8')).notes : null
const prefix = outPrefix ?? join(ROOT, 'scratch', `omr-eval-${basename(pdfPath, '.pdf')}`)
mkdirSync(join(ROOT, 'scratch'), { recursive: true })

const server = await createServer({
  root: ROOT,
  configFile: join(ROOT, 'vite.config.ts'),
  logLevel: 'error',
  server: { port: 0, strictPort: false, hmr: false },
  optimizeDeps: { noDiscovery: true },
})
await server.listen()
const origin = server.resolvedUrls.local[0].replace(/\/$/, '')
const browser = await chromium.launch()

try {
  const page = await (await browser.newContext()).newPage()
  const hmrNoise = /WebSocket|Vite server|\[vite\]/
  page.on('pageerror', (error) => !hmrNoise.test(error.message) && console.error('page error:', error.message))
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type()) && !hmrNoise.test(message.text())) console.error(`console ${message.type()}:`, message.text())
  })
  await page.goto(origin + PAGE_URL_PATH + (process.env.OMR_QUERY ? `?${process.env.OMR_QUERY}` : ''))
  await page.waitForFunction(() => typeof window.evalPage === 'function')
  const base64 = readFileSync(pdfPath).toString('base64')
  for (const pageNumber of pages) {
    const { overlay, raster, notes, ...report } = await page.evaluate(
      ([data, number, staff, expected]) => window.evalPage(data, number, staff, expected),
      [base64, pageNumber, staffIndex, truth],
    )
    const outPath = `${prefix}-p${pageNumber}.png`
    writeFileSync(outPath, Buffer.from(overlay.split(',')[1], 'base64'))
    writeFileSync(`${prefix}-p${pageNumber}-raster.png`, Buffer.from(raster.split(',')[1], 'base64'))
    console.log(`--- ${basename(pdfPath)} page ${pageNumber}/${report.pageCount} (${report.width}x${report.height}) -> ${outPath}`)
    console.log(JSON.stringify(report, null, 1))
    console.log(`notes (${notes.length}): ${notes.join(' ')}`)
  }
} finally {
  await browser.close()
  await server.close()
}
