import { barLength, specBeats } from '../hero/meter'
import type { Duration, NoteSpec, TimeSignature } from '../hero/types'
import { keyAlteration, spellInKey } from '../music/keySignature'
import type { Accidental } from '../music/keySignature'
import { diatonicIndex, LETTERS, midi, spell, staffStep } from '../music/notes'
import type { Alter, Clef, Letter, Note } from '../music/notes'
import type { Box, OmrResult } from './types'

/** One recognised symbol with what the review screen needs to show and correct it. */
export interface ReviewNote {
  spec: NoteSpec
  /** 0..1; a note the user touched is certain. */
  confidence: number
  /** Index in `OmrResult.staves`. */
  staff: number
  /** Measure group read from the bar lines, shared by notes inserted next to each other. */
  measure: number
  /** Box in the source image, null when unknown. */
  box: Box | null
}

export type ConfidenceBand = 'high' | 'medium' | 'low'

export const HIGH_CONFIDENCE = 0.8
export const MEDIUM_CONFIDENCE = 0.5
const BEAT_EPSILON = 1e-6
const MIDDLE_LINE_STEP = 4
const ALTER_OF: Record<Accidental, Alter> = { sharp: 1, flat: -1, natural: 0 }

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= HIGH_CONFIDENCE) return 'high'
  return confidence >= MEDIUM_CONFIDENCE ? 'medium' : 'low'
}

export function reviewNotesOf(result: OmrResult): ReviewNote[] {
  const entries: ReviewNote[] = result.score.notes.map((spec, index) => ({
    spec,
    confidence: result.confidence[index] ?? 0,
    staff: 0,
    measure: 0,
    box: null,
  }))
  result.staves.forEach((staff, staffIndex) => {
    for (const { index, box } of staff.notes) {
      const entry = entries[index]
      if (entry) Object.assign(entry, { staff: staffIndex, box })
    }
  })
  result.measures.forEach((measure, measureIndex) => {
    for (let index = measure.startNote; index < measure.endNote; index++) {
      const entry = entries[index]
      if (entry) entry.measure = measureIndex
    }
  })
  return entries
}

/** How the staff writes `pitch` under the key signature. */
export function spelledIn(pitch: number, key: number): Note {
  return spellInKey(pitch, key) ?? spell(pitch, key < 0)
}

function bottomLineIndex(clef: Clef): number {
  return -staffStep({ letter: 'C', octave: 0, alter: 0 }, clef)
}

function noteOnIndex(diatonic: number, alter: (letter: Letter) => Alter): Note {
  const letter = LETTERS[((diatonic % 7) + 7) % 7] as Letter
  return { letter, octave: Math.floor(diatonic / 7), alter: alter(letter) }
}

function replaceAt(notes: readonly ReviewNote[], index: number, change: (note: ReviewNote) => ReviewNote): ReviewNote[] {
  return notes.map((note, position) => (position === index ? change(note) : note))
}

function touched(note: ReviewNote, spec: NoteSpec): ReviewNote {
  return { ...note, spec, confidence: 1 }
}

/** Moves a pitched note by `delta` lines or spaces, landing on the key signature's version of the new letter. */
export function moveByStep(notes: readonly ReviewNote[], index: number, delta: number, key: number): ReviewNote[] {
  return replaceAt(notes, index, (entry) => {
    if (entry.spec.pitch === null) return entry
    const moved = noteOnIndex(diatonicIndex(spelledIn(entry.spec.pitch, key)) + delta, (letter) => keyAlteration(letter, key))
    return touched(entry, { ...entry.spec, pitch: midi(moved) })
  })
}

export function setDuration(notes: readonly ReviewNote[], index: number, duration: Duration): ReviewNote[] {
  return replaceAt(notes, index, (entry) => {
    const { beats: _tuplet, ...written } = entry.spec
    return touched(entry, { ...written, duration })
  })
}

export function toggleDot(notes: readonly ReviewNote[], index: number): ReviewNote[] {
  return replaceAt(notes, index, (entry) => {
    const { dots: _dots, beats: _tuplet, ...written } = entry.spec
    return touched(entry, entry.spec.dots ? written : { ...written, dots: 1 })
  })
}

/** Alteration written on the note against the key signature, null when it follows the key. */
export function accidentalOf(pitch: number | null, key: number): Accidental | null {
  if (pitch === null) return null
  const note = spelledIn(pitch, key)
  if (note.alter === keyAlteration(note.letter, key)) return null
  if (note.alter === 1) return 'sharp'
  return note.alter === -1 ? 'flat' : 'natural'
}

/** Writes `accidental` on the note, or brings it back to the key signature when null. */
export function setAccidental(notes: readonly ReviewNote[], index: number, accidental: Accidental | null, key: number): ReviewNote[] {
  return replaceAt(notes, index, (entry) => {
    if (entry.spec.pitch === null) return entry
    const { letter, octave } = spelledIn(entry.spec.pitch, key)
    const alter = accidental ? ALTER_OF[accidental] : keyAlteration(letter, key)
    return touched(entry, { ...entry.spec, pitch: midi({ letter, octave, alter }) })
  })
}

/** A note becomes a rest of the same value; a rest becomes a note on the previous pitch, or on the middle line. */
export function toggleRest(notes: readonly ReviewNote[], index: number, clef: Clef, key: number): ReviewNote[] {
  return replaceAt(notes, index, (entry) => {
    if (entry.spec.pitch !== null) return touched(entry, { ...entry.spec, pitch: null })
    const previous = notes
      .slice(0, index)
      .reverse()
      .find((candidate) => candidate.spec.pitch !== null)
    const middle = midi(noteOnIndex(bottomLineIndex(clef) + MIDDLE_LINE_STEP, (letter) => keyAlteration(letter, key)))
    return touched(entry, { ...entry.spec, pitch: previous?.spec.pitch ?? middle })
  })
}

export function removeNote(notes: readonly ReviewNote[], index: number): ReviewNote[] {
  return notes.filter((_, position) => position !== index)
}

export function insertAfter(notes: readonly ReviewNote[], index: number): ReviewNote[] {
  const source = notes[index]
  if (!source) return [...notes]
  return [...notes.slice(0, index + 1), { ...source, confidence: 1 }, ...notes.slice(index + 1)]
}

interface Reading {
  clef: Clef
  key: number
}

/** Re-reads every note at the same line or space under another clef or key: notes following the key signature follow the new key, written accidentals stay. */
function reinterpret(notes: readonly ReviewNote[], from: Reading, to: Reading): ReviewNote[] {
  return notes.map((entry) => {
    if (entry.spec.pitch === null) return entry
    const old = spelledIn(entry.spec.pitch, from.key)
    const written = old.alter !== keyAlteration(old.letter, from.key)
    const moved = noteOnIndex(bottomLineIndex(to.clef) + staffStep(old, from.clef), (letter) => (written ? old.alter : keyAlteration(letter, to.key)))
    return { ...entry, spec: { ...entry.spec, pitch: midi(moved) } }
  })
}

export function changeClef(notes: readonly ReviewNote[], key: number, from: Clef, to: Clef): ReviewNote[] {
  return reinterpret(notes, { clef: from, key }, { clef: to, key })
}

export function changeKey(notes: readonly ReviewNote[], clef: Clef, from: number, to: number): ReviewNote[] {
  return reinterpret(notes, { clef, key: from }, { clef, key: to })
}

/** Measure groups whose written values do not add up to the bar. */
export function uncertainMeasures(notes: readonly ReviewNote[], time: TimeSignature): Set<number> {
  const totals = new Map<number, number>()
  for (const { spec, measure } of notes) totals.set(measure, (totals.get(measure) ?? 0) + specBeats(spec))
  const bar = barLength(time)
  return new Set([...totals].filter(([, total]) => Math.abs(total - bar) > BEAT_EPSILON).map(([measure]) => measure))
}
