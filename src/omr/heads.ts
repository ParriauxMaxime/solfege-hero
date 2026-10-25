import { fillSmallHoles, labelComponents, openSquare, toOdd } from './components'
import { stepAt } from './staffCrop'
import type { StaffCrop } from './staffCrop'
import type { BinaryImage, Box } from './types'

export interface Head {
  /** Centre in crop coordinates. */
  x: number
  y: number
  box: Box
  hollow: boolean
  /** 0..1, how much the blob looks like a note head. */
  quality: number
  /** Staff step of the centre, fractional. */
  step: number
}

const OPENING_UNITS = 0.6
const HOLE_UNITS_SQUARED = 0.8
/** A pocket this tall fills the gap between two staff lines (0.9 unit): it is no hole of a head. */
const HOLE_MAX_HEIGHT_UNITS = 0.8
const STEM_MIN_UNITS = 1.2
const STEM_MAX_WIDTH_UNITS = 0.3
const MIN_WIDTH_UNITS = 0.75
const MAX_WIDTH_UNITS = 2.8
const MIN_HEIGHT_UNITS = 0.55
const MAX_HEIGHT_UNITS = 2.8
const HEAD_WIDTH_UNITS = 1.2
const HEAD_HEIGHT_UNITS = 0.95
const SPLIT_WIDTH_UNITS = 1.8
/** Taller than a head and a half: two or more heads of a chord sit in this blob. */
const STACKED_HEIGHT_UNITS = 1.35
const HOLLOW_FRACTION = 0.15
const ELLIPSE_FILL = 0.74
const MIN_QUALITY = 0.35/** Opening trims the pointed ends of the ellipse; the reported box gives that back. */
const OPENING_LOSS_X = 0.15
const OPENING_LOSS_Y = 0.08

function headQuality(width: number, height: number, area: number, unit: number): number {
  const fill = area / (width * height)
  const shape = 1 - Math.abs(fill - ELLIPSE_FILL) / 0.3
  const sizeWidth = 1 - Math.abs(width / unit - HEAD_WIDTH_UNITS) / 1.2
  const sizeHeight = 1 - Math.abs(height / unit - HEAD_HEIGHT_UNITS) / 0.9
  return Math.max(0, Math.min(1, 0.4 * shape + 0.3 * sizeWidth + 0.3 * sizeHeight))
}

/**
 * Erases thin, long vertical strokes (stems, bar lines) but not where they run into a head: there the horizontal
 * run is wide. Without them a flag curling back to a head no longer closes a pocket that looks like a hollow head.
 */
function withoutStems(image: BinaryImage, unit: number): BinaryImage {
  const { width, height, data } = image
  const out = data.slice()
  const rowRun = new Int16Array(data.length)
  for (let y = 0; y < height; y++) {
    let x = 0
    while (x < width) {
      if (!data[y * width + x]) {
        x++
        continue
      }
      const start = x
      while (x < width && data[y * width + x]) x++
      for (let k = start; k < x; k++) rowRun[y * width + k] = Math.min(x - start, 32767)
    }
  }
  const minRun = unit * STEM_MIN_UNITS
  for (let x = 0; x < width; x++) {
    let y = 0
    while (y < height) {
      if (!data[y * width + x]) {
        y++
        continue
      }
      const start = y
      while (y < height && data[y * width + x]) y++
      if (y - start < minRun) continue
      for (let k = start; k < y; k++) if ((rowRun[k * width + x] as number) <= unit * STEM_MAX_WIDTH_UNITS) out[k * width + x] = 0
    }
  }
  return { width, height, data: out }
}

/** Heads are what survives opening once the small holes of hollow heads are filled: stems, beams, flags and thin glyphs vanish. */
export function detectHeads(crop: StaffCrop, fromX: number): Head[] {
  const { unit, clean } = crop
  const stripped = withoutStems(crop.raw, unit)
  const filled = fillSmallHoles(stripped, unit * unit * HOLE_UNITS_SQUARED, (pocket) => pocket.y1 - pocket.y0 + 1 >= unit * HOLE_MAX_HEIGHT_UNITS)
  const opened = openSquare(filled, toOdd(unit * OPENING_UNITS))
  const { labels, components } = labelComponents(opened, 1, true)
  const sums = components.map(() => ({ x: 0, y: 0, ink: 0 }))
  const { width, height } = opened
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const label = labels[y * width + x] as number
      if (!label) continue
      const sum = sums[label - 1] as { x: number; y: number; ink: number }
      sum.x += x
      sum.y += y
      sum.ink += clean.data[y * width + x] as number
    }
  }
  const heads: Head[] = []
  components.forEach((component, index) => {
    const w = component.x1 - component.x0 + 1
    const h = component.y1 - component.y0 + 1
    if (w < unit * MIN_WIDTH_UNITS || w > unit * MAX_WIDTH_UNITS || h < unit * MIN_HEIGHT_UNITS || h > unit * MAX_HEIGHT_UNITS) return
    if (component.x0 < fromX) return
    const sum = sums[index] as { x: number; y: number; ink: number }
    const quality = headQuality(w, h, component.area, unit)
    if (quality < MIN_QUALITY) return
    const hollow = 1 - sum.ink / component.area >= HOLLOW_FRACTION
    const columns = w >= unit * SPLIT_WIDTH_UNITS ? Math.round(w / (unit * HEAD_WIDTH_UNITS)) : 1
    const stacked = h >= unit * STACKED_HEIGHT_UNITS
    for (let column = 0; column < columns; column++) {
      const pieceWidth = w / columns
      const x = columns === 1 ? sum.x / component.area : component.x0 + (column + 0.5) * pieceWidth
      /** Notes of a chord are read from the top head only. */
      const y = stacked ? component.y0 + (unit * HEAD_HEIGHT_UNITS) / 2 : columns === 1 ? sum.y / component.area : (component.y0 + component.y1) / 2
      heads.push({
        x,
        y,
        box: {
          x: x - pieceWidth / 2 - unit * OPENING_LOSS_X,
          y: component.y0 - unit * OPENING_LOSS_Y,
          width: pieceWidth + 2 * unit * OPENING_LOSS_X,
          height: h + 2 * unit * OPENING_LOSS_Y,
        },
        hollow,
        quality,
        step: stepAt(crop, x, y),
      })
    }
  })
  return heads.sort((a, b) => a.x - b.x)
}
