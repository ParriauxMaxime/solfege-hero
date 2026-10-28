import {
  FADE_LEFT_X,
  HIT_X,
  LOGO_VIEW_BOX,
  PX_PER_BEAT,
  animatedLogoContent,
  edgeOpacity,
  staffY,
  staticLogoContent,
  stemPath,
} from '../brand/logoMarkup'
import { createLogoScore, flameScale, type LogoNote } from '../brand/logoScore'
import { motionReduced } from '../platform/appearance'
import { svgElement } from './glyphs'

const BPM = 70
const BEAT_SECONDS = 60 / BPM
const START_BEAT = -0.6
const MAX_STEP_MS = 100
const RECYCLE_X = FADE_LEFT_X - 12
const SEED_RANGE = 2 ** 32

const IGNITE_SECONDS = 0.06
const POP_RISE_SECONDS = 0.08
const POP_SETTLE_SECONDS = 0.3
const POP_SCALE = 0.28
const FLAME_RISE_SECONDS = 0.12
const FLAME_SETTLE_SECONDS = 0.3
const FLAME_FROM = 0.45
const FLAME_OVERSHOOT = 1.12
const GLOW_FADE_SECONDS = 0.5
const GLOW_RESTING = 0.25
const GLOW_STRENGTH = 0.8
const SNUFF_SECONDS = 0.4
const SNUFF_SHRINK = 0.6
const PUFF_SECONDS = 0.8
const PUFF_DELAY_SECONDS = 0.12
const SPARK_MIN_STREAK = 3
const SPARK_SECONDS = 0.95
const SPARK_CEILING_Y = 8

const FLAME_PHASE_PER_NOTE = 1.7

const wave = (time: number, period: number, phase: number) => Math.sin((2 * Math.PI * time) / period + phase)
const swayDegrees = (time: number, phase: number) => 4 * wave(time, 1.3, phase) + 1.5 * wave(time, 0.53, phase)
const stretch = (time: number, phase: number) => 1 + 0.05 * wave(time, 0.9, phase)
const coreFlicker = (time: number, phase: number) => 0.78 + 0.22 * wave(time, 0.37, phase)

const fixed = (value: number) => value.toFixed(2)
const scaled = (value: number) => `scale(${value.toFixed(3)})`
const span = (from: number, length: number, at: number) => Math.min(1, Math.max(0, (at - from) / length))

type Setter = (value: string) => void

/** Writes an attribute only when its value changed since the last write. */
function attribute(element: Element, name: string): Setter {
  let last = element.getAttribute(name)
  return (value) => {
    if (value === last) return
    last = value
    element.setAttribute(name, value)
  }
}

function part(root: Element, key: string): Element {
  const found = root.querySelector(`[data-k=${key}]`)
  if (!found) throw new Error(`Logo part "${key}" is missing`)
  return found
}

const popScale = (seconds: number) =>
  seconds < POP_RISE_SECONDS
    ? 1 + POP_SCALE * (seconds / POP_RISE_SECONDS)
    : 1 + POP_SCALE * (1 - span(POP_RISE_SECONDS, POP_SETTLE_SECONDS - POP_RISE_SECONDS, seconds))

const flameGrowth = (seconds: number) =>
  seconds < FLAME_RISE_SECONDS
    ? FLAME_FROM + (FLAME_OVERSHOOT - FLAME_FROM) * (seconds / FLAME_RISE_SECONDS)
    : FLAME_OVERSHOOT - (FLAME_OVERSHOOT - 1) * span(FLAME_RISE_SECONDS, FLAME_SETTLE_SECONDS - FLAME_RISE_SECONDS, seconds)

const glowStrength = (seconds: number) =>
  (seconds < IGNITE_SECONDS ? seconds / IGNITE_SECONDS : Math.max(GLOW_RESTING, 1 - span(IGNITE_SECONDS, GLOW_FADE_SECONDS, seconds) * (1 - GLOW_RESTING))) * GLOW_STRENGTH

function createSlot(root: Element) {
  const place = attribute(root, 'transform')
  const fade = attribute(root, 'opacity')
  const bar = attribute(part(root, 'bar'), 'opacity')
  const lower = attribute(part(root, 'note'), 'transform')
  const stems = [...root.querySelectorAll('[data-k=stem]')].map((stem) => attribute(stem, 'd'))
  const glow = attribute(part(root, 'glow'), 'opacity')
  const ink = attribute(part(root, 'ink'), 'opacity')
  const lit = attribute(part(root, 'lit'), 'opacity')
  const pop = attribute(part(root, 'pop'), 'transform')
  const miss = attribute(part(root, 'miss'), 'opacity')
  const flame = attribute(part(root, 'wisp'), 'opacity')
  const flameSize = attribute(part(root, 'wisp'), 'transform')
  const sway = attribute(part(root, 'sway'), 'transform')
  const core = attribute(part(root, 'wisp').querySelector('.core') as Element, 'opacity')
  const spark = attribute(part(root, 'spark'), 'opacity')
  const sparkPlace = attribute(part(root, 'spark'), 'transform')
  const puffs = [...root.querySelectorAll('[data-k=puff]')].map((puff) => ({ fade: attribute(puff, 'opacity'), place: attribute(puff, 'transform') }))
  let note: LogoNote = { index: 0, step: 0, stemUp: true, barStart: false, miss: false, streak: 0, snuffIndex: 0 }
  let settled = false

  const hidePuffs = () => {
    for (const puff of puffs) puff.fade('0')
  }

  function updateBurning(seconds: number, time: number) {
    const snuffAt = (note.snuffIndex - note.index) * BEAT_SECONDS
    const out = span(snuffAt, SNUFF_SECONDS, seconds)
    const alive = 1 - out
    lit(fixed(Math.min(1, seconds / IGNITE_SECONDS)))
    ink(seconds < IGNITE_SECONDS ? '1' : '0')
    pop(scaled(popScale(seconds)))
    glow(fixed(glowStrength(seconds) * alive))
    flame(fixed(Math.min(1, seconds / IGNITE_SECONDS) * alive))
    flameSize(scaled(flameGrowth(seconds) * flameScale(note.streak) * (1 - SNUFF_SHRINK * out)))
    if (alive > 0) {
      const phase = note.index * FLAME_PHASE_PER_NOTE
      sway(`rotate(${swayDegrees(time, phase).toFixed(2)}) scale(1 ${stretch(time, phase).toFixed(3)})`)
      core(fixed(coreFlicker(time, phase)))
    }
    const sparkProgress = (seconds - 0.05) / SPARK_SECONDS
    const sparking = note.streak >= SPARK_MIN_STREAK && note.index % 2 === 0 && sparkProgress > 0 && sparkProgress < 1
    spark(sparking ? fixed(Math.sin(Math.PI * sparkProgress) * 0.9) : '0')
    if (sparking) sparkPlace(`translate(${(-10 - 4 * sparkProgress).toFixed(2)} ${Math.max(-40 - 18 * sparkProgress, SPARK_CEILING_Y - staffY(note.step)).toFixed(2)})`)
    puffs.forEach(({ fade: puffFade, place: puffPlace }, index) => {
      const progress = span(snuffAt + PUFF_DELAY_SECONDS * index, PUFF_SECONDS, seconds)
      const visible = progress > 0 && progress < 1
      puffFade(visible ? fixed(Math.sin(Math.PI * progress)) : '0')
      if (visible) puffPlace(`translate(${-3 + 7 * index} ${(-8 - 30 * progress).toFixed(2)}) scale(${(0.8 + 1.4 * progress).toFixed(2)})`)
    })
    settled = seconds > snuffAt + PUFF_DELAY_SECONDS * (puffs.length - 1) + PUFF_SECONDS
  }

  return {
    assign(next: LogoNote) {
      note = next
      settled = false
      place(`translate(${HIT_X + next.index * PX_PER_BEAT} 0)`)
      lower(`translate(0 ${staffY(next.step)})`)
      for (const stem of stems) stem(stemPath(next.stemUp))
      bar(next.barStart ? '1' : '0')
      glow('0')
      ink('1')
      lit('0')
      miss('0')
      flame('0')
      spark('0')
      hidePuffs()
    },
    update(beat: number, time: number) {
      fade(fixed(edgeOpacity(HIT_X + (note.index - beat) * PX_PER_BEAT)))
      const seconds = (beat - note.index) * BEAT_SECONDS
      if (settled || seconds < 0) return
      if (note.miss) {
        miss(fixed(Math.min(1, seconds / IGNITE_SECONDS)))
        ink(seconds < IGNITE_SECONDS ? '1' : '0')
        settled = seconds > IGNITE_SECONDS
        return
      }
      updateBurning(seconds, time)
    },
    isGone: (beat: number) => HIT_X + (note.index - beat) * PX_PER_BEAT < RECYCLE_X,
  }
}

type Slot = ReturnType<typeof createSlot>

interface Scene {
  frame: (seconds: number) => void
}

function createScene(svg: SVGSVGElement): Scene {
  const scroll = attribute(part(svg, 'scroll'), 'transform')
  const slots: Slot[] = [...svg.querySelectorAll('[data-k=slot]')].map(createSlot)
  const nextNote = createLogoScore(Math.floor(Math.random() * SEED_RANGE))
  for (const slot of slots) slot.assign(nextNote())
  let elapsed = 0
  return {
    frame(seconds) {
      elapsed += seconds
      const beat = START_BEAT + elapsed / BEAT_SECONDS
      scroll(`translate(${(-beat * PX_PER_BEAT).toFixed(2)} 0)`)
      for (const slot of slots) {
        if (slot.isGone(beat)) slot.assign(nextNote())
        slot.update(beat, elapsed)
      }
    },
  }
}

interface Logo {
  svg: SVGSVGElement
  prefix: string
  scene: Scene | null
  reduced: boolean | null
  attached: boolean
  inView: boolean
}

const logos = new Set<Logo>()
const logoOf = new WeakMap<Element, Logo>()
let logoCount = 0
let frameHandle = 0
let lastFrameTime = 0
let viewObserver: IntersectionObserver | null = null

const isRunning = (logo: Logo) => logo.scene !== null && logo.inView && logo.svg.isConnected

function syncLoop(): void {
  const active = !document.hidden && [...logos].some(isRunning)
  if (active && !frameHandle) {
    lastFrameTime = performance.now()
    frameHandle = requestAnimationFrame(tick)
  } else if (!active && frameHandle) {
    cancelAnimationFrame(frameHandle)
    frameHandle = 0
  }
}

function release(logo: Logo): void {
  viewObserver?.unobserve(logo.svg)
  logos.delete(logo)
  logo.scene = null
  syncLoop()
}

function tick(now: number): void {
  frameHandle = requestAnimationFrame(tick)
  const seconds = Math.min(now - lastFrameTime, MAX_STEP_MS) / 1000
  lastFrameTime = now
  let ran = false
  for (const logo of logos) {
    if (!isRunning(logo)) continue
    logo.scene?.frame(seconds)
    ran = true
  }
  if (!ran) syncLoop()
}

function applyMotion(logo: Logo): void {
  const reduced = motionReduced()
  if (reduced === logo.reduced) return
  logo.reduced = reduced
  logo.svg.innerHTML = reduced ? staticLogoContent(logo.prefix) : animatedLogoContent(logo.prefix)
  logo.scene = reduced ? null : createScene(logo.svg)
}

function observeViews(entries: IntersectionObserverEntry[]): void {
  for (const { target, isIntersecting } of entries) {
    const logo = logoOf.get(target)
    if (!logo) continue
    if (target.isConnected) logo.attached = true
    else if (logo.attached) release(logo)
    logo.inView = isIntersecting && target.isConnected
  }
  syncLoop()
}

function startWatching(): IntersectionObserver {
  new MutationObserver(() => logos.forEach(applyMotion)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
  document.addEventListener('visibilitychange', syncLoop)
  return new IntersectionObserver(observeViews)
}

/** The brand logo: notes scroll under the clef and burn as they pass, a still frame when motion is reduced. */
export function createBrandLogo(className: string): SVGSVGElement {
  const svg = svgElement('svg', { viewBox: LOGO_VIEW_BOX, class: className, 'aria-hidden': 'true' })
  const logo: Logo = { svg, prefix: `brand-logo-${logoCount++}`, scene: null, reduced: null, attached: false, inView: false }
  applyMotion(logo)
  for (const other of logos) if (other.attached && !other.svg.isConnected) release(other)
  viewObserver ??= startWatching()
  logos.add(logo)
  logoOf.set(svg, logo)
  viewObserver.observe(svg)
  return svg
}
