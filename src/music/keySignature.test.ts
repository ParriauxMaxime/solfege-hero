import { describe, expect, it } from 'vitest'
import { seededRandom } from '../random'
import {
  MAX_FIFTHS,
  chooseKey,
  inlineAccidental,
  keyAlteration,
  keyFullName,
  keyMnemonic,
  keyTonicName,
  keyTonicPitchClass,
  majorTonicPitchClass,
  randomKey,
  relativeMinorPitchClass,
  signatureLabel,
  signatureSteps,
  spellInKey,
  withInlineAccidental,
} from './keySignature'
import {
  CLEFS,
  HIGHEST_STEP,
  LETTERS,
  LOWEST_STEP,
  midi,
  pitchClass,
  pitchesInRange,
  staffStep,
  type Letter,
  type Note,
} from './notes'

const note = (letter: Letter, octave: number, alter: Note['alter'] = 0): Note => ({
  letter,
  octave,
  alter,
})

describe('keyAlteration', () => {
  it('sharpens F, C and G in three sharps', () => {
    const altered = LETTERS.filter((letter) => keyAlteration(letter, 3) === 1)
    expect(altered).toEqual(['C', 'F', 'G'])
  })

  it('flattens B, E, A and D in four flats', () => {
    const altered = LETTERS.filter((letter) => keyAlteration(letter, -4) === -1)
    expect(altered).toEqual(['D', 'E', 'A', 'B'])
  })

  it('leaves everything natural in C major', () => {
    expect(LETTERS.every((letter) => keyAlteration(letter, 0) === 0)).toBe(true)
  })

  it('alters every letter at the extremes', () => {
    expect(LETTERS.every((letter) => keyAlteration(letter, MAX_FIFTHS) === 1)).toBe(true)
    expect(LETTERS.every((letter) => keyAlteration(letter, -MAX_FIFTHS) === -1)).toBe(true)
  })
})

describe('signatureSteps', () => {
  it('draws no accidentals in C major', () => {
    expect(signatureSteps(0, 'treble')).toEqual([])
  })

  it('places treble sharps and flats in the standard pattern', () => {
    expect(signatureSteps(7, 'treble').map((s) => s.step)).toEqual([8, 5, 9, 6, 3, 7, 4])
    expect(signatureSteps(-7, 'treble').map((s) => s.step)).toEqual([4, 7, 3, 6, 2, 5, 1])
  })

  it('places bass accidentals two steps lower', () => {
    expect(signatureSteps(7, 'bass').map((s) => s.step)).toEqual([6, 3, 7, 4, 1, 5, 2])
    expect(signatureSteps(-7, 'bass').map((s) => s.step)).toEqual([2, 5, 1, 4, 0, 3, -1])
  })

  it('places alto accidentals one step lower', () => {
    expect(signatureSteps(7, 'alto').map((s) => s.step)).toEqual([7, 4, 8, 5, 2, 6, 3])
    expect(signatureSteps(-7, 'alto').map((s) => s.step)).toEqual([3, 6, 2, 5, 1, 4, 0])
  })

  it('takes the first accidentals only and marks their direction', () => {
    expect(signatureSteps(2, 'treble')).toEqual([
      { alter: 1, step: 8 },
      { alter: 1, step: 5 },
    ])
    expect(signatureSteps(-1, 'treble')).toEqual([{ alter: -1, step: 4 }])
  })
})

describe('spellInKey', () => {
  it('spells naturals in C major', () => {
    expect(spellInKey(60, 0)).toEqual(note('C', 4))
    expect(spellInKey(61, 0)).toBeNull()
  })

  it('spells with the key alteration', () => {
    expect(spellInKey(66, 1)).toEqual(note('F', 4, 1))
    expect(spellInKey(70, -1)).toEqual(note('B', 4, -1))
  })

  it('handles the B-sharp and C-flat octave boundaries', () => {
    expect(spellInKey(60, 7)).toEqual(note('B', 3, 1))
    expect(spellInKey(71, -7)).toEqual(note('C', 5, -1))
  })

  it('is out of key for a note the key does not contain', () => {
    expect(spellInKey(65, 1)).toBeNull()
  })

  it('round-trips every in-key pitch', () => {
    for (let fifths = -MAX_FIFTHS; fifths <= MAX_FIFTHS; fifths++) {
      for (let pitch = 40; pitch < 90; pitch++) {
        const spelled = spellInKey(pitch, fifths)
        if (spelled) expect(midi(spelled)).toBe(pitch)
      }
    }
  })
})

describe('inlineAccidental', () => {
  it('is null when the note follows the key', () => {
    expect(inlineAccidental(note('F', 4, 1), 1)).toBeNull()
    expect(inlineAccidental(note('C', 4), 0)).toBeNull()
  })

  it('names the accidental that differs from the key', () => {
    expect(inlineAccidental(note('F', 4), 1)).toBe('natural')
    expect(inlineAccidental(note('C', 4, 1), 0)).toBe('sharp')
    expect(inlineAccidental(note('B', 4, -1), 0)).toBe('flat')
    expect(inlineAccidental(note('B', 4, 1), -2)).toBe('sharp')
  })
})

describe('withInlineAccidental', () => {
  it('naturalises a letter the key alters', () => {
    expect(withInlineAccidental(note('F', 4, 1), 1)).toEqual(note('F', 4))
    expect(withInlineAccidental(note('B', 4, -1), -1)).toEqual(note('B', 4))
  })

  it('sharpens or flattens a letter the key leaves natural, keeping its step', () => {
    const natural = note('C', 4)
    expect(withInlineAccidental(natural, 0, () => 0.1)).toEqual(note('C', 4, 1))
    expect(withInlineAccidental(natural, 0, () => 0.9)).toEqual(note('C', 4, -1))
  })
})

describe('randomKey', () => {
  it('stays within seven sharps or flats and favours C major', () => {
    const random = seededRandom(2)
    const counts = new Map<number, number>()
    for (let i = 0; i < 6000; i++) {
      const fifths = randomKey(random)
      expect(Math.abs(fifths)).toBeLessThanOrEqual(MAX_FIFTHS)
      counts.set(fifths, (counts.get(fifths) ?? 0) + 1)
    }
    expect(counts.get(0)).toBeGreaterThan(counts.get(1) ?? 0)
    expect(counts.get(1)).toBeGreaterThan(counts.get(7) ?? 0)
    expect(counts.get(-1)).toBeGreaterThan(counts.get(-7) ?? 0)
  })
})

describe('chooseKey', () => {
  it.each(CLEFS)('writes every pitch of the %s range on the staff in some key', (clef) => {
    const random = seededRandom(8)
    for (const pitch of pitchesInRange(clef, true)) {
      const { fifths, note: written } = chooseKey(pitch, clef, random)
      expect(midi(written)).toBe(pitch)
      expect(written.alter).toBe(keyAlteration(written.letter, fifths))
      const step = staffStep(written, clef)
      expect(step).toBeGreaterThanOrEqual(LOWEST_STEP)
      expect(step).toBeLessThanOrEqual(HIGHEST_STEP)
    }
  })

  it.each(CLEFS)('reaches all 12 pitch classes on the %s clef', (clef) => {
    const random = seededRandom(3)
    const reached = new Set(
      pitchesInRange(clef, true).map((pitch) => pitchClass(midi(chooseKey(pitch, clef, random).note))),
    )
    expect(reached.size).toBe(12)
  })

  it('favours keys with few accidentals', () => {
    const random = seededRandom(6)
    const counts = new Map<number, number>()
    for (let i = 0; i < 4000; i++) {
      const { fifths } = chooseKey(66, 'treble', random)
      counts.set(fifths, (counts.get(fifths) ?? 0) + 1)
    }
    expect(counts.get(1)).toBeGreaterThan(counts.get(6) ?? 0)
  })
})

describe('key tonics', () => {
  it('walks the circle of fifths from Do to the major tonic', () => {
    const tonics = [-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7].map(majorTonicPitchClass)
    expect(tonics).toEqual([11, 6, 1, 8, 3, 10, 5, 0, 7, 2, 9, 4, 11, 6, 1])
  })

  it('merges enharmonic signatures on the same pad key', () => {
    expect(majorTonicPitchClass(6)).toBe(majorTonicPitchClass(-6))
    expect(majorTonicPitchClass(7)).toBe(majorTonicPitchClass(-5))
    expect(majorTonicPitchClass(5)).toBe(majorTonicPitchClass(-7))
  })

  it('finds the relative minor three semitones below the major tonic', () => {
    expect(relativeMinorPitchClass(0)).toBe(9)
    expect(relativeMinorPitchClass(1)).toBe(4)
    expect(relativeMinorPitchClass(4)).toBe(1)
    expect(relativeMinorPitchClass(-3)).toBe(0)
    expect(keyTonicPitchClass(2, 'minor')).toBe(11)
    expect(keyTonicPitchClass(2, 'major')).toBe(2)
  })

  it('spells the tonic as the signature does', () => {
    expect(keyFullName(4, 'major')).toBe('Mi majeur')
    expect(keyFullName(4, 'minor')).toBe('Do♯ mineur')
    expect(keyFullName(-2, 'major')).toBe('Si♭ majeur')
    expect(keyFullName(-7, 'major')).toBe('Do♭ majeur')
    expect(keyFullName(-7, 'minor')).toBe('La♭ mineur')
    expect(keyFullName(7, 'major')).toBe('Do♯ majeur')
    expect(keyFullName(7, 'minor')).toBe('La♯ mineur')
    expect(keyFullName(0, 'minor')).toBe('La mineur')
    expect(keyFullName(-1, 'major', 'english')).toBe('F majeur')
  })

  it('spells every tonic with the pitch class it sounds', () => {
    const base: Record<string, number> = { Do: 0, Ré: 2, Mi: 4, Fa: 5, Sol: 7, La: 9, Si: 11 }
    for (let fifths = -MAX_FIFTHS; fifths <= MAX_FIFTHS; fifths++) {
      for (const quality of ['major', 'minor'] as const) {
        const name = keyTonicName(fifths, quality)
        const letter = name.replace(/[♯♭]/, '')
        const alter = name.endsWith('♯') ? 1 : name.endsWith('♭') ? -1 : 0
        expect(((base[letter] as number) + alter + 12) % 12).toBe(keyTonicPitchClass(fifths, quality))
      }
    }
  })

  it('labels signatures and gives the reading mnemonic', () => {
    expect(signatureLabel(4)).toBe('4♯')
    expect(signatureLabel(-3)).toBe('3♭')
    expect(signatureLabel(0)).toBe('0')
    expect(keyMnemonic(3)).toBe('dernier ♯ + ½ ton')
    expect(keyMnemonic(-4)).toBe('avant-dernier ♭')
    expect(keyMnemonic(-1)).toBe('Fa')
  })
})
