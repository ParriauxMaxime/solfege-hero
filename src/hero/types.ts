import type { Clef, Note } from '../music/notes'

export type Duration = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'

/** Length in quarter notes of an undotted value. */
export const DURATION_BEATS: Record<Duration, number> = { whole: 4, half: 2, quarter: 1, eighth: 0.5, sixteenth: 0.25 }

export const BEATS_PER_BAR = 4

export interface TimeSignature {
  beats: number
  beatType: number
}

export const COMMON_TIME: TimeSignature = { beats: 4, beatType: 4 }

/** One written symbol; `pitch` is a MIDI number, null for a rest. */
export interface NoteSpec {
  pitch: number | null
  duration: Duration
  /** Augmentation dots, 0 when absent. */
  dots?: number
  /** Played length in quarter notes when it differs from the written value (tuplets). */
  beats?: number
}

/** A note or rest placed on the timeline; beat 0 is the downbeat of the first bar after the count-in. */
export interface HeroNote {
  id: number
  beat: number
  duration: Duration
  dots: number
  pitch: number | null
  note: Note | null
}

export type Judgement = 'parfait' | 'bien' | 'rate'

export interface Melody {
  name: string
  clef: Clef
  /** Key signature as a fifths index: positive = sharps, negative = flats. */
  key: number
  tempo: number
  notes: NoteSpec[]
  /** 4/4 when absent. */
  timeSignature?: TimeSignature
}

export type ScoreSource = 'builtin' | 'file' | 'link'

/** A melody kept in the library; `id` is a hash of its musical content so the same score imported twice is one entry. */
export interface Score extends Melody {
  id: string
  timeSignature: TimeSignature
  source: ScoreSource
  importedAt: number
}
