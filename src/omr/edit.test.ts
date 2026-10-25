import { describe, expect, it } from 'vitest'
import type { NoteSpec } from '../hero/types'
import {
  accidentalOf,
  changeClef,
  changeKey,
  confidenceBand,
  insertAfter,
  moveByStep,
  removeNote,
  reviewNotesOf,
  setAccidental,
  setDuration,
  toggleDot,
  toggleRest,
  uncertainMeasures,
} from './edit'
import type { ReviewNote } from './edit'
import type { OmrResult } from './types'

const C4 = 60
const D4 = 62
const E4 = 64
const F4 = 65
const FSHARP4 = 66

function entry(spec: NoteSpec, overrides: Partial<ReviewNote> = {}): ReviewNote {
  return { spec, confidence: 0.4, staff: 0, measure: 0, box: null, ...overrides }
}

const quarter = (pitch: number | null): NoteSpec => ({ pitch, duration: 'quarter' })

describe('confidenceBand', () => {
  it('splits at 0.8 and 0.5', () => {
    expect([1, 0.8, 0.79, 0.5, 0.49, 0].map(confidenceBand)).toEqual(['high', 'high', 'medium', 'medium', 'low', 'low'])
  })
})

describe('reviewNotesOf', () => {
  it('joins confidence, staff, boxes and measures to the notes', () => {
    const box = { x: 1, y: 2, width: 3, height: 4 }
    const result = {
      score: { notes: [quarter(C4), quarter(D4), quarter(E4)] },
      confidence: [0.9, 0.6, 0.2],
      staves: [
        { system: 0, box, notes: [{ index: 0, box }] },
        { system: 1, box, notes: [{ index: 1, box }, { index: 2, box }] },
      ],
      measures: [
        { startNote: 0, endNote: 1, uncertain: false },
        { startNote: 1, endNote: 3, uncertain: true },
      ],
    } as unknown as OmrResult
    const notes = reviewNotesOf(result)
    expect(notes.map((note) => [note.confidence, note.staff, note.measure])).toEqual([
      [0.9, 0, 0],
      [0.6, 1, 1],
      [0.2, 1, 1],
    ])
    expect(notes[2]?.box).toBe(box)
  })
})

describe('moveByStep', () => {
  it('moves one line or space and certifies the note', () => {
    const [moved] = moveByStep([entry(quarter(C4))], 0, 1, 0)
    expect(moved?.spec.pitch).toBe(D4)
    expect(moved?.confidence).toBe(1)
  })

  it('stays on the key signature', () => {
    expect(moveByStep([entry(quarter(E4))], 0, 1, 1)[0]?.spec.pitch).toBe(FSHARP4)
    expect(moveByStep([entry(quarter(FSHARP4))], 0, -1, 1)[0]?.spec.pitch).toBe(E4)
  })

  it('leaves rests and the other notes alone', () => {
    const notes = [entry(quarter(null)), entry(quarter(C4))]
    expect(moveByStep(notes, 0, 1, 0)[0]?.spec.pitch).toBeNull()
    expect(moveByStep(notes, 0, 1, 0)[1]).toBe(notes[1])
  })
})

describe('duration and dots', () => {
  it('sets the written value and drops tuplet timing', () => {
    const [changed] = setDuration([entry({ pitch: C4, duration: 'quarter', beats: 2 / 3 })], 0, 'half')
    expect(changed?.spec).toEqual({ pitch: C4, duration: 'half' })
  })

  it('toggles a single dot', () => {
    const dotted = toggleDot([entry(quarter(C4))], 0)
    expect(dotted[0]?.spec.dots).toBe(1)
    expect(toggleDot(dotted, 0)[0]?.spec).toEqual(quarter(C4))
  })
})

describe('accidentals', () => {
  it('writes a sharp, a flat and a natural against the key', () => {
    expect(setAccidental([entry(quarter(F4))], 0, 'sharp', 0)[0]?.spec.pitch).toBe(FSHARP4)
    expect(setAccidental([entry(quarter(E4))], 0, 'flat', 0)[0]?.spec.pitch).toBe(63)
    expect(setAccidental([entry(quarter(F4))], 0, 'natural', 1)[0]?.spec.pitch).toBe(F4)
  })

  it('returns to the key signature with null', () => {
    expect(setAccidental([entry(quarter(F4))], 0, null, 1)[0]?.spec.pitch).toBe(FSHARP4)
  })

  it('reports what is written against the key', () => {
    expect(accidentalOf(FSHARP4, 0)).toBe('sharp')
    expect(accidentalOf(FSHARP4, 1)).toBeNull()
    expect(accidentalOf(F4, 1)).toBe('natural')
    expect(accidentalOf(null, 0)).toBeNull()
  })
})

describe('toggleRest', () => {
  it('turns a note into a rest of the same value', () => {
    expect(toggleRest([entry({ pitch: C4, duration: 'half' })], 0, 'treble', 0)[0]?.spec).toEqual({ pitch: null, duration: 'half' })
  })

  it('turns a rest into a note on the previous pitch', () => {
    expect(toggleRest([entry(quarter(E4)), entry(quarter(null))], 1, 'treble', 0)[1]?.spec.pitch).toBe(E4)
  })

  it('falls back to the middle line of the clef', () => {
    expect(toggleRest([entry(quarter(null))], 0, 'treble', 0)[0]?.spec.pitch).toBe(71)
    expect(toggleRest([entry(quarter(null))], 0, 'bass', 0)[0]?.spec.pitch).toBe(50)
  })
})

describe('insert and remove', () => {
  it('inserts a certain copy after the note', () => {
    const notes = insertAfter([entry(quarter(C4), { measure: 2 }), entry(quarter(D4))], 0)
    expect(notes.map((note) => note.spec.pitch)).toEqual([C4, C4, D4])
    expect(notes[1]).toMatchObject({ confidence: 1, measure: 2 })
  })

  it('removes the note', () => {
    expect(removeNote([entry(quarter(C4)), entry(quarter(D4))], 0).map((note) => note.spec.pitch)).toEqual([D4])
  })
})

describe('changeClef', () => {
  it('keeps every note on its line', () => {
    const treble = [entry(quarter(E4))]
    const bass = changeClef(treble, 0, 'treble', 'bass')
    expect(bass[0]?.spec.pitch).toBe(43)
    expect(changeClef(bass, 0, 'bass', 'treble')[0]?.spec.pitch).toBe(E4)
  })
})

describe('changeKey', () => {
  it('applies the new key signature to notes that followed the old one', () => {
    expect(changeKey([entry(quarter(F4))], 'treble', 0, 1)[0]?.spec.pitch).toBe(FSHARP4)
  })

  it('keeps written accidentals', () => {
    expect(changeKey([entry(quarter(FSHARP4))], 'treble', 0, 1)[0]?.spec.pitch).toBe(FSHARP4)
    expect(changeKey([entry(quarter(F4))], 'treble', 1, 0)[0]?.spec.pitch).toBe(F4)
  })
})

describe('uncertainMeasures', () => {
  const common = { beats: 4, beatType: 4 }

  it('flags the measure groups that do not fill the bar', () => {
    const notes = [
      entry({ pitch: C4, duration: 'whole' }),
      entry(quarter(C4), { measure: 1 }),
      entry(quarter(D4), { measure: 1 }),
    ]
    expect([...uncertainMeasures(notes, common)]).toEqual([1])
  })

  it('follows the time signature', () => {
    const notes = [entry(quarter(C4)), entry(quarter(D4)), entry(quarter(E4))]
    expect(uncertainMeasures(notes, common).size).toBe(1)
    expect(uncertainMeasures(notes, { beats: 3, beatType: 4 }).size).toBe(0)
  })
})
