import type { BeatClock } from './clock'
import type { HeroNote } from './types'

export const PERFECT_WINDOW_MS = 80
export const GOOD_WINDOW_MS = 200

const MS_PER_SECOND = 1000

export function timingJudgement(deltaMs: number): 'parfait' | 'bien' | null {
  const lateness = Math.abs(deltaMs)
  if (lateness <= PERFECT_WINDOW_MS) return 'parfait'
  if (lateness <= GOOD_WINDOW_MS) return 'bien'
  return null
}

function pendingNotes(notes: readonly HeroNote[], judged: ReadonlySet<number>): HeroNote[] {
  return notes.filter((note) => note.pitch !== null && !judged.has(note.id))
}

function offsetMs(note: HeroNote, nowBeat: number, clock: BeatClock): number {
  return (clock.timeAt(nowBeat) - clock.timeAt(note.beat)) * MS_PER_SECOND
}

export function noteInWindow(
  notes: readonly HeroNote[],
  judged: ReadonlySet<number>,
  nowBeat: number,
  clock: BeatClock,
): HeroNote | null {
  return (
    pendingNotes(notes, judged).find(
      (note) => Math.abs(offsetMs(note, nowBeat, clock)) <= GOOD_WINDOW_MS,
    ) ?? null
  )
}

export function expiredNotes(
  notes: readonly HeroNote[],
  judged: ReadonlySet<number>,
  nowBeat: number,
  clock: BeatClock,
): HeroNote[] {
  return pendingNotes(notes, judged).filter(
    (note) => offsetMs(note, nowBeat, clock) > GOOD_WINDOW_MS,
  )
}
