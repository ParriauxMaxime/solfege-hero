import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { BRAND_HEAD_RX, BRAND_HEAD_RY, DARK_COLORS, NOTE_TILT, litStaff, litStem } from '../src/brand/art.ts'
import { fxDefs, hotHeadMarkup, hotNoteStatic } from '../src/brand/streakFx.ts'

const outDir = new URL('../public/og/', import.meta.url)
const maxBytes = 150 * 1024

const pages = [
  { file: 'og.png', accent: ['#f97316', '#c2410c'], title: 'Solfège hero', subtitle: 'Apprendre à lire les notes' },
  { file: 'og-learn.png', accent: ['#f59e0b', '#b45309'], title: 'Apprendre', subtitle: 'Une note à la fois, tirage adaptatif' },
  { file: 'og-keys.png', accent: ['#dd7a33', '#a3472b'], title: 'Armures', subtitle: 'Reconnaître la tonalité d’une armure' },
  { file: 'og-series.png', accent: ['#fbbf24', '#d97706'], title: 'Séries', subtitle: '20 notes chronométrées, +5 s par erreur' },
  { file: 'og-scores.png', accent: ['#e8a04a', '#b8742a'], title: 'Partitions', subtitle: 'Une bibliothèque MusicXML à jouer' },
  { file: 'og-defi.png', accent: ['#ef6c3a', '#b83a1c'], title: 'Un ami te défie', subtitle: '20 notes, bats son temps' },
  { file: 'og-dictee.png', accent: ['#e5642f', '#9f2a22'], title: 'Défi Dictée', subtitle: '20 notes à l’oreille, bats le temps de ton ami' },
  { file: 'og-survie.png', accent: ['#e8602a', '#991b1b'], title: 'Défi Survie', subtitle: '3 vies, tiens plus longtemps que ton ami' },
  { file: 'og-hero.png', accent: ['#f97316', '#dc2626'], title: 'Défi Solfège hero', subtitle: '16 mesures en rythme, fais mieux que ton ami' },
  { file: 'og-jour.png', accent: ['#f5b83d', '#e8854a'], title: 'Défi du jour', subtitle: 'La même série pour tout le monde aujourd’hui' },
  { file: 'og-partition.png', accent: ['#e0873f', '#a8531f'], title: 'Une partition pour toi', subtitle: 'Ouvre-la et joue-la dans Solfège hero' },
]

// English variants (public/og/en/<same name>): same design, same accent, translated texts.
const english = {
  'og.png': { title: 'Solfège hero', subtitle: 'Learn to read music notes' },
  'og-learn.png': { title: 'Learn', subtitle: 'One note at a time, adaptive draw' },
  'og-keys.png': { title: 'Key signatures', subtitle: 'Recognise the key of a signature' },
  'og-series.png': { title: 'Series', subtitle: '20 timed notes, +5 s per mistake' },
  'og-scores.png': { title: 'Scores', subtitle: 'A MusicXML library to play' },
  'og-defi.png': { title: 'A friend challenges you', subtitle: '20 notes, beat their time' },
  'og-dictee.png': { title: 'Dictation challenge', subtitle: '20 notes by ear, beat your friend’s time' },
  'og-survie.png': { title: 'Survival challenge', subtitle: '3 lives, last longer than your friend' },
  'og-hero.png': { title: 'Solfège hero challenge', subtitle: '16 bars in rhythm, beat your friend' },
  'og-jour.png': { title: 'Daily challenge', subtitle: 'The same series for everyone today' },
  'og-partition.png': { title: 'A score for you', subtitle: 'Open it and play it in Solfège hero' },
}
const variants = [
  ...pages.map((page) => ({ ...page, out: page.file })),
  ...pages.map((page) => ({ ...page, ...english[page.file], out: `en/${page.file}` })),
]

const force = process.argv.includes('--force')
const pending = force ? variants : variants.filter((page) => !existsSync(new URL(page.out, outDir)))
if (pending.length === 0) {
  console.log('og images: all present, skipping (use --force to regenerate)')
  process.exit(0)
}

const brand = 'Solfège hero'
const staffLines = [92, 128, 164, 200, 236]
const middleLine = staffLines[2]
const staffSpace = 36
const textTop = 383

const background = '#15100c'
const ink = '#fffaf2'
const staffInk = '#f4e9dc'
const ember = '#f97316'
const accentHeadInk = '#ffd9b0'
const accentStemInk = '#f3dcc0'

const brandId = 'brand'
const brandHead = { rx: BRAND_HEAD_RX, ry: BRAND_HEAD_RY }
const brandStemWidth = 8
const brandLitReach = 110
// streakFx draws a head of rx about 10.5 note-local units: this scale brings it to the brand head.
const brandFxScale = 3.6
const brandHot = { shape: 'filled', rx: BRAND_HEAD_RX / brandFxScale, ry: BRAND_HEAD_RY / brandFxScale, rim: '#fffbe6' }

const mix = (from, to, amount) => {
  const channel = (hex, start) => parseInt(hex.slice(start, start + 2), 16)
  return `#${[1, 3, 5].map((start) => Math.round(channel(from, start) + (channel(to, start) - channel(from, start)) * amount).toString(16).padStart(2, '0')).join('')}`
}

const normalHead = { rx: 27, ry: 19 }
const stemLength = 3.5 * staffSpace
const stemWidth = 6

const headExtent = ({ rx, ry }) => {
  const tilt = (-NOTE_TILT * Math.PI) / 180
  const halfWidth = Math.hypot(rx * Math.cos(tilt), ry * Math.sin(tilt))
  return { halfWidth, attachY: -((rx * rx - ry * ry) * Math.sin(tilt) * Math.cos(tilt)) / halfWidth }
}

const stemGeometry = (y, head, width, down = y <= middleLine) => {
  const { halfWidth, attachY } = headExtent(head)
  const side = down ? -1 : 1
  return { x: side * (halfWidth - width / 2), start: side * attachY, side }
}

const stem = (x, y, color, opacity = 1) => {
  const { x: stemX, start, side } = stemGeometry(y, normalHead, stemWidth)
  return `<path transform="translate(${x} ${y})" d="M${stemX} ${start}V${start - side * stemLength}" stroke="${color}" stroke-width="${stemWidth}" stroke-linecap="round" opacity="${opacity}"/>`
}

const head = (x, y, fill, opacity = 1) =>
  `<ellipse transform="translate(${x} ${y}) rotate(${NOTE_TILT})" rx="${normalHead.rx}" ry="${normalHead.ry}" fill="${fill}" opacity="${opacity}"/>`

const ghostNote = (x, y) => stem(x, y, staffInk, 0.35) + head(x, y, staffInk, 0.35)
const accentNote = (x, y) => stem(x, y, accentStemInk) + head(x, y, accentHeadInk)

const brandNote = (x, y) => {
  const { x: stemX, start, side } = stemGeometry(y, brandHead, brandStemWidth, false)
  const litLines = staffLines.filter((lineY) => lineY <= y + staffSpace)
  return `${litStaff(brandId, { x, reach: brandLitReach, lines: litLines, width: 5, opacity: 0.8 })}
  <g transform="translate(${x} ${y})">
    <g class="flame" transform="scale(${brandFxScale})">${hotNoteStatic(brandId, { ...brandHot, intensity: 1, detail: 'full' })}</g>
    ${litStem({ x: stemX, y1: start, y2: start - side * stemLength, width: brandStemWidth })}
    <g transform="scale(${brandFxScale})">${hotHeadMarkup(brandId, 'filled', { ...brandHot, heat: 1 })}</g>
  </g>`
}

const html = ({ accent: [from, to], title, subtitle }) => {
  const wash = mix(from, ember, 0.6)
  const showBrand = title !== brand
  return `<!doctype html><meta charset="utf-8"><style>
html, body { margin: 0 }
body { width: 1200px; height: 630px; position: relative; overflow: hidden; background: ${background}; color: ${ink}; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif }
.composition { position: absolute; inset: 0 }
svg { position: absolute; left: 0; top: 0; overflow: visible }
.text { position: absolute; left: 280px; width: 640px; text-align: center }
h1 { margin: 0 auto; width: 560px; font-size: 96px; line-height: 1.02; font-weight: 800; letter-spacing: -0.02em; color: ${ink}; text-wrap: balance; text-box: trim-start cap alphabetic }
.sub { margin: 18px auto 0; font-size: 42px; line-height: 1.2; font-weight: 600; color: #ecdcc8; text-wrap: balance }
.brand { position: absolute; left: 48px; bottom: 36px; font-size: 28px; font-weight: 700; color: #a8927a }
.rule { position: absolute; left: 0; right: 0; bottom: 0; height: 10px; background: linear-gradient(90deg, ${from}, ${to}) }
</style>
<div class="composition">
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  ${fxDefs(brandId, { gold: DARK_COLORS.gold, smoke: '#b8b2ac' })}
  <defs><radialGradient id="accent" gradientUnits="userSpaceOnUse" cx="600" cy="170" r="470"><stop offset="0" stop-color="${wash}" stop-opacity="0.26"/><stop offset="1" stop-color="${wash}" stop-opacity="0"/></radialGradient></defs>
  <rect x="-600" y="-600" width="2400" height="1800" fill="${background}"/>
  <rect x="-600" y="-600" width="2400" height="1800" fill="url(#accent)"/>
  <g stroke="${staffInk}" stroke-opacity="0.4" stroke-width="5" stroke-linecap="round">${staffLines.map((y) => `<path d="M-10 ${y}H1210"/>`).join('')}</g>
  ${ghostNote(120, 200)}${ghostNote(205, 128)}${ghostNote(1000, 164)}${ghostNote(1090, 200)}
  ${accentNote(470, 200)}${accentNote(740, 128)}
  ${brandNote(600, middleLine)}
</svg>
<div class="text"><h1>${title}</h1><div class="sub">${subtitle.replaceAll('-', '‑')}</div></div>
</div>
${showBrand ? `<div class="brand">${brand}</div>` : ''}<div class="rule"></div>`
}

const subtitleAttempts = [
  ...[42, 40, 38, 36, 34].map((size) => ({ size, width: 600 })),
  ...[42, 40, 38, 36, 34, 32, 30].map((size) => ({ size, width: 640 })),
]

const fitText = ({ titleMaxWidth, titleMaxHeight, textTop, areaBottom, minMargin, subtitleAttempts }) => {
  const composition = document.querySelector('.composition')
  const text = document.querySelector('.text')
  const title = document.querySelector('h1')
  const subtitle = document.querySelector('.sub')
  const contentTop = Math.min(...[...document.querySelectorAll('.flame, .spark')].map((element) => element.getBoundingClientRect().top))
  const lineCount = (element, size, lineHeight) => {
    element.style.fontSize = `${size}px`
    return Math.round(element.getBoundingClientRect().height / (size * lineHeight))
  }
  const titleFits = (size) => {
    const lines = lineCount(title, size, 1.02)
    return lines <= 2 && title.getBoundingClientRect().height <= titleMaxHeight && title.scrollWidth <= titleMaxWidth
  }
  const fitSubtitle = () =>
    subtitleAttempts.find(({ size, width }) => {
      subtitle.style.width = `${width}px`
      return lineCount(subtitle, size, 1.2) <= 2
    })

  const titleSizes = []
  for (let size = 96; size >= 52; size -= 4) if (titleFits(size)) titleSizes.push(size)
  if (titleSizes.length === 0) titleSizes.push(52)
  const oneLine = titleSizes.findIndex((size) => size >= 80 && lineCount(title, size, 1.02) === 1)

  text.style.top = `${textTop}px`
  const maxHeight = areaBottom - 2 * minMargin
  let height = Infinity
  for (let index = Math.max(oneLine, 0); index < titleSizes.length && height > maxHeight; index++) {
    title.style.fontSize = `${titleSizes[index]}px`
    fitSubtitle()
    height = subtitle.getBoundingClientRect().bottom - contentTop
  }
  composition.style.transform = `translateY(${(areaBottom - height) / 2 - contentTop}px)`
}

mkdirSync(fileURLToPath(new URL('en/', outDir)), { recursive: true })
const { chromium } = await import('playwright-core')
const browser = await chromium.launch({ channel: 'chrome' })
const written = []
for (const page of pending) {
  const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await tab.setContent(html(page))
  await tab.evaluate(fitText, { titleMaxWidth: 560, titleMaxHeight: 200, textTop, areaBottom: 620, minMargin: 24, subtitleAttempts })
  const path = fileURLToPath(new URL(page.out, outDir))
  await tab.screenshot({ path })
  await tab.close()
  written.push(path)
}
await browser.close()

const ffmpeg = ['/opt/homebrew/bin/ffmpeg', 'ffmpeg'].find((bin) => {
  try {
    execFileSync(bin, ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})

for (const path of written) {
  if (statSync(path).size > maxBytes) {
    if (!ffmpeg) console.warn(`${path} is over 150 kB and ffmpeg is missing`)
    else {
      const tmp = `${path}.tmp.png`
      try {
        execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', path, '-vf', 'split[a][b];[a]palettegen=max_colors=256[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', tmp])
        if (statSync(tmp).size < statSync(path).size) renameSync(tmp, path)
      } catch (error) {
        console.warn(`ffmpeg failed for ${path}: ${error.message}`)
      }
    }
  }
  console.log(`${path.split('/').pop()} ${(statSync(path).size / 1024).toFixed(1)} kB`)
}
