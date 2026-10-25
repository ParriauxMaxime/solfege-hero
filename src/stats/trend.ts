import { addWeeks } from './dates'
import type { NoteHistory, WeekKey } from './history'

export interface Trend {
  current: number
  baseline: number
  delta: number
  direction: 'up' | 'down' | 'flat'
}

const BASELINE_WEEKS = 4

function pooled(noteHistory: NoteHistory, id: string, weeks: WeekKey[]): { attempts: number; correct: number } {
  let attempts = 0
  let correct = 0
  for (const week of weeks) {
    const record = noteHistory[week]?.[id]
    if (!record) continue
    attempts += record.attempts
    correct += record.correct
  }
  return { attempts, correct }
}

/** Accuracy this week versus the pooled accuracy of the 4 weeks before; null when either side is too thin. */
export function noteTrend(
  noteHistory: NoteHistory,
  id: string,
  thisWeek: WeekKey,
  minAttempts = 3,
  threshold = 5,
): Trend | null {
  const previousWeeks = Array.from({ length: BASELINE_WEEKS }, (_, index) => addWeeks(thisWeek, -(index + 1)))
  const now = pooled(noteHistory, id, [thisWeek])
  const before = pooled(noteHistory, id, previousWeeks)
  if (now.attempts < minAttempts || before.attempts < minAttempts) return null

  const current = (now.correct / now.attempts) * 100
  const baseline = (before.correct / before.attempts) * 100
  const delta = current - baseline
  const direction = delta >= threshold ? 'up' : delta <= -threshold ? 'down' : 'flat'
  return { current, baseline, delta, direction }
}
