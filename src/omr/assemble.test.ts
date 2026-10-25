import { describe, expect, it } from 'vitest'
import { assembleStaff } from './assemble'
import type { StaffEvent } from './reader'

const box = { x: 0, y: 0, width: 1, height: 1 }
const note = (x: number, step: number, duration: 'quarter' | 'half' | 'eighth' = 'quarter', accidental: 'sharp' | null = null): StaffEvent => ({
  kind: 'note',
  x,
  step,
  duration,
  dots: 0,
  accidental,
  quality: 1,
  box,
})
const bar = (x: number): StaffEvent => ({ kind: 'bar', x })
const rest = (x: number): StaffEvent => ({ kind: 'rest', x, duration: 'quarter', dots: 1, quality: 1, box })

describe('assembleStaff', () => {
  it('turns heads into pitches and rests into null pitches with their dots', () => {
    const { notes } = assembleStaff([note(0, 0), rest(1), note(2, 8, 'half')], 'treble', 0)
    expect(notes.map((n) => n.spec)).toEqual([
      { pitch: 64, duration: 'quarter' },
      { pitch: null, duration: 'quarter', dots: 1 },
      { pitch: 77, duration: 'half' },
    ])
  })

  it('sums each measure and starts a new one at every bar line', () => {
    const { measureBeats, notes } = assembleStaff([note(0, 0), note(1, 2, 'half'), bar(2), note(3, 4), note(4, 5, 'eighth'), bar(5)], 'treble', 0)
    expect(measureBeats).toEqual([3, 1.5])
    expect(notes.map((n) => n.measure)).toEqual([0, 0, 1, 1])
  })

  it('resets accidentals at the bar line', () => {
    const { notes } = assembleStaff([note(0, 8, 'quarter', 'sharp'), note(1, 8), bar(2), note(3, 8)], 'treble', 0)
    expect(notes.map((n) => n.spec.pitch)).toEqual([78, 78, 77])
  })

  it('ignores empty measures made of several bar lines', () => {
    expect(assembleStaff([bar(0), bar(1), note(2, 0), bar(3), bar(4)], 'treble', 0).measureBeats).toEqual([1])
  })
})
