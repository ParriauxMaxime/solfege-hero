import { describe, expect, it } from 'vitest'
import type { DayRecord, History } from './history'
import { metricsFor, progressionPoints, windowSummary } from './progression'

function record(overrides: Partial<DayRecord> = {}): DayRecord {
  return { answered: 0, correct: 0, totalMs: 0, timed: 0, games: 0, best: 0, ...overrides }
}

describe('metricsFor', () => {
  it('lists the charted metrics per mode', () => {
    expect(metricsFor('learn')).toEqual(['precision', 'meanMs'])
    expect(metricsFor('keys')).toEqual(['precision', 'meanMs'])
    expect(metricsFor('series')).toEqual(['best'])
    expect(metricsFor('survival')).toEqual(['best'])
    expect(metricsFor('hero')).toEqual(['best'])
  })
})

describe('progressionPoints', () => {
  const history: History = {
    '2026-10-24': { learn: record({ answered: 10, correct: 8, totalMs: 9000, timed: 9 }) },
    '2026-10-25': { learn: record({ answered: 4, correct: 4 }), series: record({ games: 1, best: 0 }) },
  }

  it('computes precision and leaves gaps as null', () => {
    expect(progressionPoints(history, 'learn', 'precision', '2026-10-25', 3)).toEqual([
      { day: '2026-10-23', value: null },
      { day: '2026-10-24', value: 80 },
      { day: '2026-10-25', value: 100 },
    ])
  })

  it('computes mean time over timed prompts only', () => {
    const values = progressionPoints(history, 'learn', 'meanMs', '2026-10-25', 2).map((point) => point.value)
    expect(values).toEqual([1000, null])
  })

  it('treats a zero best as no value for time modes', () => {
    const values = progressionPoints(history, 'series', 'best', '2026-10-25', 2).map((point) => point.value)
    expect(values).toEqual([null, null])
  })

  it('keeps a zero score once a game was played', () => {
    const scores: History = { '2026-10-25': { hero: record({ games: 1, best: 0 }) } }
    expect(progressionPoints(scores, 'hero', 'best', '2026-10-25', 1)).toEqual([{ day: '2026-10-25', value: 0 }])
    expect(progressionPoints({}, 'hero', 'best', '2026-10-25', 1)).toEqual([{ day: '2026-10-25', value: null }])
  })
})

describe('windowSummary', () => {
  const history: History = {
    '2026-10-18': { learn: record({ answered: 10, correct: 5, totalMs: 20000, timed: 10 }) },
    '2026-10-24': { learn: record({ answered: 10, correct: 8, totalMs: 10000, timed: 10 }) },
    '2026-10-25': { learn: record({ answered: 30, correct: 24, totalMs: 30000, timed: 30 }) },
  }

  it('pools precision and computes the delta', () => {
    const summary = windowSummary(history, 'learn', 'precision', '2026-10-25', 7)
    expect(summary.current).toBeCloseTo(80)
    expect(summary.previous).toBeCloseTo(50)
    expect(summary.delta).toBeCloseTo(30)
  })

  it('pools mean time', () => {
    const summary = windowSummary(history, 'learn', 'meanMs', '2026-10-25', 7)
    expect(summary.current).toBe(1000)
    expect(summary.previous).toBe(2000)
    expect(summary.delta).toBe(-1000)
  })

  it('has no delta when a window is empty', () => {
    const summary = windowSummary(history, 'learn', 'precision', '2026-10-25', 1)
    expect(summary).toMatchObject({ current: 80, previous: 80 })
    expect(windowSummary(history, 'keys', 'precision', '2026-10-25', 7)).toEqual({
      current: null,
      previous: null,
      delta: null,
    })
  })

  it('takes min for time bests and max for scores', () => {
    const bests: History = {
      '2026-10-24': { series: record({ best: 5000 }), hero: record({ games: 1, best: 100 }) },
      '2026-10-25': { series: record({ best: 4000 }), hero: record({ games: 1, best: 300 }) },
      '2026-10-20': { series: record({ best: 6000 }), hero: record({ games: 1, best: 50 }) },
    }
    expect(windowSummary(bests, 'series', 'best', '2026-10-25', 3)).toEqual({ current: 4000, previous: 6000, delta: -2000 })
    expect(windowSummary(bests, 'hero', 'best', '2026-10-25', 3)).toEqual({ current: 300, previous: 50, delta: 250 })
    expect(windowSummary(bests, 'series', 'best', '2026-10-25', 2)).toEqual({ current: 4000, previous: null, delta: null })
  })
})
