import { describe, expect, it } from 'vitest'
import { seededRandom } from '../testing/seededRandom'
import { randomBarRhythm } from './rhythm'
import { BEATS_PER_BAR, DURATION_BEATS } from './types'

const bars = (count: number) => {
  const random = seededRandom(5)
  return Array.from({ length: count }, () => randomBarRhythm(random))
}

describe('randomBarRhythm', () => {
  it('always fills exactly one bar', () => {
    for (const bar of bars(500)) {
      const beats = bar.reduce((sum, symbol) => sum + DURATION_BEATS[symbol.duration], 0)
      expect(beats).toBe(BEATS_PER_BAR)
    }
  })

  it('never starts a bar with a rest', () => {
    for (const bar of bars(500)) expect(bar[0]?.rest).toBe(false)
  })

  it('only rests on quarters', () => {
    for (const bar of bars(500)) {
      for (const symbol of bar) if (symbol.rest) expect(symbol.duration).toBe('quarter')
    }
  })

  it('pairs eighths so they start on a beat', () => {
    for (const bar of bars(500)) {
      let beat = 0
      let eighths = 0
      for (const symbol of bar) {
        if (symbol.duration === 'eighth' && eighths++ % 2 === 0) expect(beat % 1).toBe(0)
        beat += DURATION_BEATS[symbol.duration]
      }
      expect(eighths % 2).toBe(0)
    }
  })

  it('starts half notes on beats one and three', () => {
    for (const bar of bars(500)) {
      let beat = 0
      for (const symbol of bar) {
        if (symbol.duration === 'half') expect(beat % 2).toBe(0)
        beat += DURATION_BEATS[symbol.duration]
      }
    }
  })

  it('uses the whole vocabulary with occasional rests', () => {
    const symbols = bars(500).flat()
    const durations = new Set(symbols.map((symbol) => symbol.duration))
    expect(durations).toEqual(new Set(['whole', 'half', 'quarter', 'eighth']))
    const quarters = symbols.filter((symbol) => symbol.duration === 'quarter')
    const restShare = quarters.filter((symbol) => symbol.rest).length / quarters.length
    expect(restShare).toBeGreaterThan(0.02)
    expect(restShare).toBeLessThan(0.12)
  })
})
