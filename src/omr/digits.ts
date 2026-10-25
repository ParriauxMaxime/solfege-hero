import { labelComponents } from './components'
import type { BinaryImage } from './types'

const MIN_HOLE_FRACTION = 0.03
const FULL_BAR = 0.72
const LEFT_BAND = 0.3
/** A 4 whose counter is open at the top has no hole: a tall stem on the right and nothing in the bottom-left corner. */
const OPEN_FOUR_STEM = 0.8
const OPEN_FOUR_EMPTY_CORNER = 0.3

export type Digit = 2 | 3 | 4 | 5 | 6 | 8 | 9

function fractionOfRow(mask: BinaryImage, row: number, from: number, to: number): number {
  let ink = 0
  for (let x = from; x < to; x++) ink += mask.data[row * mask.width + x] as number
  return ink / Math.max(1, to - from)
}

function bandCoverage(mask: BinaryImage, rows: [number, number], columns: [number, number]): number {
  let ink = 0
  let total = 0
  for (let y = Math.floor(rows[0] * mask.height); y < Math.ceil(rows[1] * mask.height); y++) {
    for (let x = Math.floor(columns[0] * mask.width); x < Math.ceil(columns[1] * mask.width); x++) {
      ink += mask.data[y * mask.width + x] as number
      total++
    }
  }
  return total === 0 ? 0 : ink / total
}

function tallestColumn(mask: BinaryImage, from: number, to: number): number {
  let best = 0
  for (let x = Math.floor(from * mask.width); x < Math.ceil(to * mask.width); x++) {
    let ink = 0
    for (let y = 0; y < mask.height; y++) ink += mask.data[y * mask.width + x] as number
    best = Math.max(best, ink / mask.height)
  }
  return best
}

function holes(mask: BinaryImage): { count: number; lowest: number } {
  const padded: BinaryImage = { width: mask.width + 2, height: mask.height + 2, data: new Uint8Array((mask.width + 2) * (mask.height + 2)) }
  for (let y = 0; y < mask.height; y++) padded.data.set(mask.data.subarray(y * mask.width, (y + 1) * mask.width), (y + 1) * padded.width + 1)
  const { components } = labelComponents(padded, 0, false)
  const found = components.filter(
    (c) => c.x0 > 0 && c.y0 > 0 && c.x1 < padded.width - 1 && c.y1 < padded.height - 1 && c.area >= MIN_HOLE_FRACTION * mask.width * mask.height,
  )
  const centres = found.map((c) => ((c.y0 + c.y1) / 2 - 1) / mask.height)
  return { count: found.length, lowest: centres.length ? Math.max(...centres) : 0 }
}

/** Reads a bold digit of a time signature from its shape: enclosed holes first, then where the ink sits. */
export function classifyDigit(mask: BinaryImage): Digit | null {
  const aspect = mask.width / mask.height
  if (aspect < 0.25 || aspect > 1.4) return null
  const { count, lowest } = holes(mask)
  if (count >= 2) return 8
  if (count === 1) {
    if (tallestColumn(mask, 0.55, 0.9) >= 0.85) return 4
    return lowest >= 0.5 ? 6 : 9
  }
  if (tallestColumn(mask, 0.5, 1) >= OPEN_FOUR_STEM && bandCoverage(mask, [0.8, 1], [0, 0.4]) < OPEN_FOUR_EMPTY_CORNER) return 4
  if (fractionOfRow(mask, mask.height - 1 - Math.floor(mask.height * 0.06), 0, mask.width) >= FULL_BAR) return 2
  const leftUpperMiddle = bandCoverage(mask, [0.28, 0.45], [0, LEFT_BAND])
  const topBar = fractionOfRow(mask, Math.floor(mask.height * 0.06), 0, mask.width) >= FULL_BAR
  if (topBar && leftUpperMiddle >= 0.5) return 5
  return 3
}
