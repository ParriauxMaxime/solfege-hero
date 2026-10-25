import { describe, expect, it } from 'vitest'
import { formatAxisSeconds, formatSeconds, formatSignedPoints, formatSignedSeconds } from './format'
import { isWeak, trendDescription, weakestFirst } from './rank'
import { dataTicks } from './scale'
import { summarySentence } from './summary'

describe('format', () => {
  it('uses a decimal comma and a real minus', () => {
    expect(formatSeconds(42300)).toBe('42,3 s')
    expect(formatSignedSeconds(-3100)).toBe('−3,1 s')
    expect(formatSignedPoints(5.2)).toBe('+5 pts')
    expect(formatSignedPoints(-1)).toBe('−1 pt')
    expect(formatAxisSeconds(0.5)).toBe('0,5 s')
  })
})

describe('summarySentence', () => {
  it('writes precision with delta', () => {
    expect(summarySentence('learn', 'precision', 7, { current: 88, previous: 83, delta: 5 })).toBe(
      'Précision 7 derniers jours 88 % (+5 pts vs 7 jours avant)',
    )
  })

  it('writes series times and omits the parenthesis without previous', () => {
    expect(summarySentence('series', 'best', 30, { current: 41200, previous: 44300, delta: -3100 })).toBe(
      'Meilleur temps 30 derniers jours 41,2 s (−3,1 s vs 30 jours avant)',
    )
    expect(summarySentence('hero', 'best', 30, { current: 54, previous: null, delta: null })).toBe('Meilleur score 30 derniers jours 54')
  })

  it('handles empty windows', () => {
    expect(summarySentence('hero', 'best', 7, { current: null, previous: null, delta: null })).toBe(
      'Pas encore de données sur cette période',
    )
  })
})

describe('dataTicks', () => {
  it('covers the data and survives flat or empty input', () => {
    const ticks = dataTicks([35, 60])
    expect(ticks[0]).toBeLessThanOrEqual(35)
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(60)
    expect(dataTicks([5, 5]).length).toBeGreaterThan(1)
    expect(dataTicks([]).length).toBeGreaterThan(1)
  })
})

describe('rank', () => {
  const down = { current: 60, baseline: 80, delta: -20, direction: 'down' as const }

  it('sorts weakest first, unseen last, stable', () => {
    const rows = [
      { id: 'a', ratio: 0.9, trend: null },
      { id: 'b', ratio: null, trend: null },
      { id: 'c', ratio: 0.5, trend: null },
      { id: 'd', ratio: 0.9, trend: null },
    ]
    expect(weakestFirst(rows).map((row) => row.id)).toEqual(['c', 'a', 'd', 'b'])
  })

  it('flags weak by accuracy or falling trend', () => {
    expect(isWeak({ ratio: 0.79, trend: null })).toBe(true)
    expect(isWeak({ ratio: 0.95, trend: down })).toBe(true)
    expect(isWeak({ ratio: 0.95, trend: null })).toBe(false)
    expect(isWeak({ ratio: null, trend: null })).toBe(false)
  })

  it('describes trends', () => {
    expect(trendDescription(down)).toBe('en baisse de 20 pts')
  })
})
