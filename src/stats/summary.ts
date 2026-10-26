import { formatPercent, formatSeconds, formatSignedInteger, formatSignedPoints, formatSignedSeconds } from './format'
import type { Metric, WindowSummary } from './progression'
import { LOWER_BEST_IS_BETTER, type HistoryMode } from './history'

export const EMPTY_MESSAGE = 'Pas encore de données sur cette période'

const LABELS: Record<Metric, string> = { precision: 'Précision', meanMs: 'Temps moyen', best: 'Meilleur score' }

function isTimeBest(mode: HistoryMode, metric: Metric): boolean {
  return metric === 'meanMs' || (metric === 'best' && LOWER_BEST_IS_BETTER[mode])
}

export function metricLabel(mode: HistoryMode, metric: Metric): string {
  return metric === 'best' && isTimeBest(mode, metric) ? 'Meilleur temps' : LABELS[metric]
}

function formatValue(metric: Metric, mode: HistoryMode, value: number): string {
  if (metric === 'precision') return formatPercent(value)
  return isTimeBest(mode, metric) ? formatSeconds(value) : String(Math.round(value))
}

function formatDelta(metric: Metric, mode: HistoryMode, delta: number): string {
  if (metric === 'precision') return formatSignedPoints(delta)
  return isTimeBest(mode, metric) ? formatSignedSeconds(delta) : formatSignedInteger(delta)
}

/** « Précision 7 derniers jours 88 % (+5 pts vs 7 jours avant) » */
export function summarySentence(mode: HistoryMode, metric: Metric, days: number, summary: WindowSummary): string {
  if (summary.current === null) return EMPTY_MESSAGE
  const head = `${metricLabel(mode, metric)} ${days} derniers jours ${formatValue(metric, mode, summary.current)}`
  if (summary.delta === null) return head
  const delta = Math.abs(summary.delta) < 1e-9 ? 'stable' : formatDelta(metric, mode, summary.delta)
  return `${head} (${delta} vs ${days} jours avant)`
}
