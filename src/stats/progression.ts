import { dayRange } from './dates'
import { LOWER_BEST_IS_BETTER } from './history'
import type { DayKey, DayRecord, History, HistoryMode } from './history'

export type Metric = 'precision' | 'meanMs' | 'best'

export interface ProgressionPoint {
  day: DayKey
  value: number | null
}

export interface WindowSummary {
  current: number | null
  previous: number | null
  delta: number | null
}

export function metricsFor(mode: HistoryMode): Metric[] {
  return mode === 'learn' || mode === 'keys' ? ['precision', 'meanMs'] : ['best']
}

function ratio(numerator: number, denominator: number, scale = 1): number | null {
  return denominator > 0 ? (numerator / denominator) * scale : null
}

function bestOf(record: DayRecord, mode: HistoryMode): number | null {
  if (LOWER_BEST_IS_BETTER[mode]) return record.best > 0 ? record.best : null
  return record.games === 0 && record.best === 0 ? null : record.best
}

function valueOfDay(record: DayRecord | undefined, mode: HistoryMode, metric: Metric): number | null {
  if (!record) return null
  if (metric === 'precision') return ratio(record.correct, record.answered, 100)
  if (metric === 'meanMs') return ratio(record.totalMs, record.timed)
  return bestOf(record, mode)
}

export function progressionPoints(
  history: History,
  mode: HistoryMode,
  metric: Metric,
  today: DayKey,
  rangeDays: number,
): ProgressionPoint[] {
  return dayRange(today, rangeDays).map((day) => ({ day, value: valueOfDay(history[day]?.[mode], mode, metric) }))
}

function summarize(history: History, mode: HistoryMode, metric: Metric, days: DayKey[]): number | null {
  const records = days.flatMap((day) => history[day]?.[mode] ?? [])
  if (metric === 'precision') {
    return ratio(sum(records, 'correct'), sum(records, 'answered'), 100)
  }
  if (metric === 'meanMs') {
    return ratio(sum(records, 'totalMs'), sum(records, 'timed'))
  }
  const values = records.map((record) => bestOf(record, mode)).filter((value): value is number => value !== null)
  if (values.length === 0) return null
  return LOWER_BEST_IS_BETTER[mode] ? Math.min(...values) : Math.max(...values)
}

function sum(records: DayRecord[], field: 'correct' | 'answered' | 'totalMs' | 'timed'): number {
  return records.reduce((total, record) => total + record[field], 0)
}

/** Last `days` days ending today versus the `days` days before them. */
export function windowSummary(
  history: History,
  mode: HistoryMode,
  metric: Metric,
  today: DayKey,
  days: number,
): WindowSummary {
  const window = dayRange(today, days * 2)
  const current = summarize(history, mode, metric, window.slice(days))
  const previous = summarize(history, mode, metric, window.slice(0, days))
  const delta = current !== null && previous !== null ? current - previous : null
  return { current, previous, delta }
}
