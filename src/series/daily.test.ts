import { describe, expect, it } from 'vitest'
import {
  dailyConfig,
  dailyKey,
  dailyLabel,
  dailyStreak,
  encodeDailyHash,
  isDailyKey,
  parseDailyHash,
} from './daily'
import { SERIES_LENGTH, generateSeries } from './series'

describe('dailyKey', () => {
  it('uses the calendar day in Paris', () => {
    expect(dailyKey(new Date('2026-10-24T12:00:00Z'))).toBe('20261024')
  })

  it('rolls over at Paris midnight, not UTC midnight, in winter (UTC+1)', () => {
    expect(dailyKey(new Date('2026-01-10T22:59:59Z'))).toBe('20260110')
    expect(dailyKey(new Date('2026-01-10T23:00:00Z'))).toBe('20260111')
  })

  it('rolls over at Paris midnight in summer (UTC+2)', () => {
    expect(dailyKey(new Date('2026-07-10T21:59:59Z'))).toBe('20260710')
    expect(dailyKey(new Date('2026-07-10T22:00:00Z'))).toBe('20260711')
  })

  it('follows the daylight saving changes', () => {
    expect(dailyKey(new Date('2026-03-28T23:30:00Z'))).toBe('20260329')
    expect(dailyKey(new Date('2026-03-29T21:59:59Z'))).toBe('20260329')
    expect(dailyKey(new Date('2026-03-29T22:00:00Z'))).toBe('20260330')
    expect(dailyKey(new Date('2026-10-24T22:00:00Z'))).toBe('20261025')
    expect(dailyKey(new Date('2026-10-25T22:59:59Z'))).toBe('20261025')
    expect(dailyKey(new Date('2026-10-25T23:00:00Z'))).toBe('20261026')
  })

  it('crosses the new year in Paris time', () => {
    expect(dailyKey(new Date('2026-12-31T23:00:00Z'))).toBe('20270101')
  })
})

describe('dailyLabel and hash', () => {
  it('formats the label day first', () => {
    expect(dailyLabel('20261024')).toBe('24/10/2026')
  })

  it('round-trips through the hash', () => {
    expect(encodeDailyHash('20261024')).toBe('daily=20261024')
    expect(parseDailyHash('#daily=20261024')).toBe('20261024')
    expect(parseDailyHash('daily=20261024')).toBe('20261024')
  })

  it('rejects junk and impossible dates', () => {
    for (const hash of ['', '#', '#daily=', '#daily=2026102', '#daily=202610245', '#daily=abcdefgh', '#daily=20261301', '#daily=20260230', '#daily=20261032', '#s=1234&c=sol']) {
      expect(parseDailyHash(hash)).toBeNull()
    }
    expect(parseDailyHash('#daily=20240229')).toBe('20240229')
    expect(parseDailyHash('#daily=20230229')).toBeNull()
  })

  it('validates keys', () => {
    expect(isDailyKey('20261024')).toBe(true)
    expect(isDailyKey('20260431')).toBe(false)
    expect(isDailyKey(20261024)).toBe(false)
  })
})

describe('dailyConfig', () => {
  it('is the same series for everyone on a given day', () => {
    const config = dailyConfig('20261024')
    expect(config).toEqual({ kind: 'random', version: 3, seed: 20261024, clefs: ['treble'], armures: true, difficulty: 2 })
    const items = generateSeries(config)
    expect(items).toHaveLength(SERIES_LENGTH)
    expect(generateSeries(dailyConfig('20261024'))).toEqual(items)
  })

  it('changes from one day to the next', () => {
    expect(generateSeries(dailyConfig('20261025'))).not.toEqual(generateSeries(dailyConfig('20261024')))
  })
})

describe('dailyStreak', () => {
  it('is 0 without any play', () => {
    expect(dailyStreak([], '20261024')).toBe(0)
  })

  it('counts consecutive days ending today', () => {
    expect(dailyStreak(['20261022', '20261023', '20261024'], '20261024')).toBe(3)
  })

  it('stays alive until the end of today when yesterday was played', () => {
    expect(dailyStreak(['20261022', '20261023'], '20261024')).toBe(2)
  })

  it('is broken by a missed day', () => {
    expect(dailyStreak(['20261021', '20261023'], '20261024')).toBe(1)
    expect(dailyStreak(['20261020', '20261021'], '20261024')).toBe(0)
  })

  it('crosses month and year ends, including leap days', () => {
    expect(dailyStreak(['20251231', '20260101', '20260102'], '20260102')).toBe(3)
    expect(dailyStreak(['20240229', '20240301'], '20240301')).toBe(2)
    expect(dailyStreak(['20260228', '20260301'], '20260301')).toBe(2)
  })

  it('ignores duplicates and accepts any iterable', () => {
    expect(dailyStreak(new Set(['20261023', '20261024']), '20261024')).toBe(2)
    expect(dailyStreak(['20261024', '20261024'], '20261024')).toBe(1)
  })
})
