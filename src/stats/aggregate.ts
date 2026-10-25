import { addDays } from './dates'
import type { DayHistory, DayKey, History } from './history'

export function dayTotals(day: DayHistory | undefined): { answered: number; correct: number } {
  let answered = 0
  let correct = 0
  for (const record of Object.values(day ?? {})) {
    answered += record.answered
    correct += record.correct
  }
  return { answered, correct }
}

export function isPlayedDay(day: DayHistory | undefined): boolean {
  return Object.values(day ?? {}).some((record) => record.answered > 0 || record.games > 0)
}

export interface Overview {
  answered: number
  daysPlayed: number
  currentStreak: number
  bestStreak: number
}

export function overview(history: History, today: DayKey): Overview {
  const playedDays = Object.keys(history)
    .filter((day) => isPlayedDay(history[day]))
    .sort()
  const played = new Set(playedDays)

  let bestStreak = 0
  let run = 0
  let previous: DayKey | null = null
  for (const day of playedDays) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1
    bestStreak = Math.max(bestStreak, run)
    previous = day
  }

  let currentStreak = 0
  let cursor = played.has(today) ? today : addDays(today, -1)
  while (played.has(cursor)) {
    currentStreak++
    cursor = addDays(cursor, -1)
  }

  const answered = Object.values(history).reduce((sum, day) => sum + dayTotals(day).answered, 0)
  return { answered, daysPlayed: playedDays.length, currentStreak, bestStreak }
}
