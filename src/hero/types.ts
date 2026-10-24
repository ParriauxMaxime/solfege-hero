import type { Clef, Note } from '../music/notes'

export type Duration = 'whole' | 'half' | 'quarter' | 'eighth'

export const DURATION_BEATS: Record<Duration, number> = { whole: 4, half: 2, quarter: 1, eighth: 0.5 }

export const BEATS_PER_BAR = 4

/** One written symbol of a bar; `pitch` is a MIDI number, null for a rest. */
export interface NoteSpec {
  pitch: number | null
  duration: Duration
}

/** A note or rest placed on the timeline; beat 0 is the downbeat of the first bar after the count-in. */
export interface HeroNote {
  id: number
  beat: number
  duration: Duration
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
}
