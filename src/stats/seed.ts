import type { NoteStats } from '../game/sampler'
import { seededRandom } from '../random'
import type { Progress } from '../storage'
import { addDays, dayRange, weekdayIndex, weekKeyOf } from './dates'
import type { AttemptRecord, DayKey, DayRecord, History, NoteHistory } from './history'

export const DEFAULT_SEED = 20261024
const PLAYED_RATE = 0.75
const WEEKEND_PLAYED_RATE = 0.95
const TREBLE_RANGE = { low: 60, high: 84 }
const BASS_IDS = [43, 45, 48, 50, 52, 53, 55].map((pitch) => `bass:${pitch}`)
const KEY_IDS = [-3, -2, -1, 0, 1, 2, 3].map((fifths) => `keys:${fifths}`)

type Random = () => number

function between(random: Random, low: number, high: number): number {
  return low + random() * (high - low)
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

function dayRecord(answered: number, accuracy: number, meanMs: number, games: number, best: number, random: Random): DayRecord {
  const correct = Math.min(answered, Math.round(answered * Math.min(accuracy, 0.995)))
  const timed = answered
  return { answered, correct, totalMs: Math.round(meanMs * timed * between(random, 0.97, 1.03)), timed, games, best }
}

function seedDay(history: History, day: DayKey, progress: number, random: Random): void {
  const weekend = weekdayIndex(day) >= 5
  if (random() > (weekend ? WEEKEND_PLAYED_RATE : PLAYED_RATE)) return
  const noise = () => between(random, -0.05, 0.05)
  const entry: History[DayKey] = {}
  const learnAnswers = Math.round(between(random, 10, weekend ? 200 : 140))
  entry.learn = dayRecord(learnAnswers, lerp(0.7, 0.92, progress) + noise(), lerp(2200, 1100, progress) * between(random, 0.9, 1.1), 1 + Math.floor(random() * 3), random() < 0.3 ? Math.round(between(random, 20, 45)) : 0, random)
  if (random() < 0.35) {
    entry.keys = dayRecord(Math.round(between(random, 8, 60)), lerp(0.6, 0.85, progress) + noise(), lerp(3500, 2200, progress), 1, 0, random)
  }
  if (random() < 0.3) {
    entry.series = { answered: 20, correct: 17 + Math.floor(random() * 4), totalMs: 0, timed: 0, games: 1, best: Math.round(lerp(60000, 35000, progress) * between(random, 0.95, 1.08)) }
  }
  if (random() < 0.2) {
    entry.dictation = { answered: 20, correct: 12 + Math.floor(random() * 8), totalMs: Math.round(between(random, 25000, 40000)), timed: 20, games: 1, best: Math.round(lerp(95000, 60000, progress) * between(random, 0.95, 1.08)) }
  }
  if (random() < 0.25) {
    entry.survival = { answered: Math.round(between(random, 15, 70)), correct: 0, totalMs: 0, timed: 0, games: 1, best: Math.round(lerp(12, 54, progress) * between(random, 0.7, 1.15)) }
    entry.survival.correct = Math.round(entry.survival.answered * 0.85)
  }
  if (random() < 0.2) {
    entry.hero = { answered: Math.round(between(random, 30, 120)), correct: 0, totalMs: 0, timed: 0, games: 1, best: Math.round(lerp(800, 3400, progress) * between(random, 0.75, 1.1)) }
    entry.hero.correct = Math.round(entry.hero.answered * lerp(0.7, 0.9, progress))
  }
  history[day] = entry
}

function noteIds(): string[] {
  const treble = Array.from({ length: TREBLE_RANGE.high - TREBLE_RANGE.low + 1 }, (_, index) => `treble:${TREBLE_RANGE.low + index}`)
  return [...treble, ...BASS_IDS, ...KEY_IDS]
}

function seedNoteHistory(today: DayKey, days: number, random: Random): NoteHistory {
  const firstWeek = weekKeyOf(addDays(today, -(days - 1)))
  const weeks = [...new Set(dayRange(today, days).map(weekKeyOf))]
  const ids = noteIds()
  const difficulty = new Map(ids.map((id) => [id, between(random, 0, 0.3)]))
  const noteHistory: NoteHistory = {}
  weeks.forEach((week, index) => {
    const progress = weeks.length > 1 ? index / (weeks.length - 1) : 1
    const attempts: Record<string, AttemptRecord> = {}
    for (const id of ids) {
      if (week === firstWeek && random() < 0.5) continue
      const tried = Math.round(between(random, 2, 14))
      const hard = difficulty.get(id) ?? 0
      const accuracy = Math.min(0.99, Math.max(0.1, lerp(0.75 - hard, 0.95 - hard * 0.6, progress) + between(random, -0.12, 0.12)))
      attempts[id] = { attempts: tried, correct: Math.min(tried, Math.round(tried * accuracy)) }
    }
    noteHistory[week] = attempts
  })
  return noteHistory
}

export function seedHistory(
  today: DayKey,
  days = 60,
  random: Random = seededRandom(DEFAULT_SEED),
): { history: History; noteHistory: NoteHistory } {
  const history: History = {}
  dayRange(today, days).forEach((day, index) => seedDay(history, day, days > 1 ? index / (days - 1) : 1, random))
  return { history, noteHistory: seedNoteHistory(today, days, random) }
}

function recordsFrom(noteHistory: NoteHistory, prefix: (id: string) => boolean, random: Random): NoteStats {
  const totals = new Map<string, AttemptRecord>()
  for (const week of Object.values(noteHistory)) {
    for (const [id, record] of Object.entries(week)) {
      if (!prefix(id)) continue
      const total = totals.get(id) ?? { attempts: 0, correct: 0 }
      totals.set(id, { attempts: total.attempts + record.attempts, correct: total.correct + record.correct })
    }
  }
  const stats: NoteStats = {}
  for (const [id, total] of totals) {
    const key = id.startsWith('keys:') ? id.slice('keys:'.length) : id
    stats[key] = { ...total, misses: total.attempts - total.correct, avgMs: Math.round(between(random, 900, 2600)) }
  }
  return stats
}

/** Dev only: in-memory demo data layered on a progress object (never saved by the seeder). */
export function seedProgress(progress: Progress, today: DayKey, random: Random = seededRandom(DEFAULT_SEED)): Progress {
  const { history, noteHistory } = seedHistory(today, 60, random)
  const answered = Object.values(history).reduce(
    (sum, day) => sum + Object.values(day).reduce((daySum, record) => daySum + record.answered, 0),
    0,
  )
  return {
    ...progress,
    history,
    noteHistory,
    notes: recordsFrom(noteHistory, (id) => !id.startsWith('keys:'), random),
    keys: recordsFrom(noteHistory, (id) => id.startsWith('keys:'), random),
    totalAnswered: Math.max(progress.totalAnswered, answered),
  }
}
