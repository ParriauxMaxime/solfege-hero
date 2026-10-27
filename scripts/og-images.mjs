import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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
const trebleClef = ['M58 152 C58 162 46 162 47 153', 'M58 152 L61 70 C62 52 68 38 73 38 C80 40 72 62 58 90 C42 116 48 135 62 135 C77 135 80 114 67 107 C55 101 46 111 53 122 C57 127 64 124 62 118']
const clefScale = 2.25
const clefStroke = 11
const clefTransform = `translate(203 -61) scale(${clefScale})`

const background = '#15100c'
const ink = '#fffaf2'
const staffInk = '#f4e9dc'
const cream = '#fff0d8'
const ember = '#f97316'
const litStaffInk = '#ffb35a'
const shadowInk = '#7a1400'

const mix = (from, to, amount) => {
  const channel = (hex, start) => parseInt(hex.slice(start, start + 2), 16)
  return `#${[1, 3, 5].map((start) => Math.round(channel(from, start) + (channel(to, start) - channel(from, start)) * amount).toString(16).padStart(2, '0')).join('')}`
}

const tongueGradients = ['fireOuter', 'fireMiddle', 'fireInner']
const stops = (list) => list.map(([offset, color, opacity = 1]) => `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`).join('')
const flameDefs = `
    <linearGradient id="fireOuter" x1="0" y1="1" x2="0" y2="0">${stops([[0, '#ffd36b', 0], [0.14, '#ffd36b'], [0.35, '#ff8a1f'], [0.75, '#e0400f'], [1, '#b91c1c', 0]])}</linearGradient>
    <linearGradient id="fireMiddle" x1="0" y1="1" x2="0" y2="0">${stops([[0, '#fffbe6'], [0.3, '#ffd36b'], [0.6, '#ff8a1f'], [0.85, '#e0400f'], [1, '#b91c1c', 0]])}</linearGradient>
    <linearGradient id="fireInner" x1="0" y1="1" x2="0" y2="0">${stops([[0, '#fffbe6'], [0.5, '#ffd36b'], [0.85, '#ff8a1f'], [1, '#e0400f', 0]])}</linearGradient>
    <filter id="bloom" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="12"/></filter>
    <filter id="blur30" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="30"/></filter>
    <filter id="blur10" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="10"/></filter>
    <filter id="blur7" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="blur3" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="blur5"x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="5"/></filter>`

const tongue = (scale, { x, height, width, lean, bend = 0, tier }) => {
  const [cx, h, half, tipX, bendX] = [x * scale, height * scale, (width * scale) / 2, (x + lean) * scale, (x + bend) * scale]
  const path = `M${cx - half} 0C${cx - half * 1.25} ${-h * 0.35} ${bendX - half * 0.3} ${-h * 0.62} ${tipX} ${-h}C${bendX + half * 0.4} ${-h * 0.6} ${cx + half * 1.25} ${-h * 0.3} ${cx + half} 0C${cx + half * 0.6} ${half * 0.9} ${cx - half * 0.6} ${half * 0.9} ${cx - half} 0Z`
  return `<path fill="url(#${tongueGradients[tier]})" d="${path}"/>`
}

const mainTongues = [
  { x: -50, height: 104, width: 50, lean: -26, bend: 10, tier: 0 },
  { x: -28, height: 150, width: 56, lean: -16, bend: 12, tier: 0 },
  { x: 2, height: 178, width: 64, lean: 6, bend: -10, tier: 0 },
  { x: 30, height: 146, width: 54, lean: 18, bend: -10, tier: 0 },
  { x: 52, height: 100, width: 46, lean: 26, bend: -8, tier: 0 },
  { x: -14, height: 140, width: 50, lean: -8, bend: 8, tier: 1 },
  { x: 18, height: 150, width: 50, lean: 12, bend: -7, tier: 1 },
  { x: -36, height: 132, width: 16, lean: -30, bend: 8, tier: 1 },
  { x: 40, height: 126, width: 16, lean: 28, bend: -8, tier: 1 },
  { x: 2, height: 118, width: 42, lean: 3, bend: -4, tier: 2 },
  { x: -20, height: 72, width: 26, lean: -6, bend: 4, tier: 2 },
  { x: 24, height: 80, width: 26, lean: 7, bend: -4, tier: 2 },
]
const leftTongues = [
  { x: -26, height: 78, width: 36, lean: -12, bend: 6, tier: 0 },
  { x: -6, height: 112, width: 42, lean: 6, bend: -7, tier: 0 },
  { x: 16, height: 86, width: 36, lean: 14, bend: -5, tier: 0 },
  { x: 32, height: 54, width: 28, lean: 14, bend: -4, tier: 0 },
  { x: -2, height: 90, width: 34, lean: 3, bend: -3, tier: 1 },
  { x: 6, height: 62, width: 24, lean: 4, bend: 0, tier: 2 },
]
const rightTongues = [
  { x: -28, height: 60, width: 30, lean: -10, bend: 4, tier: 0 },
  { x: -10, height: 96, width: 38, lean: -3, bend: 7, tier: 0 },
  { x: 10, height: 120, width: 42, lean: 10, bend: -8, tier: 0 },
  { x: 28, height: 72, width: 32, lean: 15, bend: -5, tier: 0 },
  { x: 0, height: 98, width: 34, lean: 0, bend: 3, tier: 1 },
  { x: -6, height: 58, width: 24, lean: -2, bend: 2, tier: 2 },
]

const mainSparks = [
  { dx: -66, dy: -96, rx: 1.8, ry: 4.6, opacity: 0.95, color: '#ffd36b' },
  { dx: 52, dy: -122, rx: 1.6, ry: 4.8, opacity: 0.9, color: '#fff3c4' },
  { dx: -34, dy: -168, rx: 1.5, ry: 4.4, opacity: 0.8, color: '#ff8a1f' },
  { dx: 74, dy: -84, rx: 2.2, ry: 2.2, opacity: 0.9, color: '#ffd36b' },
  { dx: 20, dy: -190, rx: 1.6, ry: 4.8, opacity: 0.75, color: '#fff3c4' },
  { dx: -88, dy: -134, rx: 1.9, ry: 1.9, opacity: 0.7, color: '#ff8a1f' },
  { dx: -12, dy: -150, rx: 1.3, ry: 3.6, opacity: 0.65, color: '#ffd36b' },
  { dx: 86, dy: -152, rx: 1.6, ry: 4.4, opacity: 0.7, color: '#ff8a1f' },
  { dx: -52, dy: -194, rx: 1.7, ry: 1.7, opacity: 0.6, color: '#fff3c4' },
  { dx: 44, dy: -66, rx: 1.4, ry: 3.8, opacity: 0.9, color: '#ffd36b' },
  { dx: -78, dy: -58, rx: 1.5, ry: 3.4, opacity: 0.8, color: '#ff8a1f' },
  { dx: 60, dy: -184, rx: 1.4, ry: 1.4, opacity: 0.55, color: '#ffd36b' },
]
const accentSparks = [
  { dx: -34, dy: -64, rx: 1.2, ry: 3.2, opacity: 0.9, color: '#ffd36b' },
  { dx: 28, dy: -92, rx: 1.1, ry: 3, opacity: 0.8, color: '#fff3c4' },
  { dx: -12, dy: -116, rx: 1, ry: 2.8, opacity: 0.65, color: '#ff8a1f' },
  { dx: 42, dy: -48, rx: 1.5, ry: 1.5, opacity: 0.75, color: '#ffd36b' },
  { dx: -46, dy: -104, rx: 1.2, ry: 1.2, opacity: 0.55, color: '#ff8a1f' },
  { dx: 8, dy: -78, rx: 1, ry: 2.6, opacity: 0.6, color: '#fff3c4' },
]

const litStaff = ({ id, x, y, height, reach }) => {
  const segments = staffLines
    .map((lineY) => ({ lineY, strength: lineY <= y ? 1 - (y - lineY) / (height * 1.15) : lineY - y <= staffSpace ? 0.5 : 0 }))
    .filter(({ strength }) => strength > 0)
    .map(({ lineY, strength }) => `<path d="M${x - reach} ${lineY}H${x + reach}" stroke-opacity="${strength.toFixed(2)}"/>`)
    .join('')
  return `<linearGradient id="lit-${id}" gradientUnits="userSpaceOnUse" x1="${x - reach}" y1="0" x2="${x + reach}" y2="0">${stops([[0, litStaffInk, 0], [0.5, litStaffInk, 1], [1, litStaffInk, 0]])}</linearGradient>
  <g stroke="url(#lit-${id})" stroke-width="5" stroke-linecap="round" style="mix-blend-mode:screen">${segments}</g>`
}

const flame = ({ id, x, y, scale, tilt, tongues, sparks, seed, displacement, coreY = -16 }) => {
  const height = Math.max(...tongues.map(({ height }) => height)) * scale
  const embers = sparks
    .map(({ dx, dy, rx, ry, opacity, color }) => `<ellipse class="spark" cx="${dx * scale}" cy="${dy * scale}" rx="${rx}" ry="${ry}" fill="${color}" opacity="${opacity}"/>`)
    .join('')
  const glows = `<g style="mix-blend-mode:screen"><ellipse cx="0" cy="${-height * 0.4}" rx="${110 * scale}" ry="${height * 0.75}" fill="${ember}" opacity="0.45" filter="url(#blur30)"/><ellipse cx="0" cy="${-8 * scale}" rx="${58 * scale}" ry="${40 * scale}" fill="#ff7a1a" opacity="0.8" filter="url(#blur10)"/></g>`
  const fire = `<filter id="wobble-${id}" x="-40%" y="-20%" width="180%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.015 0.05" numOctaves="2" seed="${seed}" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="${displacement}" xChannelSelector="R" yChannelSelector="G" result="wobble"/><feGaussianBlur in="wobble" stdDeviation="1.2"/></filter>
    <g id="fire-${id}" class="flame" filter="url(#wobble-${id})">${tongues.map((item) => tongue(scale, item)).join('')}</g>`
  const core = `<ellipse cx="0" cy="${coreY * scale}" rx="${26 * scale}" ry="${30 * scale}" fill="#fff3c4" opacity="0.85" filter="url(#blur7)" style="mix-blend-mode:screen"/>`
  const bloom = `<use href="#fire-${id}" filter="url(#bloom)" opacity="0.5" style="mix-blend-mode:screen"/>`
  return { height, fire: `<g transform="translate(${x} ${y}) rotate(${tilt})">${glows}${fire}${core}${bloom}${embers}</g>` }
}

const noteTilt = -20
const normalHead = { rx: 27, ry: 19 }
const brandHead = { rx: 33, ry: 24.5 }
const stemLength = 3.5 * staffSpace
const stemWidth = 6

const headExtent = ({ rx, ry }) => {
  const tilt = (-noteTilt * Math.PI) / 180
  const halfWidth = Math.hypot(rx * Math.cos(tilt), ry * Math.sin(tilt))
  return { halfWidth, attachY: -((rx * rx - ry * ry) * Math.sin(tilt) * Math.cos(tilt)) / halfWidth }
}

const stem = (x, y, color, { head = normalHead, down = y <= middleLine, opacity = 1, width = stemWidth } = {}) => {
  const { halfWidth, attachY } = headExtent(head)
  const side = down ? -1 : 1
  const stemX = side * (halfWidth - width / 2)
  const startY = side * attachY
  return `<path transform="translate(${x} ${y})" d="M${stemX} ${startY}V${startY - side * stemLength}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"/>`
}

const head = (x, y, fill, opacity = 1) =>
  `<ellipse transform="translate(${x} ${y}) rotate(${noteTilt})" rx="${normalHead.rx}" ry="${normalHead.ry}" fill="${fill}" opacity="${opacity}"/>`

const ghostNote = (x, y) => stem(x, y, staffInk, { opacity: 0.35 }) + head(x, y, staffInk, 0.35)

const noteShadow = (x, y, { rx, ry }, opacity, grow = 4) =>
  `<ellipse transform="translate(${x} ${y}) rotate(${noteTilt})" rx="${rx + grow}" ry="${ry + grow}" fill="${shadowInk}" opacity="${opacity}" filter="url(#blur3)" style="mix-blend-mode:multiply"/>`

const brandStemWidth = 8

const brandNote = (x, y) => {
  const brandStem = { head: brandHead, down: false, width: brandStemWidth }
  return `${noteShadow(x, y, brandHead, 0.95, 9)}<g filter="url(#blur3)" style="mix-blend-mode:multiply">${stem(x, y, shadowInk, { ...brandStem, width: 14, opacity: 0.7 })}</g>${stem(x, y, '#fffbe6', brandStem)}<ellipse transform="translate(${x} ${y}) rotate(${noteTilt})" rx="${brandHead.rx}" ry="${brandHead.ry}" fill="url(#brandGold)" stroke="#fffbe6" stroke-width="2.5"/>`
}

const html = ({ accent: [from, to], title, subtitle }) => {
  const wash = mix(from, ember, 0.6)
  const tint = mix(from, cream, 0.55)
  const accentStem = mix('#ffe6c4', tint, 0.5)
  const showBrand = title !== brand
  const left = { x: 470, y: 200 }
  const right = { x: 740, y: 128 }
  const center = { x: 600, y: middleLine }
  const flames = {
    left: flame({ id: 'left', ...left, scale: 0.95, tilt: 5, tongues: leftTongues, sparks: accentSparks, seed: 3, displacement: 10 }),
    right: flame({ id: 'right', ...right, scale: 0.95, tilt: 4, tongues: rightTongues, sparks: accentSparks.map(({ dx, ...spark }) => ({ ...spark, dx: -dx * 0.8 })), seed: 11, displacement: 10 }),
    center: flame({ id: 'center', ...center, scale: 1.08, tilt: 0, tongues: mainTongues, sparks: mainSparks, seed: 7, displacement: 14, coreY: -66 }),
  }
  const lit = [
    litStaff({ id: 'left', ...left, height: flames.left.height, reach: 90 }),
    litStaff({ id: 'right', ...right, height: flames.right.height, reach: 90 }),
    litStaff({ id: 'center', ...center, height: flames.center.height, reach: 150 }),
  ].join('')
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
  <defs>${flameDefs}
    <radialGradient id="accent" gradientUnits="userSpaceOnUse" cx="600" cy="170" r="470"><stop offset="0" stop-color="${wash}" stop-opacity="0.26"/><stop offset="1" stop-color="${wash}" stop-opacity="0"/></radialGradient>
    <linearGradient id="accentNote" gradientUnits="userSpaceOnUse" gradientTransform="rotate(${-noteTilt})" x1="0" y1="${-normalHead.ry}" x2="0" y2="${normalHead.ry}">${stops([[0, '#ffe6c4'], [1, tint]])}</linearGradient>
    <linearGradient id="brandGold" gradientUnits="userSpaceOnUse" gradientTransform="rotate(${-noteTilt})" x1="0" y1="${-brandHead.ry}" x2="0" y2="${brandHead.ry}">${stops([[0, '#fff3c4'], [0.45, '#ffc24a'], [1, '#f0a020']])}</linearGradient>
  </defs>
  <rect x="-600" y="-600" width="2400" height="1800" fill="${background}"/>
  <rect x="-600" y="-600" width="2400" height="1800" fill="url(#accent)"/>
  <g stroke="${staffInk}" stroke-opacity="0.4" stroke-width="5" stroke-linecap="round">${staffLines.map((y) => `<path d="M-10 ${y}H1210"/>`).join('')}</g>
  ${lit}
  <g fill="none" id="clef" stroke="${ink}" stroke-width="${clefStroke / clefScale}" stroke-linecap="round" stroke-linejoin="round" transform="${clefTransform}">${trebleClef.map((d) => `<path d="${d}"/>`).join('')}</g>
  ${ghostNote(120, 200)}${ghostNote(205, 128)}${ghostNote(1000, 164)}${ghostNote(1090, 200)}
  ${flames.left.fire}${flames.right.fire}${flames.center.fire}
  ${noteShadow(left.x, left.y, normalHead, 0.45)}${noteShadow(right.x, right.y, normalHead, 0.45)}
  ${stem(left.x, left.y, accentStem)}${stem(right.x, right.y, accentStem)}
  ${head(left.x, left.y, 'url(#accentNote)')}${head(right.x, right.y, 'url(#accentNote)')}
  ${brandNote(center.x, center.y)}
</svg>
<div class="text"><h1>${title}</h1><div class="sub">${subtitle.replaceAll('-', '‑')}</div></div>
</div>
${showBrand ? `<div class="brand">${brand}</div>` : ''}<div class="rule"></div>`
}

const subtitleAttempts = [
  ...[42, 40, 38, 36, 34].map((size) => ({ size, width: 600 })),
  ...[42, 40, 38, 36, 34, 32, 30].map((size) => ({ size, width: 640 })),
]

const fitText = ({ titleMaxWidth, titleMaxHeight, gap, areaBottom, minMargin, clefStroke, subtitleAttempts }) => {
  const composition = document.querySelector('.composition')
  const text = document.querySelector('.text')
  const title = document.querySelector('h1')
  const subtitle = document.querySelector('.sub')
  const clefBox = document.querySelector('#clef').getBoundingClientRect()
  const flameTop = Math.min(...[...document.querySelectorAll('.flame, .spark')].map((element) => element.getBoundingClientRect().top))
  const clef = { top: clefBox.top - clefStroke / 2, bottom: clefBox.bottom + clefStroke / 2 }
  const contentTop = Math.min(clef.top, flameTop)
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

  text.style.top = `${clef.bottom + gap}px`
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
        execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', path, '-vf', 'split[a][b];[a]palettegen=max_colors=256[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', tmp])
        if (statSync(tmp).size < statSync(path).size) renameSync(tmp, path)
      } catch (error) {
        console.warn(`ffmpeg failed for ${path}: ${error.message}`)
      }
    }
  }
  console.log(`${path.split('/').pop()} ${(statSync(path).size / 1024).toFixed(1)} kB`)
}
