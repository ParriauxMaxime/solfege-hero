import type { Trend } from './trend'

export const WEAK_ACCURACY = 0.8

export interface Rankable {
  ratio: number | null
  trend: Trend | null
}

/** Weakest accuracy first, unseen last; ties keep their order. */
export function weakestFirst<T extends Rankable>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      if (a.item.ratio === null || b.item.ratio === null) {
        return Number(a.item.ratio === null) - Number(b.item.ratio === null) || a.index - b.index
      }
      return a.item.ratio - b.item.ratio || a.index - b.index
    })
    .map(({ item }) => item)
}

export function isWeak(item: Rankable): boolean {
  if (item.ratio === null) return false
  return item.ratio < WEAK_ACCURACY || item.trend?.direction === 'down'
}

/** « en hausse de 8 pts », « en baisse de 8 pts », « stable » */
export function trendDescription(trend: Trend): string {
  const points = Math.round(Math.abs(trend.delta))
  const unit = points < 2 ? 'pt' : 'pts'
  if (trend.direction === 'up') return `en hausse de ${points} ${unit}`
  if (trend.direction === 'down') return `en baisse de ${points} ${unit}`
  return 'stable'
}
