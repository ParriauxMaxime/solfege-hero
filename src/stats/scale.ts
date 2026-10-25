import { niceTicks } from './ticks'

export const PERCENT_TICKS = [0, 50, 100]
const FLAT_PADDING = 0.1

/** Y ticks fitted to the data; a flat or empty series still gets a readable range. */
export function dataTicks(values: number[], floorAtZero = false): number[] {
  if (values.length === 0) return niceTicks(0, 1, 2)
  let low = Math.min(...values)
  let high = Math.max(...values)
  if (low === high) {
    const spread = Math.max(Math.abs(high) * FLAT_PADDING, 1)
    low -= spread
    high += spread
  }
  return niceTicks(floorAtZero ? Math.min(0, low) : Math.max(0, low), high, 3)
}
