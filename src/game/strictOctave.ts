import { PITCH_CLASS_NAMES, pitchClass, type Clef } from '../music/notes'

export const STRICT_WINDOW_SEMITONES = 24
const SEMITONES_PER_OCTAVE = 12

/** Lowest Do of the default two-octave window of each clef: Do4, Do2 and Do3. */
const DEFAULT_WINDOW_START: Record<Clef, number> = { treble: 60, bass: 36, alto: 48 }

/** What was pressed: `pitch` is the exact MIDI number in strict octave mode, null when only the pitch class counts. */
export interface Answer {
  pitchClass: number
  pitch: number | null
}

export interface PitchRecord {
  attempts: number
  correct: number
}

export type PitchStats = Record<string, PitchRecord>

export function isCorrectAnswer(target: number, answer: Answer): boolean {
  return answer.pitch === null ? pitchClass(target) === answer.pitchClass : answer.pitch === target
}

/** What a key flashes on: the exact pitch in strict mode, the bare pitch class otherwise. */
export function answerPitch(answer: Answer): number {
  return answer.pitch ?? answer.pitchClass
}

export function defaultWindowStart(clef: Clef): number {
  return DEFAULT_WINDOW_START[clef]
}

/**
 * Do starting the two-octave window that shows `pitch`. The current window is kept while it still contains the pitch,
 * then the clef's default window, else the nearest shift by whole octaves.
 */
export function windowStartFor(clef: Clef, pitch: number, current?: number): number {
  if (current !== undefined && pitch >= current && pitch < current + STRICT_WINDOW_SEMITONES) return current
  const start = DEFAULT_WINDOW_START[clef]
  if (pitch >= start && pitch < start + STRICT_WINDOW_SEMITONES) return start
  const octaveStart = Math.floor(pitch / SEMITONES_PER_OCTAVE) * SEMITONES_PER_OCTAVE
  return pitch < start ? octaveStart : octaveStart - SEMITONES_PER_OCTAVE
}

/** The pitch of a pressed pitch class that sits closest to the target inside the window starting at `windowStart`. */
export function nearestPitchInWindow(windowStart: number, chosenPitchClass: number, target: number): number {
  const lower = windowStart + pitchClass(chosenPitchClass - windowStart)
  const upper = lower + SEMITONES_PER_OCTAVE
  return Math.abs(upper - target) < Math.abs(lower - target) ? upper : lower
}

/** Latin name with the sharp spelling and octave, e.g. `Do4`, `Sol#3`. */
export function exactPitchLabel(pitch: number): string {
  const name = (PITCH_CLASS_NAMES[pitchClass(pitch)] as string).split('/')[0]
  return `${name}${Math.floor(pitch / SEMITONES_PER_OCTAVE) - 1}`
}

export function recordExactPitch(stats: PitchStats, pitch: number, correct: boolean, strict: boolean): PitchStats {
  if (!strict) return stats
  const id = exactPitchLabel(pitch)
  const previous = stats[id]
  return { ...stats, [id]: { attempts: (previous?.attempts ?? 0) + 1, correct: (previous?.correct ?? 0) + (correct ? 1 : 0) } }
}

export function successRate(record: PitchRecord): number {
  return record.attempts > 0 ? record.correct / record.attempts : 1
}

/** Pitches missed at least once, lowest success rate first, then the most played. */
export function mostMissedPitches(stats: PitchStats, limit: number): { label: string; record: PitchRecord }[] {
  return Object.entries(stats)
    .filter(([, record]) => record.correct < record.attempts)
    .map(([label, record]) => ({ label, record }))
    .sort((a, b) => successRate(a.record) - successRate(b.record) || b.record.attempts - a.record.attempts || a.label.localeCompare(b.label))
    .slice(0, limit)
}
