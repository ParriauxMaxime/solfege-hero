import {
  FX_SMOKE_COUNT,
  FX_SMOKE_STAGGER_SECONDS,
  FX_SMOKE_TOTAL_SECONDS,
  FX_MAX_EMBERS,
  fxDefs,
  fxIntensity,
  fxParams,
  fxStillFrame,
  hotHeadMarkup,
  type FxEmberPath,
  type FxParams,
} from '../brand/streakFx'
import { FX_FROZEN_EMBERS, FX_LIVE_CAP, FX_RICH_CAP, fxLook, liveFxStart } from '../game/streakFxCaps'
import { motionReduced } from '../platform/appearance'
import { STAFF_VIEW_TOP, svgElement } from './glyphs'

const HEAD_SIZE = { rx: 12, ry: 8 }
const WAVE_XS = [-4, 4]
const COVER_REMOVE_MS = 220
const CLEANUP_MARGIN_MS = 150
const SMOKE_START_X = -5
const SMOKE_STEP_X = 5
const SMOKE_DRIFT_X = 4
const BREATHE_SECONDS = 1.6

let instances = 0

/** One burning note: its head overlay in the notes svg, and the css layers behind and in front of the svg. */
interface Burn {
  params: FxParams
  group: SVGGElement
  head: SVGGElement
  back: HTMLElement
  front: HTMLElement
  embers: HTMLElement
  waves: HTMLElement
}

export interface TimelineFx {
  /** Aura and shimmer layer, placed before the notes svg in the track (z-index -1). */
  behind: HTMLElement
  /** Flash, embers and smoke layer, placed after the notes svg. */
  front: HTMLElement
  /** Gradients for the hot heads and the heat waves, to insert once in the notes svg. */
  defs: string
  /** Pixels per staff unit, set again on resize only. */
  setScale: (scale: number) => void
  /** A first-try answer: the streak grows, every burning note gets hotter, `group` (the note) gets a hot head centred on (x, y). */
  hit: (index: number, group: SVGGElement, x: number, y: number) => void
  /** A mistake: auras fade, grey puffs rise, the heads cool back. */
  miss: () => void
  setCovered: (index: number, covered: boolean) => void
  drop: (index: number) => void
  destroy: () => void
}

const span = (className: string, vars: Record<string, string | number> = {}): HTMLSpanElement => {
  const element = document.createElement('span')
  element.className = className
  for (const [name, value] of Object.entries(vars)) element.style.setProperty(name, String(value))
  return element
}

const fixed = (value: number) => Number(value.toFixed(2))

const FROZEN = fxStillFrame(1, { embers: FX_MAX_EMBERS }).embers

function emberOf(path: FxEmberPath, index: number): HTMLSpanElement {
  const still = FROZEN[index]
  const ember = span(index < FX_FROZEN_EMBERS ? 'tl-ember' : 'tl-ember extra', {
    '--ex': fixed(path.x),
    '--ed': fixed(path.drift),
    '--er': fixed(path.rise),
    '--es': fixed(path.size),
    '--ep': `${fixed(path.period)}s`,
    '--epd': `${fixed(-path.phase * path.period)}s`,
    '--sx': still?.x ?? 0,
    '--sy': still?.y ?? 0,
    '--ss': still?.scale ?? 1,
    '--so': still?.opacity ?? 0,
  })
  return ember
}

function wavesOf(prefix: string, params: FxParams): HTMLSpanElement[] {
  return WAVE_XS.map((x, index) => {
    const duration = 1 / (0.55 + 0.15 * index)
    const wave = span('tl-wave', { '--wx': x, '--wd': `${fixed(duration)}s`, '--wdl': `${fixed(-(params.shimmer[0] / (2 * Math.PI) + index * 0.5) * duration)}s` })
    wave.innerHTML = `<svg viewBox="-6 -30 12 30" aria-hidden="true"><path d="M0 0C3 -5 -3 -10 0 -15S3 -25 0 -30" fill="none" stroke="url(#${prefix}-heatwave)" stroke-linecap="round" stroke-width="1.1"/></svg>`
    return wave
  })
}

export function createTimelineFx(root: HTMLElement): TimelineFx {
  const prefix = `tl-fx-${instances++}`
  const behind = span('timeline-fx timeline-fx-behind')
  const front = span('timeline-fx timeline-fx-front')
  const burning = new Map<number, Burn>()
  const timers = new Set<number>()
  let streak = 0
  let look = fxLook(0)

  const later = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timers.delete(timer)
      callback()
    }, delay)
    timers.add(timer)
  }

  function applyLook(): void {
    look = fxLook(fxIntensity(streak))
    const style = root.style
    style.setProperty('--fx-aura-s', String(fixed(look.auraScale)))
    style.setProperty('--fx-aura-o', String(fixed(look.auraOpacity)))
    style.setProperty('--fx-heat', String(fixed(look.heat)))
    style.setProperty('--fx-ember-o', String(fixed(look.emberOpacity)))
    style.setProperty('--fx-wave-o', String(fixed(look.waveOpacity)))
  }

  function topUp(burn: Burn): void {
    const paths = burn.params.embers
    for (let index = burn.embers.childElementCount; index < Math.min(look.embers, paths.length); index++) {
      const path = paths[index]
      if (path) burn.embers.append(emberOf(path, index))
    }
    if (!burn.waves.firstChild) burn.waves.append(...wavesOf(prefix, burn.params))
  }

  function refreshCaps(): void {
    const burns = [...burning.values()]
    const liveFrom = liveFxStart(burns.length, FX_LIVE_CAP)
    const richFrom = liveFxStart(burns.length, FX_RICH_CAP)
    burns.forEach((burn, position) => {
      burn.back.classList.toggle('live', position >= liveFrom)
      if (position >= richFrom) topUp(burn)
      else if (burn.embers.firstChild) {
        burn.embers.replaceChildren()
        burn.waves.replaceChildren()
      }
    })
  }

  function release(burn: Burn): void {
    burn.back.remove()
    burn.front.remove()
    burn.head.remove()
    burn.group.classList.remove('hot')
  }

  function placeLayer(x: number, y: number, layer: HTMLElement): HTMLSpanElement {
    const placed = span('tl-fx', { '--fx-x': fixed(x), '--fx-y': fixed(y - STAFF_VIEW_TOP) })
    layer.append(placed)
    return placed
  }

  function hit(index: number, group: SVGGElement, x: number, y: number): void {
    streak++
    applyLook()
    const previous = burning.get(index)
    if (previous) release(previous)
    const head = svgElement('g', { class: motionReduced() ? 'tl-hot' : 'tl-hot fresh', transform: `translate(${fixed(x)} ${fixed(y)})` })
    head.innerHTML = hotHeadMarkup(prefix, 'hollow', HEAD_SIZE)
    head.addEventListener('animationend', () => head.classList.remove('fresh'), { once: true })
    group.append(head)
    group.classList.add('hot')

    const params = fxParams(index + 1)
    const back = placeLayer(x, y, behind)
    back.style.setProperty('--fx-bp', `${fixed(BREATHE_SECONDS / params.shimmer[2])}s`)
    back.style.setProperty('--fx-bd', `${fixed(-(params.shimmer[0] / (2 * Math.PI)) * (BREATHE_SECONDS / params.shimmer[2]))}s`)
    back.innerHTML = '<span class="tl-aura"><span class="tl-aura-boost"><span class="tl-aura-glow"></span></span></span><span class="tl-waves"></span>'
    const waves = back.querySelector<HTMLElement>('.tl-waves') as HTMLElement
    const boost = back.querySelector<HTMLElement>('.tl-aura-boost') as HTMLElement
    boost.addEventListener('animationend', () => boost.classList.remove('lit'), { once: true })
    boost.classList.add('lit')

    const frontPlaced = placeLayer(x, y, front)
    const embers = span('tl-embers')
    frontPlaced.append(embers)
    if (!motionReduced()) {
      const flash = span('tl-flash')
      flash.addEventListener('animationend', () => flash.remove(), { once: true })
      frontPlaced.append(flash)
    }
    burning.set(index, { params, group, head, back, front: frontPlaced, embers, waves })
    refreshCaps()
  }

  function smokeOf(index: number): HTMLSpanElement {
    return span('tl-smoke', {
      '--sx': SMOKE_START_X + SMOKE_STEP_X * index,
      '--sd': SMOKE_DRIFT_X * (index - 1),
      '--smd': `${fixed(index * FX_SMOKE_STAGGER_SECONDS)}s`,
    })
  }

  function miss(): void {
    streak = 0
    applyLook()
    const reduced = motionReduced()
    const out = [...burning.values()]
    burning.clear()
    for (const burn of out) {
      if (reduced) {
        release(burn)
        continue
      }
      burn.back.classList.add('out')
      burn.front.classList.add('out')
      burn.group.classList.remove('hot')
      burn.head.classList.add('cooling')
      burn.front.append(...Array.from({ length: FX_SMOKE_COUNT }, (_, index) => smokeOf(index)))
    }
    if (out.length > 0 && !reduced) later(() => out.forEach(release), FX_SMOKE_TOTAL_SECONDS * 1000 + CLEANUP_MARGIN_MS)
  }

  function setCovered(index: number, covered: boolean): void {
    const burn = burning.get(index)
    if (!burn || burn.back.classList.contains('covered') === covered) return
    burn.back.classList.toggle('covered', covered)
    burn.front.classList.toggle('covered', covered)
    if (!covered) return
    burning.delete(index)
    later(() => release(burn), COVER_REMOVE_MS)
  }

  function drop(index: number): void {
    const burn = burning.get(index)
    if (!burn) return
    burning.delete(index)
    release(burn)
    refreshCaps()
  }

  return {
    behind,
    front,
    defs: fxDefs(prefix),
    setScale(scale) {
      root.style.setProperty('--u', `${scale}px`)
    },
    hit,
    miss,
    setCovered,
    drop,
    destroy() {
      for (const timer of timers) window.clearTimeout(timer)
      timers.clear()
      burning.clear()
      behind.replaceChildren()
      front.replaceChildren()
    },
  }
}
