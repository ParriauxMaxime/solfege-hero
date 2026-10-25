import { describe, expect, it } from 'vitest'
import { binarize } from './image'
import { detectStaves, groupSystems, measureStaffMetrics, staffBottomAt, staffTopAt, stepOfPoint } from './staves'
import { blankPage, drawStaff, fillRect } from './testing/draw'
import type { DrawnStaff } from './testing/draw'

const UNIT = 22
const staffAt = (top: number): DrawnStaff => ({ left: 60, right: 1000, top, unit: UNIT, thickness: 3 })

function pageWith(staves: DrawnStaff[], slope = 0, joined: [number, number][] = []) {
  const page = blankPage(1100, 900)
  for (const staff of staves) drawStaff(page, staff, slope)
  for (const [upper, lower] of joined) {
    const a = staves[upper] as DrawnStaff
    const b = staves[lower] as DrawnStaff
    fillRect(page, a.left, a.top, a.left + 1, b.top + 4 * b.unit)
  }
  return binarize(page)
}

describe('measureStaffMetrics', () => {
  it('finds line thickness and spacing', () => {
    expect(measureStaffMetrics(pageWith([staffAt(100), staffAt(400)]))).toEqual({ thickness: 3, unit: UNIT })
  })

  it('gives up on a page without staves', () => {
    expect(measureStaffMetrics(binarize(blankPage(300, 300)))).toBeNull()
  })
})

describe('detectStaves', () => {
  it('finds each staff with its extent and spacing', () => {
    const page = pageWith([staffAt(100), staffAt(400), staffAt(700)])
    const metrics = measureStaffMetrics(page)
    if (!metrics) throw new Error('no metrics')
    const staves = detectStaves(page, metrics)
    expect(staves).toHaveLength(3)
    expect(staves.map((staff) => Math.round(staffTopAt(staff, 500)))).toEqual([100, 400, 700])
    for (const staff of staves) {
      expect(staff.unit).toBeCloseTo(UNIT, 0)
      expect(staff.left).toBeLessThanOrEqual(62)
      expect(staff.right).toBeGreaterThanOrEqual(998)
    }
  })

  it('follows lines that still drift after deskewing', () => {
    const page = pageWith([staffAt(100)], 0.01)
    const metrics = measureStaffMetrics(page)
    if (!metrics) throw new Error('no metrics')
    const [staff] = detectStaves(page, metrics)
    if (!staff) throw new Error('no staff')
    expect(Math.abs(staffTopAt(staff, 100) - (100 + 40 * 0.01))).toBeLessThan(1)
    expect(Math.abs(staffTopAt(staff, 900) - (100 + 840 * 0.01))).toBeLessThan(1)
    expect(stepOfPoint(staff, 900, staffBottomAt(staff, 900))).toBeCloseTo(0, 1)
    expect(stepOfPoint(staff, 900, staffTopAt(staff, 900))).toBeCloseTo(8, 1)
  })

  it('ignores lines that are not five evenly spaced rules, such as chord diagrams', () => {
    const page = blankPage(1100, 400)
    drawStaff(page, staffAt(200))
    for (let box = 0; box < 4; box++) for (let line = 0; line < 5; line++) fillRect(page, 100 + box * 200, 40 + line * UNIT, 160 + box * 200, 42 + line * UNIT)
    const binary = binarize(page)
    const metrics = measureStaffMetrics(binary)
    if (!metrics) throw new Error('no metrics')
    expect(detectStaves(binary, metrics)).toHaveLength(1)
  })

  it('skips beams lying between the lines', () => {
    const page = blankPage(1100, 400)
    const staff = staffAt(150)
    drawStaff(page, staff)
    fillRect(page, 300, 150 + UNIT + 6, 700, 150 + UNIT + 12)
    const binary = binarize(page)
    const metrics = measureStaffMetrics(binary)
    if (!metrics) throw new Error('no metrics')
    expect(detectStaves(binary, metrics)).toHaveLength(1)
  })
})

describe('groupSystems', () => {
  it('links staves joined by a bar line on the left and keeps the others apart', () => {
    const staves = [staffAt(100), staffAt(260), staffAt(500), staffAt(660)]
    const page = pageWith(staves, 0, [[0, 1], [2, 3]])
    const metrics = measureStaffMetrics(page)
    if (!metrics) throw new Error('no metrics')
    const systems = groupSystems(page, detectStaves(page, metrics))
    expect(systems.map((system) => system.length)).toEqual([2, 2])
  })

  it('treats unjoined staves as separate systems', () => {
    const page = pageWith([staffAt(100), staffAt(300), staffAt(500)])
    const metrics = measureStaffMetrics(page)
    if (!metrics) throw new Error('no metrics')
    expect(groupSystems(page, detectStaves(page, metrics)).map((system) => system.length)).toEqual([1, 1, 1])
  })
})
