import { describe, expect, it } from 'vitest'
import { classifyDigit } from './digits'
import { rasterize, strokePath } from './rasterize'
import type { Shape } from './rasterize'
import type { BinaryImage } from './types'

/** Bold digits drawn from strokes, 20 wide and 30 tall. */
const DIGITS: Record<number, Shape[]> = {
  2: [strokePath('M3 8 C3 -2 17 -2 17 8 C17 16 3 20 2 28 L18 28', 4)],
  3: [strokePath('M3 4 C8 -2 17 0 16 8 C15 13 10 14 7 14 C12 14 18 16 17 22 C16 31 6 31 2 25', 4)],
  4: [strokePath('M14 0 L2 20 L19 20', 4), strokePath('M14 0 V30', 4)],
  5: [strokePath('M17 2 L5 2 L4 14 C10 11 18 13 17 21 C16 31 6 31 2 26', 4)],
  6: [strokePath('M16 4 C8 0 3 8 3 18 C3 32 17 32 17 21 C17 12 5 12 3 20', 4)],
  8: [{ kind: 'disc', cx: 10, cy: 8, radius: 7 }, { kind: 'disc', cx: 10, cy: 22, radius: 8 }],
}

function maskOf(shapes: Shape[], hollow8 = false): BinaryImage {
  const raster = rasterize(shapes, 1)
  const data = Uint8Array.from(raster.data, (value) => (value >= 0.5 ? 1 : 0))
  if (hollow8) {
    const mask: BinaryImage = { width: raster.width, height: raster.height, data }
    for (const [cx, cy, r] of [[10, 8, 3], [10, 22, 4]] as const) {
      for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) if (Math.hypot(x - cx, y - cy) < r) data[y * mask.width + x] = 0
    }
  }
  return { width: raster.width, height: raster.height, data }
}

describe('classifyDigit', () => {
  it.each([2, 3, 4, 5, 6])('reads %i', (digit) => {
    expect(classifyDigit(maskOf(DIGITS[digit] as Shape[]))).toBe(digit)
  })

  it('reads an 8 from its two holes', () => {
    expect(classifyDigit(maskOf(DIGITS[8] as Shape[], true))).toBe(8)
  })

  it('refuses shapes that are no digit', () => {
    const wide: BinaryImage = { width: 40, height: 5, data: new Uint8Array(200).fill(1) }
    expect(classifyDigit(wide)).toBeNull()
  })
})
