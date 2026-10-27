import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const outDir = new URL('../public/og/', import.meta.url)
const maxBytes = 150 * 1024

const pages = [
  { file: 'og.png', accent: ['#7c5cff', '#4a34c9'], title: 'Solfège hero', subtitle: 'Apprendre à lire les notes', foot: 'Apprendre · Séries · Dictée · Armures · Survie · Solfège hero · Partitions' },
  { file: 'og-learn.png', accent: ['#3aa86b', '#26784c'], title: 'Apprendre', subtitle: 'Une note à la fois, tirage adaptatif', foot: 'Solfège hero · Apprendre' },
  { file: 'og-keys.png', accent: ['#8a63d2', '#5f3fa6'], title: 'Armures', subtitle: 'Reconnaître la tonalité d’une armure', foot: 'Solfège hero · Armures' },
  { file: 'og-series.png', accent: ['#e0a21f', '#b97a10'], title: 'Séries', subtitle: '20 notes chronométrées, +5 s par erreur', foot: 'Solfège hero · Séries' },
  { file: 'og-scores.png', accent: ['#3f7fd9', '#2a58a8'], title: 'Partitions', subtitle: 'Une bibliothèque MusicXML à jouer', foot: 'Solfège hero · Partitions' },
  { file: 'og-defi.png', accent: ['#1aa3b8', '#117486'], title: 'Un ami te défie', subtitle: '20 notes, bats son temps', foot: 'Solfège hero · Séries' },
  { file: 'og-dictee.png', accent: ['#c2409b', '#8f2c78'], title: 'Défi Dictée', subtitle: '20 notes à l’oreille, bats le temps de ton ami', foot: 'Solfège hero · Dictée' },
  { file: 'og-survie.png', accent: ['#cf4a6c', '#ac3552'], title: 'Défi Survie', subtitle: '3 vies, tiens plus longtemps que ton ami', foot: 'Solfège hero · Survie' },
  { file: 'og-hero.png', accent: ['#e8854a', '#cf5a72'], title: 'Défi Solfège hero', subtitle: '16 mesures en rythme, fais mieux que ton ami', foot: 'Solfège hero' },
  { file: 'og-jour.png', accent: ['#f5b83d', '#e8854a'], title: 'Défi du jour', subtitle: 'La même série pour tout le monde aujourd’hui', foot: 'Solfège hero · Séries' },
  { file: 'og-partition.png', accent: ['#2f86c6', '#2467a6'], title: 'Une partition pour toi', subtitle: 'Ouvre-la et joue-la dans Solfège hero', foot: 'Solfège hero · Partitions' },
]

const force = process.argv.includes('--force')
const pending = force ? pages : pages.filter((page) => !existsSync(new URL(page.file, outDir)))
if (pending.length === 0) {
  console.log('og images: all present, skipping (use --force to regenerate)')
  process.exit(0)
}

const favicon = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8')

const html = ({ accent: [from, to], title, subtitle, foot }) => `<!doctype html><meta charset="utf-8"><style>
html, body { margin: 0 }
body { width: 1200px; height: 630px; position: relative; overflow: hidden; background: #12101a; color: #f2eefc; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif }
.glow { position: absolute; right: -180px; top: -220px; width: 760px; height: 760px; border-radius: 50%; background: radial-gradient(circle, ${from}55, transparent 68%) }
.bar { position: absolute; left: 0; top: 0; bottom: 0; width: 20px; background: linear-gradient(180deg, ${from}, ${to}) }
.logo { position: absolute; left: 90px; top: 64px; width: 128px; height: 128px }
.logo svg { width: 100%; height: 100% }
.brand { position: absolute; left: 244px; top: 104px; font-size: 40px; font-weight: 700; color: #9d96b8 }
.text { position: absolute; left: 90px; right: 90px; top: 238px }
h1 { margin: 0; font-size: 96px; line-height: 1.05; font-weight: 800; letter-spacing: -0.02em; color: #fff; padding-bottom: 8px }
.rule { width: 160px; height: 10px; border-radius: 5px; margin-top: 8px; background: linear-gradient(90deg, ${from}, ${to}) }
.sub { margin-top: 28px; font-size: 50px; line-height: 1.2; font-weight: 600; color: #f2eefc }
.foot { position: absolute; left: 90px; bottom: 44px; font-size: 28px; font-weight: 600; color: ${from}; filter: brightness(1.25) }
</style><div class="glow"></div><div class="bar"></div>
<div class="logo">${favicon}</div><div class="brand">Solfège hero</div>
<div class="text"><h1>${title}</h1><div class="rule"></div><div class="sub">${subtitle}</div></div>
<div class="foot">${foot}</div>`

mkdirSync(fileURLToPath(outDir), { recursive: true })
const { chromium } = await import('playwright-core')
const browser = await chromium.launch({ channel: 'chrome' })
const written = []
for (const page of pending) {
  const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await tab.setContent(html(page))
  const path = fileURLToPath(new URL(page.file, outDir))
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
