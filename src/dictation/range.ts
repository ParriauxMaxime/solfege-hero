import { MAX_LEVEL, clampLevel } from '../level/level'
import { pitchesInRange, type Clef } from '../music/notes'

export interface PitchRange {
  low: number
  high: number
}

const WRITABLE_LEDGER_LINES = 2
const OCTAVE = 12
const MAX_OCTAVE_SHIFT = 3
const MIDDLE_LEVEL = 50

/** Written for the treble clef, folded by octaves into the other clefs. */
const LEVEL_0: PitchRange = { low: 60, high: 72 }
const LEVEL_50: PitchRange = { low: 57, high: 76 }

function clefRange(clef: Clef): PitchRange {
  const pitches = pitchesInRange(clef, true, WRITABLE_LEDGER_LINES)
  return { low: pitches[0] as number, high: pitches[pitches.length - 1] as number }
}

function overflow(range: PitchRange, limits: PitchRange): number {
  return Math.max(0, limits.low - range.low) + Math.max(0, range.high - limits.high)
}

/** Moves the range by whole octaves to where it fits the limits best, then trims what still sticks out. */
function foldInto(range: PitchRange, limits: PitchRange): PitchRange {
  const shifts = Array.from({ length: 2 * MAX_OCTAVE_SHIFT + 1 }, (_, index) => (index - MAX_OCTAVE_SHIFT) * OCTAVE)
  const best = shifts.reduce((chosen, shift) => {
    const shifted = { low: range.low + shift, high: range.high + shift }
    const chosenShifted = { low: range.low + chosen, high: range.high + chosen }
    const better =
      overflow(shifted, limits) < overflow(chosenShifted, limits) ||
      (overflow(shifted, limits) === overflow(chosenShifted, limits) && Math.abs(shift) < Math.abs(chosen))
    return better ? shift : chosen
  }, 0)
  return {
    low: Math.max(limits.low, range.low + best),
    high: Math.min(limits.high, range.high + best),
  }
}

function between(from: PitchRange, to: PitchRange, ratio: number): PitchRange {
  return {
    low: Math.round(from.low + (to.low - from.low) * ratio),
    high: Math.round(from.high + (to.high - from.high) * ratio),
  }
}

/** Pitches a dictation draws from: an octave at level 0, an octave and a half at 50, the whole staff with two ledger lines at 100. */
export function dictationRange(level: number, clef: Clef): PitchRange {
  const limits = clefRange(clef)
  const start = foldInto(LEVEL_0, limits)
  const middle = foldInto(LEVEL_50, limits)
  const clamped = clampLevel(level)
  if (clamped <= MIDDLE_LEVEL) return between(start, middle, clamped / MIDDLE_LEVEL)
  return between(middle, limits, (clamped - MIDDLE_LEVEL) / (MAX_LEVEL - MIDDLE_LEVEL))
}
