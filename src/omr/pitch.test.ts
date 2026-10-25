import { describe, expect, it } from 'vitest'
import { pitchOfStep } from './pitch'
import type { MeasureAccidentals } from './pitch'

const pitch = (step: number, clef: 'treble' | 'bass' | 'alto', fifths = 0, accidental: 'sharp' | 'flat' | 'natural' | null = null, standing: MeasureAccidentals = new Map()) =>
  pitchOfStep(step, clef, fifths, accidental, standing)

describe('pitchOfStep', () => {
  it('reads the bottom and top lines of each clef', () => {
    expect(pitch(0, 'treble')).toBe(64)
    expect(pitch(8, 'treble')).toBe(77)
    expect(pitch(0, 'bass')).toBe(43)
    expect(pitch(8, 'bass')).toBe(57)
    expect(pitch(0, 'alto')).toBe(53)
    expect(pitch(4, 'alto')).toBe(60)
  })

  it('reads ledger lines on both sides', () => {
    expect(pitch(-2, 'treble')).toBe(60)
    expect(pitch(12, 'treble')).toBe(84)
    expect(pitch(-6, 'bass')).toBe(33)
  })

  it('applies the key signature', () => {
    expect(pitch(8, 'treble', 1)).toBe(78)
    expect(pitch(4, 'treble', -1)).toBe(70)
    expect(pitch(4, 'treble', 2)).toBe(71)
  })

  it('lets an accidental stand for the rest of the measure on the same line only', () => {
    const standing: MeasureAccidentals = new Map()
    expect(pitch(8, 'treble', 0, 'sharp', standing)).toBe(78)
    expect(pitch(8, 'treble', 0, null, standing)).toBe(78)
    expect(pitch(1, 'treble', 0, null, standing)).toBe(65)
    expect(pitch(15, 'treble', 0, null, standing)).toBe(89)
  })

  it('cancels the key signature with a natural', () => {
    const standing: MeasureAccidentals = new Map()
    expect(pitch(8, 'treble', 1, 'natural', standing)).toBe(77)
    expect(pitch(8, 'treble', 1, null, standing)).toBe(77)
  })
})
