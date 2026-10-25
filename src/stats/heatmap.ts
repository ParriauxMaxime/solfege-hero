import { dayTotals } from './aggregate'
import { addDays, weekdayIndex } from './dates'
import type { DayKey, History } from './history'

export const HEAT_THRESHOLDS = [1, 30, 80, 150] as const

export type HeatLevel = 0 | 1 | 2 | 3 | 4

export interface HeatCell {
  day: DayKey
  answered: number
  correct: number
  level: HeatLevel
  future: boolean
}

export function heatLevel(answered: number): HeatLevel {
  return HEAT_THRESHOLDS.filter((threshold) => answered >= threshold).length as HeatLevel
}

/** `weeks` columns, oldest first, each Monday to Sunday; the last column holds `today`. */
export function heatmapGrid(history: History, today: DayKey, weeks = 16): HeatCell[][] {
  const lastMonday = addDays(today, -weekdayIndex(today))
  return Array.from({ length: weeks }, (_, column) => {
    const monday = addDays(lastMonday, (column - weeks + 1) * 7)
    return Array.from({ length: 7 }, (_, row): HeatCell => {
      const day = addDays(monday, row)
      const future = day > today
      const { answered, correct } = future ? { answered: 0, correct: 0 } : dayTotals(history[day])
      return { day, answered, correct, level: heatLevel(answered), future }
    })
  })
}
