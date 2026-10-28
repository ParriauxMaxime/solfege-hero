import { describe, expect, it } from 'vitest'
import { FLAME_FULL_STREAK, heroFlameScale, liveFlameStart, streakFlameScale, streakRelief } from './streakFlame'

describe('streakFlameScale', () => {
  it('is 0 without a streak', () => {
    expect(streakFlameScale(0)).toBe(0)
    expect(streakFlameScale(-3)).toBe(0)
  })

  it('is subtle at 1 and 2, clearly burning at 5, full at 12 and capped above', () => {
    expect(streakFlameScale(1)).toBeCloseTo(0.4)
    expect(streakFlameScale(2)).toBeLessThan(0.5)
    expect(streakFlameScale(5)).toBeGreaterThanOrEqual(0.6)
    expect(streakFlameScale(FLAME_FULL_STREAK)).toBe(1)
    expect(streakFlameScale(40)).toBe(1)
  })

  it('never shrinks as the streak grows', () => {
    for (let streak = 0; streak < 20; streak++) {
      expect(streakFlameScale(streak + 1)).toBeGreaterThanOrEqual(streakFlameScale(streak))
    }
  })
})

describe('heroFlameScale', () => {
  it('burns bien less than parfait and never burns a miss', () => {
    expect(heroFlameScale(8, 'bien')).toBeLessThan(heroFlameScale(8, 'parfait'))
    expect(heroFlameScale(8, 'bien')).toBeGreaterThan(0)
    expect(heroFlameScale(8, 'parfait')).toBe(streakFlameScale(8))
    expect(heroFlameScale(8, 'rate')).toBe(0)
  })
})

describe('streakRelief', () => {
  it('switches to the strong relief at 5', () => {
    expect(streakRelief(1)).toBe(1)
    expect(streakRelief(4)).toBe(1)
    expect(streakRelief(5)).toBe(2)
    expect(streakRelief(30)).toBe(2)
  })
})

describe('liveFlameStart', () => {
  it('keeps the newest flames flickering', () => {
    expect(liveFlameStart(0)).toBe(0)
    expect(liveFlameStart(3)).toBe(0)
    expect(liveFlameStart(6)).toBe(0)
    expect(liveFlameStart(10)).toBe(4)
    expect(liveFlameStart(10, 4)).toBe(6)
  })
})
