import type { StaffCrop } from './staffCrop'
import type { Head } from './heads'

export interface Stem {
  x: number
  /** Direction in which the stem leaves the head. */
  direction: 'up' | 'down'
  /** Row of the free end. */
  tip: number
}

const SIDE_INNER_UNITS = 0.35
const SIDE_OUTER_UNITS = 0.2
const MIN_STEM_UNITS = 1.2
const GAP_TOLERANCE = 1
const FLAG_COLUMN_UNITS = [0.45, 0.7]
const FLAG_WINDOW_UNITS = 1.45
const MAX_STROKE_UNITS = 0.95
/** Flags are looked for this far away from the head, past the line remnants that cling to it. */
const HEAD_CLEARANCE_UNITS = 0.3

function inkAt(crop: StaffCrop, x: number, y: number): boolean {
  const { width, height, data } = crop.clean
  return x >= 0 && y >= 0 && x < width && y < height && data[y * width + x] === 1
}

/** Row where the vertical ink run starting at (x, y0) ends, tolerating one-pixel breaks. */
function runEnd(crop: StaffCrop, x: number, y0: number, step: 1 | -1): number {
  let y = y0
  let misses = 0
  let last = y0
  while (misses <= GAP_TOLERANCE) {
    y += step
    if (inkAt(crop, x, y)) {
      last = y
      misses = 0
    } else misses++
    if (y < 0 || y >= crop.clean.height) break
  }
  return last
}

export function findStem(crop: StaffCrop, head: Head): Stem | null {
  const { unit } = crop
  const centreY = Math.round(head.y)
  const right = head.box.x + head.box.width
  const left = head.box.x
  const columns: number[] = []
  for (let dx = -SIDE_INNER_UNITS * unit; dx <= SIDE_OUTER_UNITS * unit; dx++) columns.push(Math.round(right + dx))
  for (let dx = -SIDE_OUTER_UNITS * unit; dx <= SIDE_INNER_UNITS * unit; dx++) columns.push(Math.round(left + dx))
  let best: Stem | null = null
  let bestLength = unit * MIN_STEM_UNITS
  for (const x of columns) {
    if (!inkAt(crop, x, centreY)) continue
    for (const direction of ['up', 'down'] as const) {
      const end = runEnd(crop, x, centreY, direction === 'up' ? -1 : 1)
      const length = Math.abs(end - centreY)
      if (length > bestLength) {
        bestLength = length
        best = { x, direction, tip: end }
      }
    }
  }
  return best
}

function inkRunsInWindow(crop: StaffCrop, x: number, from: number, to: number): number {
  const step = to >= from ? 1 : -1
  let runs = 0
  let length = 0
  for (let y = from; y !== to + step; y += step) {
    if (inkAt(crop, x, y)) length++
    else {
      if (length > 0 && length <= MAX_STROKE_UNITS * crop.unit) runs++
      length = 0
    }
  }
  if (length > 0 && length <= MAX_STROKE_UNITS * crop.unit) runs++
  return runs
}

/** Beams or flags hanging off the free end of a stem: strokes crossing columns a little aside from the stem. */
export function countFlags(crop: StaffCrop, stem: Stem, head: Head): number {
  const inward = stem.direction === 'up' ? 1 : -1
  const from = stem.tip
  const headEdge = stem.direction === 'up' ? head.box.y : head.box.y + head.box.height
  const room = Math.floor(Math.abs(headEdge - stem.tip) - crop.unit * HEAD_CLEARANCE_UNITS)
  const to = stem.tip + inward * Math.max(0, Math.min(Math.round(crop.unit * FLAG_WINDOW_UNITS), room))
  let most = 0
  for (const units of FLAG_COLUMN_UNITS) {
    for (const side of [-1, 1]) {
      most = Math.max(most, inkRunsInWindow(crop, Math.round(stem.x + side * units * crop.unit), from, to))
    }
  }
  return Math.min(most, 2)
}
