import { describe, expect, it } from 'vitest'
import type { NoteSpec } from '../hero/types'
import { alignNotes, noteAccuracy } from './accuracy'

const q = (pitch: number | null): NoteSpec => ({ pitch, duration: 'quarter' })

describe('alignNotes', () => {
  it('counts identical sequences as correct', () => {
    expect(alignNotes([q(60), q(62)], [q(60), q(62)])).toEqual({ correct: 2, substituted: 0, missing: 0, extra: 0 })
  })

  it('does not let one inserted or dropped note shift the rest', () => {
    expect(alignNotes([q(60), q(62), q(64), q(65)], [q(60), q(64), q(65)])).toEqual({ correct: 3, substituted: 0, missing: 1, extra: 0 })
    expect(alignNotes([q(60), q(62)], [q(60), q(61), q(62)])).toEqual({ correct: 2, substituted: 0, missing: 0, extra: 1 })
  })

  it('needs pitch, duration and dots to match', () => {
    const truth: NoteSpec[] = [{ pitch: 60, duration: 'half', dots: 1 }]
    expect(alignNotes(truth, [{ pitch: 60, duration: 'half' }]).substituted).toBe(1)
    expect(alignNotes(truth, [{ pitch: 60, duration: 'quarter', dots: 1 }]).substituted).toBe(1)
    expect(noteAccuracy(truth, truth)).toBe(1)
  })

  it('treats rests as notes without pitch', () => {
    expect(noteAccuracy([q(null), q(60)], [q(null), q(60)])).toBe(1)
  })
})
