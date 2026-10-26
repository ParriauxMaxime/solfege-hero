import { describe, expect, it } from 'vitest'
import { capsFor } from '../level/level'
import { spellInKey } from '../music/keySignature'
import { CLEFS, pitchClass, pitchesInRange, staffStep, type Clef } from '../music/notes'
import { dictationRange } from './range'
import { DICTATION_LENGTH, dictationClef, generateDictation, type DictationConfig } from './sequence'

const LEVELS = [0, 25, 50, 75, 100]
const SEEDS = Array.from({ length: 30 }, (_, index) => 1000 + index * 37)
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]

function config(seed: number, clef: Clef, level: number, armures = true): DictationConfig {
  return { seed, clef, level, armures }
}

function isInKey(pitch: number, fifths: number): boolean {
  const tonic = (((fifths * 7) % 12) + 12) % 12
  return MAJOR_SCALE.includes(pitchClass(pitch - tonic))
}

describe('dictationRange', () => {
  it('is the octave from middle C at level 0 on the treble clef', () => {
    expect(dictationRange(0, 'treble')).toEqual({ low: 60, high: 72 })
  })

  it('is about an octave and a half at level 50', () => {
    const { low, high } = dictationRange(50, 'treble')
    expect(high - low).toBeGreaterThanOrEqual(17)
    expect(high - low).toBeLessThanOrEqual(19)
  })

  it('is the whole staff with two ledger lines at level 100', () => {
    for (const clef of CLEFS) {
      const pitches = pitchesInRange(clef, true, 2)
      expect(dictationRange(100, clef)).toEqual({ low: pitches[0], high: pitches[pitches.length - 1] })
    }
  })

  it('only widens as the level rises and stays within the writable staff', () => {
    for (const clef of CLEFS) {
      const writable = pitchesInRange(clef, true, 2)
      let previous = dictationRange(0, clef)
      for (let level = 1; level <= 100; level++) {
        const range = dictationRange(level, clef)
        expect(range.low).toBeLessThanOrEqual(previous.low)
        expect(range.high).toBeGreaterThanOrEqual(previous.high)
        expect(range.low).toBeGreaterThanOrEqual(writable[0] as number)
        expect(range.high).toBeLessThanOrEqual(writable[writable.length - 1] as number)
        previous = range
      }
    }
  })

  it('folds the low levels by octaves into the bass clef', () => {
    expect(dictationRange(0, 'bass')).toEqual({ low: 48, high: 60 })
  })
})

describe('dictationClef', () => {
  it('picks one of the selected clefs from the seed', () => {
    expect(dictationClef(1000, ['treble'])).toBe('treble')
    expect(dictationClef(1001, ['treble', 'bass'])).toBe('bass')
    expect(dictationClef(1002, ['treble', 'bass'])).toBe('treble')
  })

  it('refuses an empty selection', () => {
    expect(() => dictationClef(1000, [])).toThrow()
  })
})

describe('generateDictation', () => {
  it('is the same for the same configuration', () => {
    for (const clef of CLEFS) {
      expect(generateDictation(config(4821, clef, 60))).toEqual(generateDictation(config(4821, clef, 60)))
    }
  })

  it('composes for every level, clef and seed', () => {
    for (const clef of CLEFS) {
      for (let level = 0; level <= 100; level += 5) {
        for (const seed of SEEDS) expect(generateDictation(config(seed, clef, level, seed % 2 === 0))).toHaveLength(DICTATION_LENGTH)
      }
    }
  })

  it('differs from one seed to another', () => {
    const pitches = (seed: number) => generateDictation(config(seed, 'treble', 50)).map((item) => item.pitch)
    expect(pitches(1234)).not.toEqual(pitches(1235))
  })

  it('has twenty notes written in the one requested clef', () => {
    for (const level of LEVELS) {
      const items = generateDictation(config(2024, 'alto', level))
      expect(items).toHaveLength(DICTATION_LENGTH)
      expect(items.every((item) => item.clef === 'alto')).toBe(true)
    }
  })

  it('never repeats a pitch class twice in a row', () => {
    for (const clef of CLEFS) {
      for (const level of LEVELS) {
        for (const seed of SEEDS) {
          const pitches = generateDictation(config(seed, clef, level)).map((item) => item.pitch)
          pitches.slice(1).forEach((pitch, index) => {
            expect(pitchClass(pitch), `${clef} ${level} ${seed} #${index + 1}`).not.toBe(pitchClass(pitches[index] as number))
          })
        }
      }
    }
  })

  it('keeps every pitch in the level range and writable on the clef', () => {
    for (const clef of CLEFS) {
      for (const level of LEVELS) {
        const { low, high } = dictationRange(level, clef)
        for (const seed of SEEDS) {
          for (const item of generateDictation(config(seed, clef, level))) {
            expect(item.pitch, `${clef} ${level} ${seed}`).toBeGreaterThanOrEqual(low)
            expect(item.pitch, `${clef} ${level} ${seed}`).toBeLessThanOrEqual(high)
            expect(Math.abs(staffStep(item.note, clef) - 4)).toBeLessThanOrEqual(8)
          }
        }
      }
    }
  })

  it('keeps one key signature within the level cap', () => {
    for (const level of LEVELS) {
      const { maxFifths } = capsFor(level)
      for (const seed of SEEDS) {
        const items = generateDictation(config(seed, 'treble', level))
        const [first] = items
        expect(items.every((item) => item.fifths === first?.fifths)).toBe(true)
        expect(Math.abs(first?.fifths ?? 0)).toBeLessThanOrEqual(maxFifths)
      }
    }
  })

  it('writes each note as its pitch in the key', () => {
    for (const seed of SEEDS) {
      for (const item of generateDictation(config(seed, 'bass', 100))) {
        const written = spellInKey(item.pitch, item.fifths)
        if (written) expect(item.note).toEqual(written)
      }
    }
  })

  it('stays diatonic in C major at level 0', () => {
    for (const clef of CLEFS) {
      for (const seed of SEEDS) {
        const items = generateDictation(config(seed, clef, 0))
        expect(items.every((item) => item.fifths === 0 && isInKey(item.pitch, 0))).toBe(true)
      }
    }
  })

  it('stays diatonic while the caps forbid inline accidentals', () => {
    for (const level of [10, 20, 29]) {
      for (const seed of SEEDS) {
        const items = generateDictation(config(seed, 'treble', level))
        expect(items.every((item) => isInKey(item.pitch, item.fifths))).toBe(true)
      }
    }
  })

  it('only goes chromatic where the caps allow accidentals', () => {
    let chromatic = 0
    for (const seed of Array.from({ length: 150 }, (_, index) => 1000 + index)) {
      const items = generateDictation(config(seed, 'treble', 100))
      chromatic += items.filter((item) => !isInKey(item.pitch, item.fifths)).length
    }
    expect(chromatic).toBeGreaterThan(0)
  })

  it('stays in C major without armures whatever the level', () => {
    for (const seed of SEEDS) {
      const items = generateDictation(config(seed, 'treble', 100, false))
      expect(items.every((item) => item.fifths === 0)).toBe(true)
    }
  })
})
