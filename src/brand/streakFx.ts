export const FX_FULL_STREAK = 12
export const FX_MAX_EMBERS = 6
export const FX_WAVE_COUNT = 2
export const FX_SMOKE_COUNT = 3
export const FX_FLASH_SECONDS = 0.3
export const FX_SNUFF_SECONDS = 0.4
export const FX_SMOKE_SECONDS = 0.9
export const FX_SMOKE_STAGGER_SECONDS = 0.08
export const FX_SMOKE_TOTAL_SECONDS = FX_SMOKE_SECONDS + FX_SMOKE_STAGGER_SECONDS * (FX_SMOKE_COUNT - 1)

export type FxKind = 'hit' | 'perfect' | 'good'

/** Strength of the hit flash and of the heat boost right after the hit. */
export const FX_KIND_STRENGTH: Record<FxKind, number> = { hit: 1, perfect: 1, good: 0.7 }

export type FxGold = [light: string, mid: string, dark: string]

export const FX_GOLD: FxGold = ['var(--logo-gold-1, #fff3c4)', 'var(--logo-gold-2, #ffc24a)', 'var(--logo-gold-3, #f0a020)']
export const FX_RIM = 'var(--logo-stem-lit, #fffbe6)'
export const FX_SMOKE = 'var(--smoke, #b8b2ac)'

const AURA_STRENGTH = 1.25
const AURA_RADIUS_BASE = 18
const AURA_RADIUS_EXTRA = 13
const AURA_GRADIENT_RADIUS = 20
const HEAT_STRENGTH = 1
const HIT_BOOST = 0.7
const HIT_BOOST_SECONDS = 0.45
const HEAT_BOOST = 0.5
const HEAT_BOOST_SECONDS = 0.35
const EMBER_DELAY_SECONDS = 0.12
const FLASH_GROWTH = 1.7
export const FX_WAVE_OPACITY = 0.75
const WAVE_OPACITY = FX_WAVE_OPACITY

const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value))
const span = (from: number, length: number, at: number) => clamp((at - from) / length)

/** 0 at a streak of 1, 1 from FX_FULL_STREAK on. A streak of 0 is unlit: check `isLit` first. */
export function fxIntensity(streak: number): number {
  return clamp((streak - 1) / (FX_FULL_STREAK - 1))
}

export const isLit = (streak: number) => streak >= 1

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), state | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

export interface FxEmberPath {
  period: number
  phase: number
  x: number
  drift: number
  rise: number
  size: number
  wiggle: number
}

export interface FxParams {
  embers: FxEmberPath[]
  /** Two phases (radians) and two rates (Hz) of the aura breathing, the first phase also offsets the heat waves. */
  shimmer: [phaseA: number, phaseB: number, rateA: number, rateB: number]
}

/** Per-hit randomness, same seed same look. */
export function fxParams(seed: number): FxParams {
  const random = mulberry32(seed)
  const embers = Array.from({ length: FX_MAX_EMBERS }, () => ({
    period: 0.8 + random() * 0.7,
    phase: random(),
    x: (random() - 0.5) * 12,
    drift: (random() - 0.5) * 14,
    rise: 22 + random() * 22,
    size: 0.6 + random() * 0.9,
    wiggle: random() * Math.PI * 2,
  }))
  const shimmer: FxParams['shimmer'] = [random() * Math.PI * 2, random() * Math.PI * 2, 0.7 + random() * 0.6, 1.3 + random() * 0.9]
  return { embers, shimmer }
}

export interface FxFrameInput {
  /** Seconds since the hit, negative when the note is not hit yet. */
  seconds: number
  intensity: number
  /** 1 while burning, falls to 0 while a miss puts the streak out. */
  alive: number
  /** Seconds since the miss that snuffs the fire, -1 when none. */
  snuff: number
  /** Global clock in seconds (drives the shimmer and the wave phases). */
  time: number
  kind: FxKind
}

/** Note-local placement and opacity of one element; `scale` is the vertical scale only for waves. */
export interface FxPart {
  opacity: number
  x: number
  y: number
  scale: number
}

export interface FxFrameValues {
  aura: { opacity: number; scale: number }
  heat: number
  flash: { opacity: number; scale: number }
  waves: FxPart[]
  embers: FxPart[]
  smokes: FxPart[]
}

const hiddenPart = (): FxPart => ({ opacity: 0, x: 0, y: 0, scale: 1 })

export function fxHiddenFrame(): FxFrameValues {
  return {
    aura: { opacity: 0, scale: 1 },
    heat: 0,
    flash: { opacity: 0, scale: 1 },
    waves: Array.from({ length: FX_WAVE_COUNT }, hiddenPart),
    embers: Array.from({ length: FX_MAX_EMBERS }, hiddenPart),
    smokes: Array.from({ length: FX_SMOKE_COUNT }, hiddenPart),
  }
}

const auraScale = (intensity: number) => (AURA_RADIUS_BASE + AURA_RADIUS_EXTRA * intensity) / AURA_GRADIENT_RADIUS
const baseAura = (intensity: number) => AURA_STRENGTH * (0.3 + 0.7 * intensity)
const baseHeat = (intensity: number) => HEAT_STRENGTH * (0.25 + 0.75 * intensity)
export const emberCount = (intensity: number) => Math.round(FX_MAX_EMBERS * (0.3 + 0.7 * intensity))

function smokeParts(snuff: number): FxPart[] {
  return Array.from({ length: FX_SMOKE_COUNT }, (_, index) => {
    const u = snuff >= 0 ? span(FX_SMOKE_STAGGER_SECONDS * index, FX_SMOKE_SECONDS, snuff) : 0
    if (u <= 0 || u >= 1) return hiddenPart()
    return {
      opacity: Math.sin(Math.PI * u) ** 0.7 * 0.9,
      x: -5 + 5 * index + 4 * u * (index - 1),
      y: -4 - 30 * u,
      scale: 1 + 2.4 * u,
    }
  })
}

/** Everything the E2 aura draws at one instant, in note-local units. Pure: the driver only applies it. */
export function fxFrame(params: FxParams, { seconds, intensity: rawIntensity, alive: rawAlive, snuff, time, kind }: FxFrameInput): FxFrameValues {
  const frame = fxHiddenFrame()
  frame.smokes = smokeParts(snuff)
  if (seconds < 0) return frame
  const intensity = clamp(rawIntensity)
  const alive = clamp(rawAlive)
  const strength = FX_KIND_STRENGTH[kind]
  const [phaseA, phaseB, rateA, rateB] = params.shimmer
  const noise = 0.5 + 0.25 * Math.sin(time * rateA * 2 * Math.PI + phaseA) + 0.25 * Math.sin(time * rateB * 2 * Math.PI + phaseB)
  const hitBoost = HIT_BOOST * strength * (1 - span(0, HIT_BOOST_SECONDS, seconds))

  const auraOpacity = clamp((baseAura(intensity) * (0.85 + 0.15 * noise) + hitBoost) * alive)
  frame.aura = { opacity: auraOpacity, scale: auraScale(intensity) * (0.95 + 0.08 * noise) * (1 + 0.25 * hitBoost) }
  frame.heat = clamp((baseHeat(intensity) + HEAT_BOOST * strength * (1 - span(0, HEAT_BOOST_SECONDS, seconds))) * alive)

  if (seconds < FX_FLASH_SECONDS) {
    const u = seconds / FX_FLASH_SECONDS
    frame.flash = { opacity: (1 - u) * strength, scale: 1 + FLASH_GROWTH * u }
  }

  if (alive > 0) {
    frame.waves = frame.waves.map((_, index) => {
      const u = (time * (0.55 + 0.15 * index) + index * 0.5 + phaseA) % 1
      return {
        opacity: Math.sin(Math.PI * u) * WAVE_OPACITY * (0.25 + 0.45 * intensity) * alive,
        x: Math.sin(time * 3 + index) * 1.2,
        y: -8 - 16 * u,
        scale: 0.7 + 0.5 * u,
      }
    })
    if (seconds >= EMBER_DELAY_SECONDS) {
      const visible = emberCount(intensity)
      frame.embers = params.embers.slice(0, FX_MAX_EMBERS).map((path, index) => {
        if (index >= visible) return hiddenPart()
        const u = ((seconds - EMBER_DELAY_SECONDS) / path.period + path.phase) % 1
        return {
          opacity: Math.sin(Math.PI * u) ** 0.8 * (0.5 + 0.5 * intensity) * alive,
          x: path.x + path.drift * u + 1.5 * Math.sin(u * 6 + path.wiggle),
          y: -6 - path.rise * u,
          scale: path.size * (1 - 0.5 * u),
        }
      })
    }
  }
  return frame
}

const STILL_EMBERS: readonly FxPart[] = [
  { opacity: 0.9, x: 5, y: -18, scale: 1 },
  { opacity: 0.75, x: -6, y: -27, scale: 0.8 },
  { opacity: 0.8, x: 9, y: -35, scale: 0.7 },
  { opacity: 0.6, x: -3, y: -42, scale: 0.6 },
  { opacity: 0.55, x: -10, y: -21, scale: 0.7 },
  { opacity: 0.5, x: 2, y: -49, scale: 0.5 },
]

/** The aura without any motion (reduced motion, static art): halo and heat at the intensity, a few frozen embers and waves on request. */
export function fxStillFrame(intensity: number, { embers = 0, waves = false }: { embers?: number; waves?: boolean } = {}): FxFrameValues {
  const level = clamp(intensity)
  const frame = fxHiddenFrame()
  frame.aura = { opacity: clamp(baseAura(level) * 0.925), scale: auraScale(level) }
  frame.heat = clamp(baseHeat(level))
  if (waves) {
    frame.waves = frame.waves.map((_, index) => ({ opacity: WAVE_OPACITY * 0.5 * (0.25 + 0.45 * level), x: 0, y: -16 - 4 * index, scale: 1 }))
  }
  STILL_EMBERS.slice(0, Math.min(embers, FX_MAX_EMBERS)).forEach((ember, index) => {
    frame.embers[index] = { ...ember, opacity: ember.opacity * (0.5 + 0.5 * level) }
  })
  return frame
}

const stops = (list: [offset: number, color: string, opacity?: number][]) =>
  list.map(([offset, color, opacity = 1]) => `<stop offset="${offset}" style="stop-color:${color}" stop-opacity="${opacity}"/>`).join('')

export interface FxDefsOptions {
  gold?: FxGold
  /** Smoke tint: a css variable by default, pass a literal colour for renderers without `var()`. */
  smoke?: string
}

/** Gradients used by the markup below; ids are `<prefix>-gold|hfill|bevel|spec|heat|aura|ember|smoke|heatwave`. */
export function fxDefs(prefix: string, { gold = FX_GOLD, smoke = FX_SMOKE }: FxDefsOptions = {}): string {
  return `<defs>
  <linearGradient id="${prefix}-gold" x1="0" y1="0" x2="0" y2="1">${stops([[0, gold[0]], [0.45, gold[1]], [1, gold[2]]])}</linearGradient>
  <radialGradient id="${prefix}-hfill" cx="0.36" cy="0.3" r="0.78">${stops([[0, '#fff8dc'], [0.32, '#ffcf5a'], [0.72, '#f0a020'], [1, '#b06508']])}</radialGradient>
  <radialGradient id="${prefix}-bevel" cx="0.42" cy="0.36" r="0.66">${stops([[0.72, '#5a2a00', 0], [1, '#5a2a00', 1]])}</radialGradient>
  <radialGradient id="${prefix}-spec">${stops([[0, '#ffffff'], [1, '#ffffff', 0]])}</radialGradient>
  <radialGradient id="${prefix}-heat" cx="0.45" cy="0.42" r="0.6">${stops([[0, '#ffffff'], [0.45, '#fffbe6', 0.85], [0.8, '#ffe7a8', 0.25], [1, '#ffe7a8', 0]])}</radialGradient>
  <radialGradient id="${prefix}-aura">${stops([[0, '#fffbe6', 0.9], [0.16, '#ffe08a', 0.75], [0.36, '#ffa21f', 0.45], [0.6, '#f05a14', 0.2], [0.82, '#9a1c0c', 0.07], [1, '#5a0f04', 0]])}</radialGradient>
  <radialGradient id="${prefix}-ember">${stops([[0, '#fffbe6'], [0.4, '#ffc24a'], [0.75, '#f2601a', 0.6], [1, '#a81e0c', 0]])}</radialGradient>
  <radialGradient id="${prefix}-smoke">${stops([[0, smoke, 0.85], [0.55, smoke, 0.45], [1, smoke, 0]])}</radialGradient>
  <linearGradient id="${prefix}-heatwave" x1="0" y1="1" x2="0" y2="0">${stops([[0, '#ffc25a', 0], [0.25, '#ffb347'], [0.65, '#ff8a1f', 0.7], [1, '#ff6a14', 0]])}</linearGradient>
</defs>`
}

const WAVE_XS = [-4, 4]

/** Layers drawn behind the glyph, centred on the note head (data-k: smokes/smoke, aura, shimmer/wave, flash). */
export function fxBehindMarkup(prefix: string): string {
  const smokes = Array.from({ length: FX_SMOKE_COUNT }, () => `<circle data-k="smoke" r="5" fill="url(#${prefix}-smoke)" opacity="0"/>`).join('')
  const waves = WAVE_XS.map((x) => `<path data-k="wave" d="M${x} 0C${x + 3} -5 ${x - 3} -10 ${x} -15S${x + 3} -25 ${x} -30" opacity="0"/>`).join('')
  return `<g stroke="none"><g data-k="smokes">${smokes}</g>
  <circle data-k="aura" r="${AURA_GRADIENT_RADIUS}" fill="url(#${prefix}-aura)" opacity="0"/>
  <g data-k="shimmer" fill="none" stroke="url(#${prefix}-heatwave)" stroke-linecap="round" stroke-width="1.1">${waves}</g>
  <circle data-k="flash" r="10" fill="none" stroke="#fff3c4" stroke-width="2" opacity="0"/></g>`
}

/** Embers drawn above the head (data-k: ember). */
export function fxFrontMarkup(prefix: string): string {
  const embers = Array.from({ length: FX_MAX_EMBERS }, () => `<circle data-k="ember" r="1.2" fill="url(#${prefix}-ember)" opacity="0"/>`).join('')
  return `<g stroke="none">${embers}</g>`
}

const HOLLOW_HEAD = 'M-12 0 A12 8 0 1 0 12 0 A12 8 0 1 0 -12 0 Z M-4 -5.7 A7 4.2 55 1 0 4 5.7 A7 4.2 55 1 0 -4 -5.7 Z'
const HOLLOW_RX = 12
const HOLLOW_RY = 8
const FILLED_TILT = -20
const HOLLOW_TILT = -15

export interface HotHeadOptions {
  rx: number
  ry: number
  /** Degrees, defaults to the engraving tilt of the shape. */
  tilt?: number
  /** Outline of the filled head. */
  rim?: string
  /** Opacity of the heat overlay written in the markup (animated heads start at 0). */
  heat?: number
}

/** Gold head with a white-hot overlay (data-k="heat"), drawn over the plain glyph head. The hollow head scales its two ellipses to rx/ry. */
export function hotHeadMarkup(prefix: string, shape: 'filled' | 'hollow', { rx, ry, tilt, rim = FX_RIM, heat = 0 }: HotHeadOptions): string {
  if (shape === 'hollow') {
    const scale = rx === HOLLOW_RX && ry === HOLLOW_RY ? '' : ` scale(${rx / HOLLOW_RX} ${ry / HOLLOW_RY})`
    return `<g stroke="none" transform="rotate(${tilt ?? HOLLOW_TILT})${scale}"><path d="${HOLLOW_HEAD}" fill="url(#${prefix}-gold)" fill-rule="evenodd"/><path d="${HOLLOW_HEAD}" fill="url(#${prefix}-hfill)" fill-rule="evenodd"/>
  <ellipse cx="-5" cy="-4" rx="4" ry="1.6" fill="url(#${prefix}-spec)" opacity="0.8"/><path data-k="heat" d="${HOLLOW_HEAD}" fill="url(#${prefix}-heat)" fill-rule="evenodd" opacity="${heat}"/></g>`
  }
  const size = `rx="${rx}" ry="${ry}"`
  return `<g stroke="none" transform="rotate(${tilt ?? FILLED_TILT})"><ellipse ${size} fill="url(#${prefix}-gold)"/><ellipse ${size} fill="url(#${prefix}-hfill)"/>
  <ellipse ${size} fill="url(#${prefix}-bevel)" opacity="0.5"/><ellipse cx="${-rx * 0.34}" cy="${-ry * 0.42}" rx="${rx * 0.36}" ry="${ry * 0.2}" fill="url(#${prefix}-spec)" opacity="0.9"/>
  <ellipse data-k="heat" ${size} fill="url(#${prefix}-heat)" opacity="${heat}"/>
  <ellipse ${size} fill="none" stroke="${rim}" stroke-width="0.8" opacity="0.85"/></g>`
}

export interface HotNoteStaticOptions extends Omit<HotHeadOptions, 'heat'> {
  shape: 'filled' | 'hollow'
  intensity: number
  /** `small` (favicons): halo and head, at most 2 embers. `full`: up to 4 embers. No frozen heat waves: still, they read as smoke. */
  detail: 'small' | 'full'
}

const num = (value: number) => Number(value.toFixed(2))
const partTransform = ({ x, y, scale }: FxPart) => `translate(${num(x)} ${num(y)}) scale(${num(scale)})`

/** A lit note at rest, centred on its head: aura, hot head and frozen embers. Needs `fxDefs(prefix)` in the same document. */
export function hotNoteStatic(prefix: string, { shape, intensity, detail, ...head }: HotNoteStaticOptions): string {
  const level = clamp(intensity)
  const small = detail === 'small'
  const frame = fxStillFrame(level, { embers: small ? Math.round(2 * level) : Math.min(4, emberCount(level)) })
  const embers = frame.embers
    .filter((ember) => ember.opacity > 0)
    .map((ember) => `<circle r="1.2" fill="url(#${prefix}-ember)" transform="${partTransform(ember)}" opacity="${num(ember.opacity)}"/>`)
    .join('')
  return `<g stroke="none"><circle r="${AURA_GRADIENT_RADIUS}" fill="url(#${prefix}-aura)" transform="scale(${num(frame.aura.scale)})" opacity="${num(frame.aura.opacity)}"/>
  ${hotHeadMarkup(prefix, shape, { ...head, heat: num(frame.heat) })}${embers}</g>`
}
