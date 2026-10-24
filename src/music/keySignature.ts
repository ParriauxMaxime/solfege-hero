import {
  HIGHEST_STEP,
  LETTERS,
  LOWEST_STEP,
  midi,
  staffStep,
  type Alter,
  type Clef,
  type Letter,
  type Note,
} from './notes'

export const MAX_FIFTHS = 7

export type Accidental = 'sharp' | 'flat' | 'natural'

const SHARP_ORDER: readonly Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER: readonly Letter[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

const TREBLE_SHARP_STEPS = [8, 5, 9, 6, 3, 7, 4]
const TREBLE_FLAT_STEPS = [4, 7, 3, 6, 2, 5, 1]

const STEPS_BELOW_TREBLE: Record<Clef, number> = { treble: 0, bass: 2, alto: 1 }

const ALL_KEYS = Array.from({ length: 2 * MAX_FIFTHS + 1 }, (_, index) => index - MAX_FIFTHS)

export function keyAlteration(letter: Letter, fifths: number): Alter {
  if (fifths > 0) return SHARP_ORDER.indexOf(letter) < fifths ? 1 : 0
  if (fifths < 0) return FLAT_ORDER.indexOf(letter) < -fifths ? -1 : 0
  return 0
}

export function signatureSteps(
  fifths: number,
  clef: Clef,
): { alter: 1 | -1; step: number }[] {
  const sharp = fifths > 0
  const trebleSteps = sharp ? TREBLE_SHARP_STEPS : TREBLE_FLAT_STEPS
  return trebleSteps.slice(0, Math.abs(fifths)).map((step) => ({
    alter: sharp ? 1 : -1,
    step: step - STEPS_BELOW_TREBLE[clef],
  }))
}

export function spellInKey(pitch: number, fifths: number): Note | null {
  const octave = Math.floor(pitch / 12) - 1
  for (const letter of LETTERS) {
    for (const candidateOctave of [octave - 1, octave, octave + 1]) {
      const note: Note = {
        letter,
        octave: candidateOctave,
        alter: keyAlteration(letter, fifths),
      }
      if (midi(note) === pitch) return note
    }
  }
  return null
}

export function inlineAccidental(note: Note, fifths: number): Accidental | null {
  if (note.alter === keyAlteration(note.letter, fifths)) return null
  if (note.alter === 1) return 'sharp'
  return note.alter === -1 ? 'flat' : 'natural'
}

function pickWeighted<T>(items: readonly T[], weight: (item: T) => number, random: () => number): T {
  const weights = items.map(weight)
  let threshold = random() * weights.reduce((sum, value) => sum + value, 0)
  for (const [index, item] of items.entries()) {
    threshold -= weights[index] ?? 0
    if (threshold < 0) return item
  }
  return items[items.length - 1] as T
}

const keyWeight = (fifths: number) => 1 / (1 + Math.abs(fifths))

export function randomKey(random: () => number = Math.random): number {
  return pickWeighted(ALL_KEYS, keyWeight, random)
}

export function chooseKey(
  pitch: number,
  clef: Clef,
  random: () => number = Math.random,
): { fifths: number; note: Note } {
  const candidates = ALL_KEYS.flatMap((fifths) => {
    const note = spellInKey(pitch, fifths)
    if (!note) return []
    const step = staffStep(note, clef)
    return step >= LOWEST_STEP && step <= HIGHEST_STEP ? [{ fifths, note }] : []
  })
  if (candidates.length === 0) throw new Error(`No key writes pitch ${pitch} on the ${clef} staff`)
  return pickWeighted(candidates, (candidate) => keyWeight(candidate.fifths), random)
}

export function withInlineAccidental(
  note: Note,
  fifths: number,
  random: () => number = Math.random,
): Note {
  if (keyAlteration(note.letter, fifths) !== 0) return { ...note, alter: 0 }
  return { ...note, alter: random() < 0.5 ? 1 : -1 }
}
