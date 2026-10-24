import { describe, expect, it } from 'vitest'
import type { NoteSpec } from '../hero/types'
import { parseMusicXml, scoreId } from './musicxml'
import { toMusicXml } from './musicxmlExport'

const TRIPLET_EIGHTH = (0.5 * 2) / 3

function makeScore(notes: NoteSpec[], overrides = {}) {
  return {
    name: 'Test & <essai>',
    clef: 'treble' as const,
    key: -3,
    tempo: 96,
    timeSignature: { beats: 3, beatType: 4 },
    notes,
    ...overrides,
  }
}

function roundTrip(score: ReturnType<typeof makeScore>) {
  return parseMusicXml(toMusicXml(score)).score
}

describe('toMusicXml', () => {
  it('round-trips dots, rests and a tuplet', () => {
    const score = makeScore([
      { pitch: 67, duration: 'half', dots: 1 },
      { pitch: null, duration: 'quarter' },
      { pitch: 63, duration: 'eighth', beats: TRIPLET_EIGHTH },
      { pitch: 65, duration: 'eighth', beats: TRIPLET_EIGHTH },
      { pitch: 67, duration: 'eighth', beats: TRIPLET_EIGHTH },
      { pitch: 70, duration: 'quarter' },
      { pitch: 72, duration: 'eighth', dots: 1 },
      { pitch: 71, duration: 'sixteenth' },
      { pitch: 69, duration: 'quarter' },
      { pitch: null, duration: 'quarter' },
    ])
    const parsed = roundTrip(score)
    expect(parsed.notes).toEqual(score.notes)
    expect(parsed).toMatchObject({ name: score.name, clef: 'treble', key: -3, tempo: 96, timeSignature: score.timeSignature })
    expect(parsed.id).toBe(scoreId(score))
  })

  it('splits a note across the bar line with ties and reads it back whole', () => {
    const score = makeScore(
      [
        { pitch: 60, duration: 'half' },
        { pitch: 62, duration: 'whole' },
        { pitch: null, duration: 'half' },
      ],
      { timeSignature: { beats: 4, beatType: 4 }, key: 2, clef: 'bass' },
    )
    const xml = toMusicXml(score)
    expect(xml).toContain('<tie type="start"/>')
    expect(xml).toContain('<tie type="stop"/>')
    expect(xml.match(/<measure /g)).toHaveLength(2)
    const parsed = roundTrip(score)
    expect(parsed.notes).toEqual(score.notes)
    expect(parsed.clef).toBe('bass')
    expect(parsed.id).toBe(scoreId(score))
  })

  it('does not tie two consecutive notes of the same pitch', () => {
    const score = makeScore(
      [
        { pitch: 60, duration: 'half', dots: 1 },
        { pitch: 60, duration: 'half', dots: 1 },
      ],
      { key: 0 },
    )
    expect(toMusicXml(score)).not.toContain('<tie ')
    expect(roundTrip(score).notes).toEqual(score.notes)
  })

  it('spells pitches from the key and escapes the title', () => {
    const xml = toMusicXml(makeScore([{ pitch: 63, duration: 'half', dots: 1 }]))
    expect(xml).toContain('<step>E</step><alter>-1</alter><octave>4</octave>')
    expect(xml).toContain('<work-title>Test &amp; &lt;essai&gt;</work-title>')
    expect(xml).toContain('<sound tempo="96"/>')
  })

  it('pads an incomplete last bar with a rest', () => {
    const parsed = roundTrip(makeScore([{ pitch: 60, duration: 'quarter' }]))
    expect(parsed.notes).toEqual([
      { pitch: 60, duration: 'quarter' },
      { pitch: null, duration: 'half' },
    ])
  })
})
