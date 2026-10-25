import { describe, expect, it } from 'vitest'
import { binarize } from './image'
import { estimateSkew } from './skew'
import { blankPage, drawStaff } from './testing/draw'

function tiltedPage(degrees: number) {
  const page = blankPage(900, 360)
  drawStaff(page, { left: 40, right: 860, top: 120, unit: 20, thickness: 2 }, Math.tan((degrees * Math.PI) / 180))
  return binarize(page)
}

describe('estimateSkew', () => {
  it.each([0, 1.5, -2.3, 4])('finds %s degrees', (degrees) => {
    expect(estimateSkew(tiltedPage(degrees))).toBeCloseTo(degrees, 0)
  })

  it('is neutral on a blank page', () => {
    expect(estimateSkew(binarize(blankPage(200, 100)))).toBe(0)
  })
})
