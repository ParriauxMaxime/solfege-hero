import { t } from '../i18n'
import { formatPercent, formatSeconds, formatSignedInteger, formatSignedPoints, formatSignedSeconds } from './format'
import type { Metric, WindowSummary } from './progression'
import { LOWER_BEST_IS_BETTER, type HistoryMode } from './history'

export function emptyMessage(): string {
  return t('stats.progression.empty')
}

function isTimeBest(mode: HistoryMode, metric: Metric): boolean {
  return metric === 'meanMs' || (metric === 'best' && LOWER_BEST_IS_BETTER[mode])
}

export function metricLabel(mode: HistoryMode, metric: Metric): string {
  if (metric === 'best') return t(isTimeBest(mode, metric) ? 'stats.metrics.bestTime' : 'stats.metrics.best')
  return t(metric === 'precision' ? 'stats.metrics.precision' : 'stats.metrics.meanMs')
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
  if (summary.current === null) return emptyMessage()
  const head = t('stats.summary.head', {
    metric: metricLabel(mode, metric),
    days: String(days),
    value: formatValue(metric, mode, summary.current),
  })
  if (summary.delta === null) return head
  const delta = Math.abs(summary.delta) < 1e-9 ? t('stats.summary.stable') : formatDelta(metric, mode, summary.delta)
  return t('stats.summary.withDelta', { head, delta, days: String(days) })
}
