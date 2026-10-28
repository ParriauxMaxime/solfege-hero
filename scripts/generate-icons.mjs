import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

import { DARK_COLORS, litStaff, litStem } from '../src/brand/art.ts'
import { fxDefs, hotHeadMarkup, hotNoteStatic } from '../src/brand/streakFx.ts'

const publicDir = new URL('../public/', import.meta.url)

const tile = 512
const tileRadius = 112
const background = '#15100c'
const staffInk = '#f4e9dc'
const stemInk = '#fffbe6'

// `scale` maps the note-local units of streakFx (head rx about 10.5) to tile pixels: the hot head is drawn at rx / scale.
const layouts = {
  detailed: { lines: [236, 288, 340, 392, 444], lineWidth: 10, lineOpacity: 0.4, head: { rx: 66, ry: 47 }, headX: 236, headY: 340, stemWidth: 18, stemTop: 150, scale: 6.3, intensity: 1, detail: 'full', litOpacity: 0.3 },
  simplified: { lines: [190, 290, 390], lineWidth: 24, lineOpacity: 0.5, head: { rx: 104, ry: 74 }, headX: 236, headY: 330, stemWidth: 30, stemTop: 96, scale: 6.6, intensity: 0.8, detail: 'small', litOpacity: 0.3 },
}

const iconSvg = ({ layout, rounded }) => {
  const { lines, lineWidth, lineOpacity, head, headX, headY, stemWidth, stemTop, scale, intensity, detail, litOpacity } = layouts[layout]
  const id = 'ic'
  const litLines = lines.filter((y) => y <= headY + 4)
  const hot = { shape: 'filled', rx: head.rx / scale, ry: head.ry / scale, rim: stemInk }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tile} ${tile}">
${fxDefs(id, { gold: DARK_COLORS.gold, smoke: '#b8b2ac' })}
<clipPath id="${id}-tile"><rect width="${tile}" height="${tile}"${rounded ? ` rx="${tileRadius}"` : ''}/></clipPath>
<g clip-path="url(#${id}-tile)">
<rect width="${tile}" height="${tile}" fill="${background}"/>
<g stroke="${staffInk}" stroke-opacity="${lineOpacity}" stroke-width="${lineWidth}" stroke-linecap="round">${lines.map((y) => `<path d="M-10 ${y}H${tile + 10}"/>`).join('')}</g>
${litStaff(id, { x: headX, reach: 180, lines: litLines, width: lineWidth, opacity: litOpacity })}
<g transform="translate(${headX} ${headY})">
<g transform="scale(${scale})">${hotNoteStatic(id, { ...hot, intensity, detail })}</g>
${litStem({ x: head.rx * 0.85, y1: -head.ry * 0.2, y2: stemTop - headY, width: stemWidth, color: stemInk })}
<g transform="scale(${scale})">${hotHeadMarkup(id, 'filled', { ...hot, heat: 1 })}</g>
</g>
</g>
</svg>
`
}

const rounded = iconSvg({ layout: 'detailed', rounded: true })
const fullBleed = iconSvg({ layout: 'detailed', rounded: false })
const small = iconSvg({ layout: 'simplified', rounded: true })

await writeFile(new URL('favicon.svg', publicDir), small)

const targets = [
  { file: 'pwa-192.png', size: 192, svg: rounded },
  { file: 'pwa-512.png', size: 512, svg: rounded },
  // Launchers and iOS apply their own mask, so these variants fill the whole square.
  { file: 'pwa-maskable-512.png', size: 512, svg: fullBleed },
  { file: 'apple-touch-icon.png', size: 180, svg: fullBleed },
  { file: 'favicon-48.png', size: 48, svg: small },
  { file: 'favicon-32.png', size: 32, svg: small },
  { file: 'favicon-16.png', size: 16, svg: small },
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
