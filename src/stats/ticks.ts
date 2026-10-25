import type { DayKey } from './history'

const NICE_MANTISSAS = [1, 2, 5, 10]
const DATE_TICKS_MIN_DAYS = 14

function niceSteps(from: number): number[] {
  const magnitude = 10 ** Math.floor(Math.log10(from))
  return [0, 1, 2].flatMap((decade) => NICE_MANTISSAS.map((mantissa) => mantissa * magnitude * 10 ** decade))
}

function cleanFloat(value: number): number {
  return Math.round(value * 1e9) / 1e9
}

/**
 * Round ticks (steps of 1, 2 or 5 × 10^n) covering [min, max], at most `maxCount + 1` of them.
 * Swapped bounds are reordered; equal bounds give a single tick.
 */
export function niceTicks(min: number, max: number, maxCount = 4): number[] {
  const low = Math.min(min, max)
  const high = Math.max(min, max)
  if (low === high) return [low]

  const step = niceSteps((high - low) / maxCount).find((candidate) => {
    const intervals = Math.ceil(high / candidate) - Math.floor(low / candidate)
    return intervals <= maxCount && candidate >= (high - low) / maxCount
  }) as number
  const first = Math.floor(low / step)
  const last = Math.ceil(high / step)
  return Array.from({ length: last - first + 1 }, (_, index) => cleanFloat((first + index) * step))
}

/** First and last day, plus the middle one from 14 days up. */
export function dateTicks(days: DayKey[]): DayKey[] {
  if (days.length <= 2) return [...days]
  const last = days.length - 1
  const middle = Math.floor(last / 2)
  const withMiddle = days.length >= DATE_TICKS_MIN_DAYS
  return days.filter((_, index) => index === 0 || index === last || (withMiddle && index === middle))
}
