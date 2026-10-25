import { describe, expect, it } from 'vitest'
import { HEAT_THRESHOLDS, heatLevel, heatmapGrid } from './heatmap'
import type { History } from './history'

describe('heatLevel', () => {
  it.each([
    [0, 0],
    [1, 1],
    [29, 1],
    [30, 2],
    [79, 2],
    [80, 3],
    [149, 3],
    [150, 4],
    [1000, 4],
  ])('%i answers is level %i', (answered, level) => {
    expect(heatLevel(answered)).toBe(level)
  })

  it('exposes the thresholds', () => {
    expect(HEAT_THRESHOLDS).toEqual([1, 30, 80, 150])
  })
})

describe('heatmapGrid', () => {
  const history: History = {
    '2026-10-24': { learn: { answered: 40, correct: 30, totalMs: 0, timed: 0, games: 1, best: 0 } },
    '2026-10-27': { learn: { answered: 99, correct: 99, totalMs: 0, timed: 0, games: 1, best: 0 } },
  }
  // 2026-10-25 is a Sunday
  const grid = heatmapGrid(history, '2026-10-25', 3)

  const cell = (cells: typeof grid, column: number, row: number) => cells[column]![row]!

  it('has weeks columns of seven Monday-first cells', () => {
    expect(grid).toHaveLength(3)
    expect(grid.every((column) => column.length === 7)).toBe(true)
    expect(cell(grid, 0, 0).day).toBe('2026-10-05')
    expect(cell(grid, 2, 0).day).toBe('2026-10-19')
    expect(cell(grid, 2, 6).day).toBe('2026-10-25')
  })

  it('fills counts and levels', () => {
    expect(cell(grid, 2, 5)).toEqual({ day: '2026-10-24', answered: 40, correct: 30, level: 2, future: false })
    expect(cell(grid, 0, 0)).toMatchObject({ answered: 0, level: 0, future: false })
  })

  it('flags days after today as empty future cells', () => {
    const midWeek = heatmapGrid(history, '2026-10-27', 2)
    expect(cell(midWeek, 1, 1)).toMatchObject({ day: '2026-10-27', answered: 99, level: 3, future: false })
    expect(cell(midWeek, 1, 2)).toMatchObject({ day: '2026-10-28', answered: 0, future: true })
    expect(cell(midWeek, 1, 6).future).toBe(true)
  })

  it('defaults to 16 weeks', () => {
    expect(heatmapGrid({}, '2026-10-25')).toHaveLength(16)
  })
})
