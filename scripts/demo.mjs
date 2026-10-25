import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const APP_URL = 'http://localhost:4173/?demo'
const FFMPEG = '/opt/homebrew/bin/ffmpeg'
const SIZE = { width: 844, height: 390 }
const PLAY_SECONDS = 22
const INTRO_SECONDS = 1
const CLIP_SECONDS = 20
const GIF_FPS = 15
const GIF_MAX_BYTES = 8 * 1024 * 1024
const HOME_MAX_BYTES = 500 * 1024
const MAX_JITTER_MS = 120
const PRESS_LATENCY_MS = 15
const AIM_AHEAD_MS = 200

const SETTINGS = {
  clefs: ['treble'],
  accidentals: true,
  timed: false,
  muted: true,
  heroTempo: 80,
  metronome: true,
  heroMelody: '',
  theme: 'dark',
  keyboardSpan: 1,
  vibration: false,
}

function seededRandom(seed) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function ffmpeg(...args) {
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...args])
}

async function launch(contextOptions) {
  const browser = await chromium.launch({ channel: 'chrome' })
  const context = await browser.newContext(contextOptions)
  await context.addInitScript((settings) => localStorage.setItem('solfege.settings.v2', JSON.stringify(settings)), SETTINGS)
  return { browser, context }
}

async function recordPlay(videoDir) {
  const { browser, context } = await launch({
    viewport: SIZE,
    deviceScaleFactor: 1,
    hasTouch: false,
    recordVideo: { dir: videoDir, size: SIZE },
  })
  const page = await context.newPage()
  const startedAt = Date.now()
  await page.goto(APP_URL)
  await page.waitForSelector('text=Solfège hero')
  await sleep(1500)
  await page.getByText('Solfège hero').nth(1).click()
  await sleep(700)
  const introSeconds = (Date.now() - startedAt) / 1000
  await page.getByRole('button', { name: 'Jouer' }).click()

  const random = seededRandom(7)
  const keys = page.locator('.answers button.answer')
  const playUntil = Date.now() + PLAY_SECONDS * 1000
  while (Date.now() < playUntil) {
    const next = await page.evaluate(() => window.__solfege?.heroNext() ?? null)
    if (!next) {
      await sleep(50)
      continue
    }
    const box = await keys.nth(next.pitchClass).boundingBox()
    if (!box) continue
    const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const jitter = random() * MAX_JITTER_MS
    const wait = next.dueInMs + jitter - PRESS_LATENCY_MS
    if (wait > AIM_AHEAD_MS) {
      await sleep(wait - AIM_AHEAD_MS)
      await page.mouse.move(target.x, target.y)
      await sleep(AIM_AHEAD_MS)
    } else {
      await page.mouse.move(target.x, target.y)
      await sleep(Math.max(0, wait))
    }
    await page.mouse.down()
    await sleep(60)
    await page.mouse.up()
  }

  const hud = (await page.locator('.hud').innerText()).replace(/\s+/g, ' ')
  const video = page.video()
  await context.close()
  await browser.close()
  console.log('HUD at end:', hud)
  return { videoPath: await video.path(), introSeconds }
}

async function captureHome(path) {
  const { browser, context } = await launch({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  await page.goto(APP_URL)
  await page.waitForSelector('text=Solfège hero')
  await sleep(800)
  await page.screenshot({ path })
  await browser.close()
  if (statSync(path).size > HOME_MAX_BYTES) {
    ffmpeg('-i', path, '-vf', 'scale=iw*0.75:-1:flags=lanczos', '-compression_level', '9', path.replace(/\.png$/, '.small.png'))
    execFileSync('mv', [path.replace(/\.png$/, '.small.png'), path])
  }
}

function encode(webm, trimSeconds) {
  const clip = ['-ss', trimSeconds.toFixed(2), '-t', String(CLIP_SECONDS), '-i', webm]
  ffmpeg(...clip, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', 'docs/demo.mp4')
  for (const colors of [256, 128, 64, 32]) {
    const filter = `fps=${GIF_FPS},scale=${SIZE.width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff:max_colors=${colors}[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`
    ffmpeg(...clip, '-filter_complex', filter, '-loop', '0', 'docs/demo.gif')
    if (statSync('docs/demo.gif').size < GIF_MAX_BYTES) return
    console.log(`GIF too large at ${colors} colors, retrying with fewer`)
  }
}

mkdirSync('docs', { recursive: true })
const videoDir = mkdtempSync(join(tmpdir(), 'solfege-demo-'))
try {
  const { videoPath, introSeconds } = await recordPlay(videoDir)
  const trim = Math.max(0, introSeconds - INTRO_SECONDS)
  encode(videoPath, trim)
  await captureHome('docs/home.png')
} finally {
  rmSync(videoDir, { recursive: true, force: true })
}
for (const file of ['demo.mp4', 'demo.gif', 'home.png']) {
  console.log(file, (statSync(join('docs', file)).size / 1024).toFixed(0), 'KB')
}
console.log(readdirSync('docs').join(' '))
