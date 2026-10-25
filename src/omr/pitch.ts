import { keyAlteration } from '../music/keySignature'
import { LETTERS, midi, staffStep } from '../music/notes'
import type { Alter, Clef } from '../music/notes'
import type { AccidentalKind } from './templates'

const ALTER_OF: Record<AccidentalKind, Alter> = { sharp: 1, flat: -1, natural: 0 }

function bottomLineIndex(clef: Clef): number {
  return -staffStep({ letter: 'C', octave: 0, alter: 0 }, clef)
}

/** Alterations standing in the current measure, by letter and octave. */
export type MeasureAccidentals = Map<string, Alter>

/** MIDI pitch of a head on `step` (0 = bottom line): clef, key signature, then accidentals earlier in the measure. */
export function pitchOfStep(step: number, clef: Clef, fifths: number, accidental: AccidentalKind | null, standing: MeasureAccidentals): number {
  const index = bottomLineIndex(clef) + step
  const letter = LETTERS[((index % 7) + 7) % 7] as (typeof LETTERS)[number]
  const octave = Math.floor(index / 7)
  const position = `${letter}${octave}`
  const alter = accidental ? ALTER_OF[accidental] : (standing.get(position) ?? keyAlteration(letter, fifths))
  if (accidental) standing.set(position, alter)
  return midi({ letter, octave, alter })
}
