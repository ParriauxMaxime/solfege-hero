import { describe, expect, it } from 'vitest'
import {
  FX_FULL_STREAK,
  FX_KIND_STRENGTH,
  FX_MAX_EMBERS,
  FX_SMOKE_TOTAL_SECONDS,
  fxBehindMarkup,
  fxDefs,
  fxFrame,
  fxFrontMarkup,
  fxHiddenFrame,
  fxIntensity,
  fxParams,
  fxStillFrame,
  hotHeadMarkup,
  hotNoteStatic,
  isLit,
  type FxFrameInput,
  type FxFrameValues,
} from './streakFx'

const params = fxParams(7)
const base: FxFrameInput = { seconds: 1, intensity: 0.5, alive: 1, snuff: -1, time: 3.3, kind: 'perfect' }
const frameAt = (input: Partial<FxFrameInput>) => fxFrame(params, { ...base, ...input })

const total = (values: FxFrameValues) =>
  values.aura.opacity + values.heat + values.flash.opacity + [...values.waves, ...values.embers, ...values.smokes].reduce((sum, part) => sum + part.opacity, 0)

/** Embers visible at some instant over a few seconds (an ember is momentarily invisible at the ends of its life). */
const emberCount = (intensity: number) => {
  let most = 0
  for (let seconds = 0.5; seconds < 3; seconds += 0.013) {
    most = Math.max(most, frameAt({ seconds, intensity, time: seconds }).embers.filter((ember) => ember.opacity > 0).length)
  }
  return most
}

describe('intensity', () => {
  it('stays in 0..1, grows with the streak and is full at 12', () => {
    let previous = -1
    for (let streak = -2; streak <= 40; streak++) {
      const value = fxIntensity(streak)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
    expect(fxIntensity(1)).toBe(0)
    expect(fxIntensity(FX_FULL_STREAK)).toBe(1)
    expect(fxIntensity(FX_FULL_STREAK + 5)).toBe(1)
  })

  it('is lit from a streak of 1', () => {
    expect(isLit(0)).toBe(false)
    expect(isLit(1)).toBe(true)
  })

  it('hits harder than a good one', () => {
    expect(FX_KIND_STRENGTH.perfect).toBeGreaterThan(FX_KIND_STRENGTH.good)
    expect(FX_KIND_STRENGTH.hit).toBe(1)
    expect(frameAt({ seconds: 0.05, kind: 'perfect' }).flash.opacity).toBeGreaterThan(frameAt({ seconds: 0.05, kind: 'good' }).flash.opacity)
    expect(frameAt({ seconds: 0.05, kind: 'perfect' }).heat).toBeGreaterThan(frameAt({ seconds: 0.05, kind: 'good' }).heat)
  })
})

describe('fxFrame', () => {
  it('draws nothing before the hit', () => {
    expect(total(frameAt({ seconds: -1 }))).toBe(0)
    expect(total(fxHiddenFrame())).toBe(0)
  })

  it('flashes only in the first 0.3 s', () => {
    expect(frameAt({ seconds: 0.05 }).flash.opacity).toBeGreaterThan(0)
    expect(frameAt({ seconds: 0.29 }).flash.opacity).toBeGreaterThan(0)
    expect(frameAt({ seconds: 0.3 }).flash.opacity).toBe(0)
    expect(frameAt({ seconds: 2 }).flash.opacity).toBe(0)
    expect(frameAt({ seconds: 0.2 }).flash.scale).toBeGreaterThan(frameAt({ seconds: 0.05 }).flash.scale)
  })

  it('grows the aura with the intensity', () => {
    const low = frameAt({ intensity: 0 }).aura
    const high = frameAt({ intensity: 1 }).aura
    expect(high.opacity).toBeGreaterThan(low.opacity)
    expect(high.scale).toBeGreaterThan(low.scale)
    expect(frameAt({ intensity: 1 }).heat).toBeGreaterThan(frameAt({ intensity: 0 }).heat)
  })

  it('puts aura, embers, waves and heat out with alive 0', () => {
    const dead = frameAt({ alive: 0, seconds: 0.05 })
    expect(dead.aura.opacity).toBe(0)
    expect(dead.heat).toBe(0)
    expect(dead.embers.every((ember) => ember.opacity === 0)).toBe(true)
    expect(dead.waves.every((wave) => wave.opacity === 0)).toBe(true)
  })

  it('smokes only after the snuff and clears within about a second', () => {
    expect(frameAt({ snuff: -1 }).smokes.every((smoke) => smoke.opacity === 0)).toBe(true)
    expect(frameAt({ snuff: 0.4, alive: 0 }).smokes.some((smoke) => smoke.opacity > 0)).toBe(true)
    expect(FX_SMOKE_TOTAL_SECONDS).toBeLessThan(1.1)
    expect(frameAt({ snuff: FX_SMOKE_TOTAL_SECONDS + 0.01, alive: 0 }).smokes.every((smoke) => smoke.opacity === 0)).toBe(true)
  })

  it('shows at most 6 embers and more of them as the intensity grows', () => {
    expect(emberCount(1)).toBeLessThanOrEqual(FX_MAX_EMBERS)
    expect(emberCount(1)).toBeGreaterThan(emberCount(0))
    expect(frameAt({}).embers).toHaveLength(FX_MAX_EMBERS)
  })

  it('keeps embers back during the first instants', () => {
    expect(frameAt({ seconds: 0.05, intensity: 1 }).embers.every((ember) => ember.opacity === 0)).toBe(true)
  })

  it('has no opacity outside 0..1', () => {
    for (let seconds = 0; seconds < 3; seconds += 0.07) {
      const values = frameAt({ seconds, intensity: 1, time: seconds * 2 })
      for (const opacity of [values.aura.opacity, values.heat, values.flash.opacity, ...values.waves.map((w) => w.opacity), ...values.embers.map((e) => e.opacity)]) {
        expect(opacity).toBeGreaterThanOrEqual(0)
        expect(opacity).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('fxParams', () => {
  it('is deterministic per seed and differs between seeds', () => {
    expect(fxParams(12)).toEqual(fxParams(12))
    expect(fxParams(12)).not.toEqual(fxParams(13))
    expect(fxParams(12).embers).toHaveLength(FX_MAX_EMBERS)
  })
})

describe('still frame and markup', () => {
  it('has no motion layers by default and respects the ember count', () => {
    const calm = fxStillFrame(0.5)
    expect(calm.aura.opacity).toBeGreaterThan(0)
    expect(calm.heat).toBeGreaterThan(0)
    expect(calm.flash.opacity + calm.embers.reduce((sum, part) => sum + part.opacity, 0) + calm.waves.reduce((sum, part) => sum + part.opacity, 0)).toBe(0)
    expect(fxStillFrame(1, { embers: 99 }).embers.filter((ember) => ember.opacity > 0)).toHaveLength(FX_MAX_EMBERS)
  })

  it('keeps every data-k a driver binds and each gradient it references defined', () => {
    const markup = `${fxDefs('t')}${fxBehindMarkup('t')}${hotHeadMarkup('t', 'filled', { rx: 9, ry: 6.5 })}${hotHeadMarkup('t', 'hollow', { rx: 12, ry: 8 })}${fxFrontMarkup('t')}`
    for (const key of ['smoke', 'aura', 'wave', 'flash', 'heat', 'ember']) expect(markup).toContain(`data-k="${key}"`)
    const defined = new Set([...markup.matchAll(/ id="([^"]+)"/g)].map(([, id]) => id))
    for (const [, id] of markup.matchAll(/url\(#([^)]+)\)/g)) expect(defined.has(id as string)).toBe(true)
  })

  it('draws static notes without filters or blur', () => {
    for (const shape of ['filled', 'hollow'] as const) {
      for (const detail of ['small', 'full'] as const) {
        const markup = hotNoteStatic('t', { shape, rx: 10, ry: 7, intensity: 0.8, detail })
        expect(markup).not.toMatch(/filter|blur/i)
        expect(markup).toContain('url(#t-aura)')
        expect(markup).not.toContain('NaN')
      }
    }
    expect(fxDefs('t')).not.toMatch(/filter|blur/i)
  })

  it('makes small statics simpler than full ones', () => {
    const small = hotNoteStatic('t', { shape: 'filled', rx: 10, ry: 7, intensity: 1, detail: 'small' })
    const full = hotNoteStatic('t', { shape: 'filled', rx: 10, ry: 7, intensity: 1, detail: 'full' })
    expect(`${small}${full}`).not.toContain('heatwave')
    expect(small.match(/t-ember/g)?.length ?? 0).toBeLessThanOrEqual(2)
    expect(full.length).toBeGreaterThan(small.length)
  })
})
