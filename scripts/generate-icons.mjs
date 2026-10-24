import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const publicDir = new URL('../public/', import.meta.url)
const rounded = await readFile(new URL('favicon.svg', publicDir), 'utf8')
// Launchers and iOS apply their own mask, so these variants must fill the whole square.
const fullBleed = rounded.replace(/ rx="\d+"/, '')

const targets = [
  { file: 'pwa-192.png', size: 192, svg: rounded },
  { file: 'pwa-512.png', size: 512, svg: rounded },
  { file: 'pwa-maskable-512.png', size: 512, svg: fullBleed },
  { file: 'apple-touch-icon.png', size: 180, svg: fullBleed },
]

const browser = await chromium.launch({ channel: 'chrome' })

for (const { file, size, svg } of targets) {
  // A fresh page per size: resizing a reused page's viewport intermittently captured a stale, torn frame.
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(`<style>html, body { margin: 0 } svg { display: block; width: ${size}px; height: ${size}px }</style>${svg}`)
  await page.screenshot({ path: fileURLToPath(new URL(file, publicDir)), omitBackground: true })
  await page.close()
  console.log(`${file} ${size}x${size}`)
}

await browser.close()
