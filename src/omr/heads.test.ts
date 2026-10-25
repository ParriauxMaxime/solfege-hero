import { describe, expect, it } from 'vitest'
import { binarize } from './image'
import { detectHeads } from './heads'
import { cropStaff } from './staffCrop'
import { detectStaves, measureStaffMetrics } from './staves'
import { blankPage, drawBeam, drawFlag, drawHollowHead, drawLedgerLines, drawLine, drawQuarter, drawStaff, fillEllipse, fillRect, stepRow } from './testing/draw'
import type { DrawnStaff } from './testing/draw'
import { countFlags, findStem } from './stems'

const staff: DrawnStaff = { left: 40, right: 900, top: 100, unit: 22, thickness: 3 }

function cropOf(draw: (page: ReturnType<typeof blankPage>) => void) {
  const page = blankPage(960, 320)
  drawStaff(page, staff)
  draw(page)
  const binary = binarize(page)
  const metrics = measureStaffMetrics(binary)
  if (!metrics) throw new Error('no staff')
  const [found] = detectStaves(binary, metrics)
  if (!found) throw new Error('no staff found')
  return cropStaff(binary, found, 0, Infinity)
}

describe('detectHeads', () => {
  it('finds filled and hollow heads with their staff step, whether on a line or in a space', () => {
    const crop = cropOf((page) => {
      drawQuarter(page, staff, 150, 0)
      drawQuarter(page, staff, 250, 5)
      drawHollowHead(page, staff, 350, 8)
      drawHollowHead(page, staff, 450, 3)
    })
    const heads = detectHeads(crop, 0)
    expect(heads.map((head) => Math.round(head.step))).toEqual([0, 5, 8, 3])
    expect(heads.map((head) => head.hollow)).toEqual([false, false, true, true])
  })

  it('reads a head with ledger lines through it', () => {
    const crop = cropOf((page) => {
      drawLedgerLines(page, staff, 150, -2)
      drawQuarter(page, staff, 150, -2)
      drawLedgerLines(page, staff, 250, 12)
      drawQuarter(page, staff, 250, 12)
    })
    expect(detectHeads(crop, 0).map((head) => Math.round(head.step))).toEqual([-2, 12])
  })

  it('ignores stems, beams, text-sized dots and thin strokes', () => {
    const crop = cropOf((page) => {
      drawLine(page, 150, 60, 150, 200, 2)
      fillRect(page, 200, 30, 330, 40)
      fillEllipse(page, 400, 250, 4, 5)
    })
    expect(detectHeads(crop, 0)).toEqual([])
  })

  it('keeps the top head of two heads stacked on a second', () => {
    const crop = cropOf((page) => {
      fillEllipse(page, 150, stepRow(staff, 4), 14, 10, -0.35)
      fillEllipse(page, 150, stepRow(staff, 5), 14, 10, -0.35)
      drawLine(page, 164, stepRow(staff, 5), 164, stepRow(staff, 5) - 70, 2)
    })
    const heads = detectHeads(crop, 0)
    expect(heads).toHaveLength(1)
    expect(Math.round(heads[0]?.step ?? 0)).toBe(5)
  })
})

describe('findStem and countFlags', () => {
  it('gives the direction and the free end of the stem', () => {
    const crop = cropOf((page) => {
      drawQuarter(page, staff, 150, 0)
      drawQuarter(page, staff, 250, 6)
    })
    const [low, high] = detectHeads(crop, 0)
    const up = low && findStem(crop, low)
    const down = high && findStem(crop, high)
    expect(up && up.direction).toBe('up')
    expect(down && down.direction).toBe('down')
    expect(up && up.tip).toBeLessThan((low?.y ?? 0) - 40)
    expect(down && down.tip).toBeGreaterThan((high?.y ?? 0) + 40)
  })

  it('finds no stem on a whole note', () => {
    const crop = cropOf((page) => drawHollowHead(page, staff, 150, 4))
    const [head] = detectHeads(crop, 0)
    expect(head && findStem(crop, head)).toBeNull()
  })

  it('counts the flags or beams hanging at the end of the stem', () => {
    const crop = cropOf((page) => {
      drawQuarter(page, staff, 150, 4)
      drawQuarter(page, staff, 250, 4)
      drawFlag(page, staff, 250, 4, 1)
      drawQuarter(page, staff, 350, 4)
      drawFlag(page, staff, 350, 4, 2)
      drawQuarter(page, staff, 450, 4)
      drawQuarter(page, staff, 520, 4)
      drawBeam(page, staff, 450, 520, 4, 2)
    })
    const flags = detectHeads(crop, 0).map((head) => {
      const stem = findStem(crop, head)
      return stem ? countFlags(crop, stem, head) : -1
    })
    expect(flags).toEqual([0, 1, 2, 2, 2])
  })
})
