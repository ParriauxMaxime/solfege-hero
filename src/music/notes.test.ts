import { describe, expect, it } from 'vitest'
import {
  frequency,
  ledgerSteps,
  midi,
  noteName,
  PITCH_CLASS_NAMES,
  pitchClass,
  pitchClassLabel,
  pitchesInRange,
  spell,
  staffStep,
  type Letter,
  type Note,
} from './notes'

const note = (letter: Letter, octave: number, alter: Note['alter'] = 0): Note => ({
  letter,
  octave,
  alter,
})

describe('staffStep', () => {
  it('places treble notes relative to the E4 bottom line', () => {
    expect(staffStep(note('E', 4), 'treble')).toBe(0)
    expect(staffStep(note('F', 5), 'treble')).toBe(8)
    expect(staffStep(note('C', 4), 'treble')).toBe(-2)
  })

  it('places bass notes relative to the G2 bottom line', () => {
    expect(staffStep(note('G', 2), 'bass')).toBe(0)
    expect(staffStep(note('A', 3), 'bass')).toBe(8)
    expect(staffStep(note('C', 4), 'bass')).toBe(10)
    expect(staffStep(note('E', 2), 'bass')).toBe(-2)
  })

  it('places alto notes relative to the F3 bottom line', () => {
    expect(staffStep(note('F', 3), 'alto')).toBe(0)
    expect(staffStep(note('C', 4), 'alto')).toBe(4)
  })

  it('ignores accidentals', () => {
    expect(staffStep(note('F', 4, 1), 'treble')).toBe(staffStep(note('F', 4), 'treble'))
  })
})

describe('ledgerSteps', () => {
  it('needs none inside the staff or one step beyond it', () => {
    expect(ledgerSteps(0)).toEqual([])
    expect(ledgerSteps(8)).toEqual([])
    expect(ledgerSteps(-1)).toEqual([])
    expect(ledgerSteps(9)).toEqual([])
  })

  it('lists ledger lines outward from the staff', () => {
    expect(ledgerSteps(-2)).toEqual([-2])
    expect(ledgerSteps(-3)).toEqual([-2])
    expect(ledgerSteps(-4)).toEqual([-2, -4])
    expect(ledgerSteps(10)).toEqual([10])
    expect(ledgerSteps(12)).toEqual([10, 12])
  })
})

describe('midi and pitchClass', () => {
  it('numbers middle C as 60', () => {
    expect(midi(note('C', 4))).toBe(60)
  })

  it('applies accidentals', () => {
    expect(midi(note('C', 4, 1))).toBe(61)
    expect(midi(note('D', 4, -1))).toBe(61)
  })

  it('wraps pitch classes, including below zero', () => {
    expect(pitchClass(61)).toBe(1)
    expect(pitchClass(-1)).toBe(11)
  })
})

describe('spell', () => {
  it('spells black keys as sharps or flats on request', () => {
    expect(spell(61, false)).toEqual(note('C', 4, 1))
    expect(spell(61, true)).toEqual(note('D', 4, -1))
  })

  it('spells white keys as naturals either way', () => {
    expect(spell(60, false)).toEqual(note('C', 4))
    expect(spell(60, true)).toEqual(note('C', 4))
  })

  it('round-trips through midi', () => {
    for (let pitch = 40; pitch < 90; pitch++) {
      expect(midi(spell(pitch, false))).toBe(pitch)
      expect(midi(spell(pitch, true))).toBe(pitch)
    }
  })
})

describe('noteName', () => {
  it('names naturals, sharps and flats in French', () => {
    expect(noteName(note('C', 4))).toBe('Do')
    expect(noteName(note('F', 4, 1))).toBe('Fa#')
    expect(noteName(note('B', 3, -1))).toBe('Sib')
  })

  it('names notes in English on request', () => {
    expect(noteName(note('C', 4), 'english')).toBe('C')
    expect(noteName(note('F', 4, 1), 'english')).toBe('F#')
    expect(noteName(note('B', 3, -1), 'english')).toBe('Bb')
  })
})

describe('pitchClassLabel', () => {
  it('keeps the latin names', () => {
    expect([...PITCH_CLASS_NAMES].map((_, pc) => pitchClassLabel(pc, 'latin'))).toEqual([
      ...PITCH_CLASS_NAMES,
    ])
  })

  it('spells the twelve English names with enharmonic pairs', () => {
    expect(Array.from({ length: 12 }, (_, pc) => pitchClassLabel(pc, 'english'))).toEqual([
      'C',
      'C#/Db',
      'D',
      'D#/Eb',
      'E',
      'F',
      'F#/Gb',
      'G',
      'G#/Ab',
      'A',
      'A#/Bb',
      'B',
    ])
  })

  it('wraps out-of-range pitch classes', () => {
    expect(pitchClassLabel(12, 'english')).toBe('C')
    expect(pitchClassLabel(-1, 'english')).toBe('B')
  })
})

describe('frequency', () => {
  it('tunes A4 to 440 Hz', () => {
    expect(frequency(note('A', 4))).toBeCloseTo(440, 5)
  })

  it('computes middle C', () => {
    expect(frequency(note('C', 4))).toBeCloseTo(261.63, 2)
  })

  it('raises sharps by a semitone', () => {
    expect(frequency(note('A', 4, 1))).toBeCloseTo(466.16, 2)
  })
})

describe('pitchesInRange', () => {
  it('runs A3 to C6 on naturals for the treble clef', () => {
    const pitches = pitchesInRange('treble', false)
    expect(pitches).toHaveLength(17)
    expect(pitches[0]).toBe(57)
    expect(pitches.at(-1)).toBe(84)
  })

  it('fills in every semitone with accidentals', () => {
    const pitches = pitchesInRange('treble', true)
    expect(pitches).toHaveLength(84 - 57 + 1)
    expect(pitches[0]).toBe(57)
    expect(pitches.at(-1)).toBe(84)
  })

  it('runs C2 to E4 for the bass clef', () => {
    const pitches = pitchesInRange('bass', false)
    expect(pitches[0]).toBe(36)
    expect(pitches.at(-1)).toBe(64)
  })

  it('runs B2 to D5 for the alto clef', () => {
    const pitches = pitchesInRange('alto', false)
    expect(pitches[0]).toBe(47)
    expect(pitches.at(-1)).toBe(74)
  })
})
