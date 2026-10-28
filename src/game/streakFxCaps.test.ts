import { describe, expect, it } from 'vitest'
import { FX_LIVE_CAP, FX_RICH_CAP, fxLook, liveFxStart } from './streakFxCaps'

describe('liveFxStart', () => {
  it('keeps everything live under the cap', () => {
    expect(liveFxStart(0, 6)).toBe(0)
    expect(liveFxStart(6, 6)).toBe(0)
  })

  it('points at the first of the newest `cap` notes', () => {
    expect(liveFxStart(9, 6)).toBe(3)
    expect(liveFxStart(9, 4)).toBe(5)
  })

  it('has a richer set inside the live set', () => {
    expect(FX_RICH_CAP).toBeLessThan(FX_LIVE_CAP)
  })
})

describe('fxLook', () => {
  it('grows with the intensity', () => {
    const low = fxLook(0)
    const high = fxLook(1)
    expect(high.auraScale).toBeGreaterThan(low.auraScale)
    expect(high.auraOpacity).toBeGreaterThan(low.auraOpacity)
    expect(high.heat).toBeGreaterThan(low.heat)
    expect(high.embers).toBeGreaterThan(low.embers)
    expect(high.emberOpacity).toBeGreaterThan(low.emberOpacity)
    expect(high.waveOpacity).toBeGreaterThan(low.waveOpacity)
  })

  it('matches the playground numbers at both ends', () => {
    expect(fxLook(0).auraScale).toBeCloseTo(18 / 20)
    expect(fxLook(1).auraScale).toBeCloseTo(31 / 20)
    expect(fxLook(0).embers).toBe(2)
    expect(fxLook(1).embers).toBe(6)
    expect(fxLook(1).heat).toBe(1)
  })

  it('clamps out-of-range intensities', () => {
    expect(fxLook(-3)).toEqual(fxLook(0))
    expect(fxLook(5)).toEqual(fxLook(1))
  })
})
