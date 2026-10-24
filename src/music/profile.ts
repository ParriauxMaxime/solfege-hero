import type { NoteSpec } from '../hero/types'

export interface IntervalProfile {
  repeats: number
  steps: number
  thirds: number
  leaps: number
  /** Number of intervals between consecutive pitched notes. */
  total: number
}

const MAX_STEP = 2
const MAX_THIRD = 4

/** Share of repeated notes, steps (1-2 semitones), thirds (3-4) and leaps (5+) between consecutive pitched notes. */
export function intervalProfile(notes: readonly NoteSpec[]): IntervalProfile {
  const pitches = notes.flatMap((spec) => (spec.pitch === null ? [] : [spec.pitch]))
  const sizes = pitches.slice(1).map((pitch, index) => Math.abs(pitch - (pitches[index] as number)))
  const total = sizes.length
  const share = (matches: (size: number) => boolean) => (total === 0 ? 0 : sizes.filter(matches).length / total)
  return {
    repeats: share((size) => size === 0),
    steps: share((size) => size > 0 && size <= MAX_STEP),
    thirds: share((size) => size > MAX_STEP && size <= MAX_THIRD),
    leaps: share((size) => size > MAX_THIRD),
    total,
  }
}
