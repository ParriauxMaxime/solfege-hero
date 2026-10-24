export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export type Letter = (typeof LETTERS)[number]

export const FRENCH_NAMES: Record<Letter, string> = {
  C: 'Do',
  D: 'Ré',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
}

/** Index = pitch class (0 = Do); enharmonic spellings share one answer. */
export const PITCH_CLASS_NAMES = [
  'Do',
  'Do#/Réb',
  'Ré',
  'Ré#/Mib',
  'Mi',
  'Fa',
  'Fa#/Solb',
  'Sol',
  'Sol#/Lab',
  'La',
  'La#/Sib',
  'Si',
] as const

export const CLEFS = ['treble', 'bass', 'alto'] as const
export type Clef = (typeof CLEFS)[number]

/** -1 flat, 0 natural, 1 sharp. */
export type Alter = -1 | 0 | 1

export interface Note {
  letter: Letter
  octave: number
  alter: Alter
}

const SEMITONES_FROM_C: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

const BOTTOM_LINE: Record<Clef, Note> = {
  treble: { letter: 'E', octave: 4, alter: 0 },
  bass: { letter: 'G', octave: 2, alter: 0 },
  alto: { letter: 'F', octave: 3, alter: 0 },
}

export const TOP_LINE_STEP = 8
export const LOWEST_STEP = -4
export const HIGHEST_STEP =TOP_LINE_STEP + 4

export function diatonicIndex(note: Note): number {
  return note.octave * 7 + LETTERS.indexOf(note.letter)
}

function naturalFromDiatonicIndex(index: number): Note {
  const letter = LETTERS[((index % 7) + 7) % 7] as Letter
  return { letter, octave: Math.floor(index / 7), alter: 0 }
}

export function midi(note: Note): number {
  return (note.octave + 1) * 12 + SEMITONES_FROM_C[note.letter] + note.alter
}

export function pitchClass(midiNumber: number): number {
  return ((midiNumber % 12) + 12) % 12
}

function letterAt(semitone: number): Letter | undefined {
  return LETTERS.find((letter) => SEMITONES_FROM_C[letter] === semitone)
}

export function isNatural(midiNumber: number): boolean {
  return letterAt(pitchClass(midiNumber)) !== undefined
}

/** Writes a pitch on the staff; an altered pitch becomes a flat of the letter above or a sharp of the letter below. */
export function spell(midiNumber: number, preferFlat: boolean): Note {
  const semitone = pitchClass(midiNumber)
  const octave = Math.floor(midiNumber / 12) - 1
  const natural = letterAt(semitone)
  if (natural) return { letter: natural, octave, alter: 0 }
  if (preferFlat) return { letter: letterAt(semitone + 1) as Letter, octave, alter: -1 }
  return { letter: letterAt(semitone - 1) as Letter, octave, alter: 1 }
}

export function noteName(note: Note): string {
  const sign = note.alter === 1 ? '#' : note.alter === -1 ? 'b' : ''
  return `${FRENCH_NAMES[note.letter]}${sign}`
}

/** Steps above the bottom staff line: lines are even steps 0..8, spaces are odd. */
export function staffStep(note: Note, clef: Clef): number {
  return diatonicIndex(note) - diatonicIndex(BOTTOM_LINE[clef])
}

/** Steps of the ledger lines needed to reach the note, outward from the staff. */
export function ledgerSteps(step: number): number[] {
  const steps: number[] = []
  for (let s = -2; s >= step; s -= 2) steps.push(s)
  for (let s = TOP_LINE_STEP + 2; s <= step; s += 2) steps.push(s)
  return steps
}

export function frequency(note: Note): number {
  return 440 * 2 ** ((midi(note) - 69) / 12)
}

/** Every pitch written within two ledger lines below and above the staff. */
export function pitchesInRange(clef: Clef, withAccidentals: boolean): number[] {
  const base = diatonicIndex(BOTTOM_LINE[clef])
  const low = midi(naturalFromDiatonicIndex(base + LOWEST_STEP))
  const high = midi(naturalFromDiatonicIndex(base + HIGHEST_STEP))
  const pitches: number[] = []
  for (let m = low; m <= high; m++) if (withAccidentals || isNatural(m)) pitches.push(m)
  return pitches
}
