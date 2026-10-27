import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const outDir = new URL('../public/og/', import.meta.url)
const maxBytes = 150 * 1024

const pages = [
  { file: 'og.png', accent: ['#7c5cff', '#4a34c9'], title: 'Solfège hero', subtitle: 'Apprendre à lire les notes' },
  { file: 'og-learn.png', accent: ['#3aa86b', '#26784c'], title: 'Apprendre', subtitle: 'Une note à la fois, tirage adaptatif' },
  { file: 'og-keys.png', accent: ['#8a63d2', '#5f3fa6'], title: 'Armures', subtitle: 'Reconnaître la tonalité d’une armure' },
  { file: 'og-series.png', accent: ['#e0a21f', '#b97a10'], title: 'Séries', subtitle: '20 notes chronométrées, +5 s par erreur' },
  { file: 'og-scores.png', accent: ['#3f7fd9', '#2a58a8'], title: 'Partitions', subtitle: 'Une bibliothèque MusicXML à jouer' },
  { file: 'og-defi.png', accent: ['#1aa3b8', '#117486'], title: 'Un ami te défie', subtitle: '20 notes, bats son temps' },
  { file: 'og-dictee.png', accent: ['#c2409b', '#8f2c78'], title: 'Défi Dictée', subtitle: '20 notes à l’oreille, bats le temps de ton ami' },
  { file: 'og-survie.png', accent: ['#cf4a6c', '#ac3552'], title: 'Défi Survie', subtitle: '3 vies, tiens plus longtemps que ton ami' },
  { file: 'og-hero.png', accent: ['#e8854a', '#cf5a72'], title: 'Défi Solfège hero', subtitle: '16 mesures en rythme, fais mieux que ton ami' },
  { file: 'og-jour.png', accent: ['#f5b83d', '#e8854a'], title: 'Défi du jour', subtitle: 'La même série pour tout le monde aujourd’hui' },
  { file: 'og-partition.png', accent: ['#2f86c6', '#2467a6'], title: 'Une partition pour toi', subtitle: 'Ouvre-la et joue-la dans Solfège hero' },
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
  'og-hero.png': { title: 'Solfège hero challenge', subtitle: '16 bars in rhythm, do better than your friend' },
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
const trebleClef = ['M58 152 C58 162 46 162 47 153', 'M58 152 L61 70 C62 52 68 38 73 38 C80 40 72 62 58 90 C42 116 48 135 62 135 C77 135 80 114 67 107 C55 101 46 111 53 122 C57 127 64 124 62 118']
const clefScale = 2.25
const clefStroke = 11
const clefTransform = `translate(203 -61) scale(${clefScale})`
const heroNotePath = 'M-54 0A54 36 0 1 0 54 0A54 36 0 1 0 -54 0ZM-18 -26A30 18 55 1 0 18 26A30 18 55 1 0 -18 -26Z'

const lighten = (hex, amount) => {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
  return `rgb(${channels.map((value) => Math.round(value + (255 - value) * amount)).join(',')})`
}

const note = (x, y, color, opacity = 1) => {
  const stemDown = y < staffLines[2]
  const stemX = stemDown ? -25 : 25
  const stemEnd = stemDown ? 110 : -110
  return `<g transform="translate(${x} ${y})" opacity="${opacity}"><path d="M${stemX} 0V${stemEnd}" stroke="${color}" stroke-width="6" stroke-linecap="round"/><ellipse rx="27" ry="19" transform="rotate(-20)" fill="${color}"/></g>`
}

const subtitleAttempts = [
  ...[42, 40, 38, 36, 34].map((size) => ({ size, width: 600 })),
  ...[42, 40, 38, 36, 34, 32].map((size) => ({ size, width: 640 })),
]

const fitText = ({ titleMaxWidth, titleMaxHeight, gap, areaBottom, minMargin, clefStroke, subtitleAttempts }) => {
  const composition = document.querySelector('.composition')
  const text = document.querySelector('.text')
  const title = document.querySelector('h1')
  const subtitle = document.querySelector('.sub')
  const clefBox = document.querySelector('#clef').getBoundingClientRect()
  const clef = { top: clefBox.top - clefStroke / 2, bottom: clefBox.bottom + clefStroke / 2 }
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
  for (let size = 96; size >= 60; size -= 4) if (titleFits(size)) titleSizes.push(size)
  if (titleSizes.length === 0) titleSizes.push(60)
  const oneLine = titleSizes.findIndex((size) => size >= 80 && lineCount(title, size, 1.02) === 1)

  text.style.top = `${clef.bottom + gap}px`
  const maxHeight = areaBottom - 2 * minMargin
  let height = Infinity
  for (let index = Math.max(oneLine, 0); index < titleSizes.length && height > maxHeight; index++) {
    title.style.fontSize = `${titleSizes[index]}px`
    fitSubtitle()
    height = subtitle.getBoundingClientRect().bottom - clef.top
  }
  composition.style.transform = `translateY(${(areaBottom - height) / 2 - clef.top}px)`
}

const html = ({ accent: [from, to], title, subtitle }) => {
  const bright = lighten(from, 0.45)
  const showBrand = title !== brand
  return `<!doctype html><meta charset="utf-8"><style>
html, body { margin: 0 }
body { width: 1200px; height: 630px; position: relative; overflow: hidden; background: #12101a; color: #f2eefc; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif }
.composition { position: absolute; inset: 0 }
svg { position: absolute; left: 0; top: 0; overflow: visible }
.text { position: absolute; left: 280px; width: 640px; text-align: center }
h1 { margin: 0 auto; width: 560px; font-size: 96px; line-height: 1.02; font-weight: 800; letter-spacing: -0.02em; color: #fff; text-wrap: balance; text-box: trim-start cap alphabetic }
.sub { margin: 18px auto 0; font-size: 42px; line-height: 1.2; font-weight: 600; color: #d9d3ee; text-wrap: balance }
.brand { position: absolute; left: 48px; bottom: 36px; font-size: 28px; font-weight: 700; color: #9d96b8 }
.rule { position: absolute; left: 0; right: 0; bottom: 0; height: 10px; background: linear-gradient(90deg, ${from}, ${to}) }
</style>
<div class="composition">
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="accent" gradientUnits="userSpaceOnUse" cx="600" cy="200" r="450"><stop offset="0" stop-color="${from}" stop-opacity="0.4"/><stop offset="1" stop-color="${from}" stop-opacity="0"/></radialGradient>
    <radialGradient id="mint" gradientUnits="userSpaceOnUse" cx="600" cy="164" r="260"><stop offset="0" stop-color="#2ee6a6" stop-opacity="0.16"/><stop offset="1" stop-color="#2ee6a6" stop-opacity="0"/></radialGradient>
    <filter id="blur" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="24"/></filter>
  </defs>
  <rect x="-600" y="-600" width="2400" height="1800" fill="url(#accent)"/>
  <rect x="-600" y="-600" width="2400" height="1800" fill="url(#mint)"/>
  <g stroke="#f2eefc" stroke-opacity="0.45" stroke-width="5" stroke-linecap="round">${staffLines.map((y) => `<path d="M-10 ${y}H1210"/>`).join('')}</g>
  <g fill="none" id="clef" stroke="#fff" stroke-width="${clefStroke / clefScale}" stroke-linecap="round" stroke-linejoin="round" transform="${clefTransform}">${trebleClef.map((d) => `<path d="${d}"/>`).join('')}</g>
  ${note(120, 200, '#f2eefc', 0.35)}${note(205, 128, '#f2eefc', 0.35)}${note(1000, 164, '#f2eefc', 0.35)}${note(1090, 200, '#f2eefc', 0.35)}
  ${note(470, 200, bright)}${note(740, 128, bright)}
  <circle cx="600" cy="164" r="70" fill="#2ee6a6" opacity="0.45" filter="url(#blur)"/>
  <g transform="translate(600 164) rotate(-18) scale(0.9)"><ellipse rx="54" ry="36" fill="#12101a"/><path fill="#2ee6a6" fill-rule="evenodd" d="${heroNotePath}"/></g>
</svg>
<div class="text"><h1>${title}</h1><div class="sub">${subtitle.replaceAll('-', '‑')}</div></div>
</div>
${showBrand ? `<div class="brand">${brand}</div>` : ''}<div class="rule"></div>`
}

mkdirSync(fileURLToPath(new URL('en/', outDir)), { recursive: true })
const { chromium } = await import('playwright-core')
const browser = await chromium.launch({ channel: 'chrome' })
const written = []
for (const page of pending) {
  const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await tab.setContent(html(page))
  await tab.evaluate(fitText, { titleMaxWidth: 560, titleMaxHeight: 200, gap: 28, areaBottom: 620, minMargin: 24, clefStroke, subtitleAttempts })
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
        execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', path, '-vf', 'split[a][b];[a]palettegen=max_colors=256[p];[b][p]paletteuse=dither=none', tmp])
        if (statSync(tmp).size < statSync(path).size) renameSync(tmp, path)
      } catch (error) {
        console.warn(`ffmpeg failed for ${path}: ${error.message}`)
      }
    }
  }
  console.log(`${path.split('/').pop()} ${(statSync(path).size / 1024).toFixed(1)} kB`)
}
