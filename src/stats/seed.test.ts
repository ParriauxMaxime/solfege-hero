import { describe, expect, it } from 'vitest'
import { seededRandom } from '../random'
import { sanitizeHistory, sanitizeNoteHistory, MAX_HISTORY_DAYS } from './history'
import { seedHistory } from './seed'

describe('seedHistory', () => {
  const today = '2026-10-24'

  it('is deterministic for a seed', () => {
    expect(seedHistory(today, 60, seededRandom(1))).toEqual(seedHistory(today, 60, seededRandom(1)))
    expect(seedHistory(today, 60, seededRandom(1))).not.toEqual(seedHistory(today, 60, seededRandom(2)))
  })

  it('covers about 60 days with most of them played and survives sanitising unchanged', () => {
    const { history, noteHistory } = seedHistory(today)
    const played = Object.keys(history).length
    expect(played).toBeGreaterThan(30)
    expect(played).toBeLessThanOrEqual(60)
    expect(Object.keys(history).length).toBeLessThanOrEqual(MAX_HISTORY_DAYS)
    expect(sanitizeHistory(history)).toEqual(history)
    expect(sanitizeNoteHistory(noteHistory)).toEqual(noteHistory)
  })

  it('keeps answers in the plausible range and precision improving', () => {
    const { history } = seedHistory(today)
    const days = Object.keys(history).sort()
    for (const day of days) {
      const learn = history[day]?.learn
      expect(learn?.answered).toBeGreaterThanOrEqual(10)
      expect(learn?.answered).toBeLessThanOrEqual(200)
    }
    const precision = (slice: string[]) => {
      const records = slice.flatMap((day) => history[day]?.learn ?? [])
      return records.reduce((sum, r) => sum + r.correct, 0) / records.reduce((sum, r) => sum + r.answered, 0)
    }
    expect(precision(days.slice(-15))).toBeGreaterThan(precision(days.slice(0, 15)))
  })
})
