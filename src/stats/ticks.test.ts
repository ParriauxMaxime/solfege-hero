import { describe, expect, it } from 'vitest'
import { dateTicks, niceTicks } from './ticks'

describe('niceTicks', () => {
  it('covers a time range with round values', () => {
    expect(niceTicks(812, 2340)).toEqual([500, 1000, 1500, 2000, 2500])
  })

  it('covers a percentage range', () => {
    expect(niceTicks(0, 100)).toEqual([0, 50, 100])
  })

  it('uses fractional steps for small ranges without float noise', () => {
    expect(niceTicks(0, 0.3)).toEqual([0, 0.1, 0.2, 0.3])
  })

  it('never exceeds maxCount + 1 ticks and always covers the bounds', () => {
    const ranges: [number, number][] = [[0.5, 4.5], [3, 97], [1200, 1330], [0, 7], [-40, 60]]
    for (const [min, max] of ranges) {
      const ticks = niceTicks(min, max)
      expect(ticks.length).toBeLessThanOrEqual(5)
      expect(Math.min(...ticks)).toBeLessThanOrEqual(min)
      expect(Math.max(...ticks)).toBeGreaterThanOrEqual(max)
    }
  })

  it('handles equal and swapped bounds', () => {
    expect(niceTicks(5, 5)).toEqual([5])
    expect(niceTicks(100, 0)).toEqual(niceTicks(0, 100))
  })
})

describe('dateTicks', () => {
  const days = (count: number) => Array.from({ length: count }, (_, index) => `d${index}`)

  it('keeps first and last for short ranges', () => {
    expect(dateTicks(days(7))).toEqual(['d0', 'd6'])
  })

  it('adds the middle day from 14 days', () => {
    expect(dateTicks(days(14))).toEqual(['d0', 'd6', 'd13'])
    expect(dateTicks(days(31))).toEqual(['d0', 'd15', 'd30'])
  })

  it('handles tiny inputs', () => {
    expect(dateTicks([])).toEqual([])
    expect(dateTicks(days(1))).toEqual(['d0'])
  })
})
