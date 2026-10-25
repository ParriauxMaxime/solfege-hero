import { describe, expect, it } from 'vitest'
import type { NoteSpec } from '../hero/types'
import { breakSystems, slotStarts, slotWidth, splitMeasures, stretchFactor } from './sheetLayout'

const quarter: NoteSpec = { pitch: 60, duration: 'quarter' }
const half: NoteSpec = { pitch: 62, duration: 'half' }
const eighth: NoteSpec = { pitch: 64, duration: 'eighth' }

describe('splitMeasures', () => {
  it('closes a bar once its beats are filled', () => {
    expect(splitMeasures([quarter, quarter, half, quarter, quarter, quarter, quarter], 4)).toEqual([
      { first: 0, end: 3 },
      { first: 3, end: 7 },
    ])
  })

  it('keeps a short last bar', () => {
    expect(splitMeasures([quarter, quarter, quarter, quarter, half], 4)).toEqual([
      { first: 0, end: 4 },
      { first: 4, end: 5 },
    ])
  })

  it('counts dots in bars of other meters', () => {
    const dottedQuarter: NoteSpec = { ...quarter, dots: 1 }
    expect(splitMeasures([dottedQuarter, eighth, dottedQuarter, eighth], 2)).toEqual([
      { first: 0, end: 2 },
      { first: 2, end: 4 },
    ])
  })
})

describe('slotWidth', () => {
  it('grows with duration, accidental and dots', () => {
    expect(slotWidth(half, false)).toBeGreaterThan(slotWidth(quarter, false))
    expect(slotWidth(quarter, true)).toBeGreaterThan(slotWidth(quarter, false))
    expect(slotWidth({ ...quarter, dots: 1 }, false)).toBeGreaterThan(slotWidth(quarter, false))
  })
})

describe('breakSystems', () => {
  it('wraps measures when a system is full', () => {
    expect(breakSystems([100, 100, 100, 100, 100], 250, 300)).toEqual([[0, 1], [2, 3, 4]])
  })

  it('always puts at least one measure on a system', () => {
    expect(breakSystems([500, 100], 200, 200)).toEqual([[0], [1]])
  })

  it('has a single empty system for no measures', () => {
    expect(breakSystems([], 100, 100)).toEqual([[]])
  })
})

describe('slotStarts and stretchFactor', () => {
  it('lays slots end to end after stretching', () => {
    expect(slotStarts([10, 20, 30], 2)).toEqual([0, 20, 60])
  })

  it('fills full systems and caps the last one', () => {
    expect(stretchFactor(100, 150, false, 1.2)).toBe(1.5)
    expect(stretchFactor(100, 150, true, 1.2)).toBe(1.2)
  })
})
