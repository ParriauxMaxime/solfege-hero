import { describe, expect, it } from 'vitest'
import { dayTotals, isPlayedDay, overview } from './aggregate'
import type { DayRecord, History } from './history'

function record(overrides: Partial<DayRecord> = {}): DayRecord {
  return { answered: 0, correct: 0, totalMs: 0, timed: 0, games: 0, best: 0, ...overrides }
}

const played = { learn: record({ answered: 10, correct: 8 }) }

describe('dayTotals', () => {
  it('sums over modes', () => {
    const day = { learn: record({ answered: 10, correct: 8 }), keys: record({ answered: 5, correct: 5 }) }
    expect(dayTotals(day)).toEqual({ answered: 15, correct: 13 })
  })

  it('is zero for a missing day', () => {
    expect(dayTotals(undefined)).toEqual({ answered: 0, correct: 0 })
  })
})

describe('isPlayedDay', () => {
  it('counts answers or games', () => {
    expect(isPlayedDay(played)).toBe(true)
    expect(isPlayedDay({ hero: record({ games: 1 }) })).toBe(true)
    expect(isPlayedDay({ hero: record() })).toBe(false)
    expect(isPlayedDay(undefined)).toBe(false)
  })
})

describe('overview', () => {
  const history: History = {
    '2026-10-18': played,
    '2026-10-19': played,
    '2026-10-20': played,
    '2026-10-21': { learn: record() },
    '2026-10-23': played,
    '2026-10-24': played,
  }

  it('keeps the streak alive until today is over', () => {
    expect(overview(history, '2026-10-25')).toEqual({ answered: 50, daysPlayed: 5, currentStreak: 2, bestStreak: 3 })
  })

  it('extends the streak when today is played', () => {
    const withToday = { ...history, '2026-10-25': played }
    expect(overview(withToday, '2026-10-25').currentStreak).toBe(3)
  })

  it('resets the streak after a missed day', () => {
    expect(overview(history, '2026-10-26').currentStreak).toBe(0)
  })

  it('handles empty history', () => {
    expect(overview({}, '2026-10-25')).toEqual({ answered: 0, daysPlayed: 0, currentStreak: 0, bestStreak: 0 })
  })
})
