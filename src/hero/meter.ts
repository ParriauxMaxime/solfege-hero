import { DURATION_BEATS, type NoteSpec, type TimeSignature } from './types'

const QUARTERS_PER_WHOLE = 4
const EIGHTHS_PER_COMPOUND_BEAT = 3

export function specBeats(spec: Pick<NoteSpec, 'duration' | 'dots' | 'beats'>): number {
  return spec.beats ?? DURATION_BEATS[spec.duration] * (2 - 0.5 ** (spec.dots ?? 0))
}

/** Length of a bar in quarter notes. */
export function barLength(time: TimeSignature): number {
  return (time.beats * QUARTERS_PER_WHOLE) / time.beatType
}

export interface Click {
  /** Quarter notes from the start of the bar. */
  offset: number
  accent: boolean
}

export function barClicks(time: TimeSignature): Click[] {
  const unit = QUARTERS_PER_WHOLE / time.beatType
  const compound = time.beatType === 8 && time.beats % EIGHTHS_PER_COMPOUND_BEAT === 0
  const step = compound ? unit * EIGHTHS_PER_COMPOUND_BEAT : unit
  const count = compound ? time.beats / EIGHTHS_PER_COMPOUND_BEAT : time.beats
  return Array.from({ length: count }, (_, index) => ({ offset: index * step, accent: index === 0 }))
}
