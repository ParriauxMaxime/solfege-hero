import type { Judgement } from '../hero/types'

export const FLAME_FULL_STREAK = 12
export const MAX_LIVE_FLAMES = 6
const FLAME_MIN_SCALE = 0.4
const STRONG_RELIEF_STREAK = 5
const BIEN_FACTOR = 0.8

/** Size of the flame of a note answered at `streak` in a row: 0 when the streak is broken, subtle at 1, full at FLAME_FULL_STREAK. */
export function streakFlameScale(streak: number): number {
  if (streak < 1) return 0
  const progress = Math.min(1, (streak - 1) / (FLAME_FULL_STREAK - 1))
  return FLAME_MIN_SCALE + (1 - FLAME_MIN_SCALE) * progress
}

export function heroFlameScale(streak: number, judgement: Judgement): number {
  if (judgement === 'rate') return 0
  const scale = streakFlameScale(streak)
  return judgement === 'bien' ? scale * BIEN_FACTOR : scale
}

/** Relief of the flame art: strong from the streak where a flame is clearly burning. */
export function streakRelief(streak: number): 1 | 2 {
  return streak >= STRONG_RELIEF_STREAK ? 2 : 1
}

/** Index of the first flame that still flickers: the newest `cap` flicker, the older ones are drawn still. */
export function liveFlameStart(count: number, cap = MAX_LIVE_FLAMES): number {
  return Math.max(0, count - cap)
}
