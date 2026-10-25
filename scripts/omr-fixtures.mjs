import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const FIXTURES_DIR = join(ROOT, 'src/omr/fixtures')
const PDF_PATH = join(ROOT, 'scratch/omr-print.pdf')
const FFMPEG = '/opt/homebrew/bin/ffmpeg'
const PAGE_URL_PATH = '/scripts/omr-fixtures/page.html'
const DEVICE_SCALE = 1.4
const PAGE_WIDTH = 1600
const PDF_SYSTEMS_PER_PAGE = 3
const PDF_MELODY = 'Ode à la joie'

const FIXTURES = [
  { name: 'Frère Jacques', slug: 'frere-jacques' },
  { name: 'Frère Jacques (clé de fa)', slug: 'frere-jacques-fa' },
  { name: 'Ode à la joie', slug: 'ode-a-la-joie' },
  { name: 'À la claire fontaine', slug: 'claire-fontaine' },
  { name: 'Menuet en sol (Bach)', slug: 'menuet-en-sol', degraded: true },
  { name: 'Greensleeves', slug: 'greensleeves' },
  { name: 'Lettre à Élise (Beethoven)', slug: 'lettre-a-elise' },
  { name: 'Amazing Grace', slug: 'amazing-grace', degraded: true },
]

function toGrayscale(path) {
  if (!existsSync(FFMPEG)) return
  const temporary = `${path}.gray.png`
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', path, '-pix_fmt', 'gray', '-compression_level', '9', temporary])
  renameSync(temporary, path)
}

function writeDataUrl(path, dataUrl) {
  writeFileSync(path, Buffer.from(dataUrl.split(',')[1], 'base64'))
}

mkdirSync(FIXTURES_DIR, { recursive: true })
mkdirSync(join(ROOT, 'scratch'), { recursive: true })

const server = await createServer({
  root: ROOT,
  configFile: false,
  logLevel: 'error',
  server: { port: 5290, strictPort: false, hmr: false },
  optimizeDeps: { noDiscovery: true },
})
await server.listen()
const origin = server.resolvedUrls.local[0].replace(/\/$/, '')
const browser = await chromium.launch()

try {
  const context = await browser.newContext({ viewport: { width: PAGE_WIDTH, height: 800 }, deviceScaleFactor: DEVICE_SCALE })
  const page = await context.newPage()
  page.on('pageerror', (error) => console.error('page error:', error.message))
  await page.goto(origin + PAGE_URL_PATH)
  await page.waitForFunction(() => typeof window.showFixture === 'function')

  for (const { name, slug, degraded } of FIXTURES) {
    const { truth, height } = await page.evaluate((melodyName) => window.showFixture(melodyName), name)
    await page.setViewportSize({ width: PAGE_WIDTH, height: Math.ceil(height) })
    const pngPath = join(FIXTURES_DIR, `${slug}.png`)
    const screenshot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: PAGE_WIDTH, height: Math.ceil(height) } })
    writeFileSync(pngPath, screenshot)
    writeFileSync(join(FIXTURES_DIR, `${slug}.json`), `${JSON.stringify(truth, null, 2)}\n`)
    toGrayscale(pngPath)
    if (degraded) {
      const dataUrl = await page.evaluate((source) => window.degrade(source), `data:image/png;base64,${readFileSync(pngPath).toString('base64')}`)
      const degradedPath = join(FIXTURES_DIR, `${slug}-degraded.png`)
      writeDataUrl(degradedPath, dataUrl)
      toGrayscale(degradedPath)
      writeFileSync(join(FIXTURES_DIR, `${slug}-degraded.json`), `${JSON.stringify({ ...truth, truthOf: slug }, null, 2)}\n`)
    }
    console.log(`${slug}: ${truth.notes.length} notes`)
  }

  const { truth, pageHeight } = await page.evaluate(
    ([melodyName, perPage]) => window.showFixture(melodyName, perPage),
    [PDF_MELODY, PDF_SYSTEMS_PER_PAGE],
  )
  await page.pdf({ path: PDF_PATH, width: `${PAGE_WIDTH}px`, height: `${pageHeight}px`, printBackground: true })
  writeFileSync(join(ROOT, 'scratch/omr-print.json'), `${JSON.stringify(truth, null, 2)}\n`)
  console.log(`pdf: ${PDF_PATH}`)
} finally {
  await browser.close()
  await server.close()
}
