import { writeInKey } from '../game/runs'
import { capsFor } from '../level/level'
import { generateMelody, type Difficulty } from '../music/generator'
import { spellInKey } from '../music/keySignature'
import { spell, type Clef } from '../music/notes'
import { withoutRepeatedPitchClasses } from '../series/runSeries'
import { SERIES_LENGTH, type SeriesItem } from '../series/series'
import { dictationRange } from './range'

export const DICTATION_LENGTH = SERIES_LENGTH

const MELODY_BARS = 16
const MIN_DIFFICULTY = 2
const MAX_DIFFICULTY = 5
const LEVELS_PER_DIFFICULTY = 25

export interface DictationConfig {
  seed: number
  /** The clef every note is written in. */
  clef: Clef
  level: number
  /** False limits the dictation to C major, like the Armures setting. */
  armures: boolean
}

export type DictationItem = SeriesItem

/** Among the clefs the player selected, the seed picks one. */
export function dictationClef(seed: number, clefs: readonly Clef[]): Clef {
  const clef = clefs[seed % clefs.length]
  if (!clef) throw new Error('Cannot generate a dictation without a clef')
  return clef
}

/** 2 at the lowest levels up to 5: leaps and the stretch of the melody around its tonic grow with the level. */
function difficultyFor(level: number): Difficulty {
  return Math.min(MAX_DIFFICULTY, MIN_DIFFICULTY + Math.floor(level / LEVELS_PER_DIFFICULTY)) as Difficulty
}

/** The seeded melody's first notes: one key signature, no repeated pitch class, within the level's range. */
export function generateDictation({ seed, clef, level, armures }: DictationConfig): DictationItem[] {
  const caps = capsFor(level)
  const { low, high } = dictationRange(level, clef)
  const melody = generateMelody(seed, {
    clef,
    armures,
    difficulty: difficultyFor(level),
    bars: MELODY_BARS,
    caps,
    range: [low, high],
  })
  const heard = melody.notes.flatMap(({ pitch }) => (pitch === null ? [] : [pitch])).slice(0, DICTATION_LENGTH)
  const pitches = withoutRepeatedPitchClasses(heard, melody.key, clef, seed, caps.ledgerLines, [low, high])
  return pitches.map((pitch) => ({
    clef,
    pitch,
    fifths: melody.key,
    note: writeInKey(pitch, clef, melody.key) ?? spellInKey(pitch, melody.key) ?? spell(pitch, melody.key < 0),
  }))
}
