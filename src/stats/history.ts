import { isDayKey, isWeekKey } from './dates'

export const HISTORY_MODES = ['learn', 'keys', 'series', 'dictation', 'survival', 'hero', 'daily'] as const
export type HistoryMode = (typeof HISTORY_MODES)[number]

/** `YYYY-MM-DD`, Paris calendar day (same day boundary as the daily challenge). */
export type DayKey = string
/** ISO week `YYYY-Www`. */
export type WeekKey = string

export interface DayRecord {
  answered: number
  correct: number
  /** Summed response time of the answered prompts that were timed. */
  totalMs: number
  /** Answered prompts that carry a response time (hero notes have none). */
  timed: number
  games: number
  /** Series and daily: fastest time in ms (0 = none). Survival, hero: best score. Learn, keys: best 60 s. */
  best: number
}

export type DayHistory = Partial<Record<HistoryMode, DayRecord>>
export type History = Record<DayKey, DayHistory>

export interface AttemptRecord {
  attempts: number
  correct: number
}

/** Per week, per prompt id: `clef:midi` for notes, `keys:<fifths>` for key signatures. */
export type NoteHistory = Record<WeekKey, Record<string, AttemptRecord>>

export const MAX_HISTORY_DAYS = 400
export const MAX_NOTE_HISTORY_WEEKS = 52

/** Modes where a lower `best` is better (times). */
export const LOWER_BEST_IS_BETTER: Readonly<Record<HistoryMode, boolean>> = {
  learn: false,
  keys: false,
  series: true,
  dictation: true,
  survival: false,
  hero: false,
  daily: true,
}

const NOTE_ID_FORMAT = /^((treble|bass|alto):\d{1,3}|keys:-?[0-7])$/

function emptyDayRecord(): DayRecord {
  return { answered: 0, correct: 0, totalMs: 0, timed: 0, games: 0, best: 0 }
}

function newestKeys<T>(record: Record<string, T>, limit: number): Record<string, T> {
  const kept = Object.keys(record).sort().slice(-limit)
  return Object.fromEntries(kept.map((key) => [key, record[key] as T]))
}

function withDayRecord(history: History, mode: HistoryMode, day: DayKey, record: DayRecord): History {
  const updated: History = { ...history, [day]: { ...history[day], [mode]: record } }
  return newestKeys(updated, MAX_HISTORY_DAYS)
}

export function recordHistoryAnswer(history: History, mode: HistoryMode, day: DayKey, correct: boolean, ms: number | null): History {
  const previous = history[day]?.[mode] ?? emptyDayRecord()
  const isTimed = ms !== null && Number.isFinite(ms) && ms >= 0
  return withDayRecord(history, mode, day, {
    ...previous,
    answered: previous.answered + 1,
    correct: previous.correct + (correct ? 1 : 0),
    totalMs: previous.totalMs + (isTimed ? Math.round(ms) : 0),
    timed: previous.timed + (isTimed ? 1 : 0),
  })
}

function betterBest(mode: HistoryMode, stored: number, candidate: number | null): number {
  if (candidate === null || !Number.isFinite(candidate) || candidate <= 0) return stored
  if (stored === 0) return candidate
  return LOWER_BEST_IS_BETTER[mode] ? Math.min(stored, candidate) : Math.max(stored, candidate)
}

export function recordHistoryGame(history: History, mode: HistoryMode, day: DayKey, best: number | null): History {
  const previous = history[day]?.[mode] ?? emptyDayRecord()
  return withDayRecord(history, mode, day, {
    ...previous,
    games: previous.games + 1,
    best: betterBest(mode, previous.best, best),
  })
}

export function recordNoteHistory(noteHistory: NoteHistory, week: WeekKey, id: string, correct: boolean): NoteHistory {
  const previous = noteHistory[week]?.[id] ?? { attempts: 0, correct: 0 }
  const updated: NoteHistory = {
    ...noteHistory,
    [week]: { ...noteHistory[week], [id]: { attempts: previous.attempts + 1, correct: previous.correct + (correct ? 1 : 0) } },
  }
  return newestKeys(updated, MAX_NOTE_HISTORY_WEEKS)
}

function asRecord(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function sanitizeDayRecord(raw: unknown): DayRecord | null {
  const { answered, correct, totalMs, timed = 0, games, best } = asRecord(raw)
  if (![answered, correct, totalMs, timed, games, best].every(isCount)) return null
  if ((correct as number) > (answered as number) || (timed as number) > (answered as number)) return null
  return { answered, correct, totalMs, timed, games, best } as DayRecord
}

function sanitizeDayHistory(raw: unknown): DayHistory {
  const stored = asRecord(raw)
  const day: DayHistory = {}
  for (const mode of HISTORY_MODES) {
    const record = sanitizeDayRecord(stored[mode])
    if (record) day[mode] = record
  }
  return day
}

export function sanitizeHistory(raw: unknown): History {
  const history: History = {}
  for (const [day, value] of Object.entries(asRecord(raw))) {
    if (!isDayKey(day)) continue
    const dayHistory = sanitizeDayHistory(value)
    if (Object.keys(dayHistory).length > 0) history[day] = dayHistory
  }
  return newestKeys(history, MAX_HISTORY_DAYS)
}

function sanitizeAttemptRecord(raw: unknown): AttemptRecord | null {
  const { attempts, correct } = asRecord(raw)
  if (!isCount(attempts) || !isCount(correct) || correct > attempts) return null
  return { attempts, correct }
}

export function sanitizeNoteHistory(raw: unknown): NoteHistory {
  const noteHistory: NoteHistory = {}
  for (const [week, value] of Object.entries(asRecord(raw))) {
    if (!isWeekKey(week)) continue
    const attempts: Record<string, AttemptRecord> = {}
    for (const [id, record] of Object.entries(asRecord(value))) {
      const sanitized = sanitizeAttemptRecord(record)
      if (NOTE_ID_FORMAT.test(id) && sanitized) attempts[id] = sanitized
    }
    if (Object.keys(attempts).length > 0) noteHistory[week] = attempts
  }
  return newestKeys(noteHistory, MAX_NOTE_HISTORY_WEEKS)
}
