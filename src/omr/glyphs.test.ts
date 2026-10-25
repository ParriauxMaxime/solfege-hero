import { describe, expect, it } from 'vitest'
import { patchOfRaster, rankTemplates, samplePatch } from './glyphMatch'
import { flattenPath, rasterize, strokePath } from './rasterize'
import { ACCIDENTAL_GRID, accidentalTemplates, REST_GRID, restTemplates } from './templates'

describe('flattenPath', () => {
  it('keeps straight segments and samples curves', () => {
    expect(flattenPath('M0 0 L10 0 V5 H0 Z')).toEqual([[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 }, { x: 0, y: 0 }]])
    const [curve] = flattenPath('M0 0 C0 10 10 10 10 0')
    expect(curve && curve.length).toBeGreaterThan(5)
    expect(curve?.[curve.length - 1]).toEqual({ x: 10, y: 0 })
  })

  it('starts a new polyline at each move', () => {
    expect(flattenPath('M0 0 L1 1 M5 5 L6 6')).toHaveLength(2)
  })
})

describe('rasterize', () => {
  it('covers a stroked line with its thickness and a disc with its area', () => {
    const line = rasterize([strokePath('M0 5 L20 5', 4)], 2)
    expect(line.height).toBe(9)
    expect(line.data[4 * line.width + 20]).toBe(1)
    const diagonal = rasterize([strokePath('M0 0 L20 20', 2)], 2)
    expect(diagonal.data[diagonal.width - 1]).toBe(0)
    expect(diagonal.data[20 * diagonal.width + 20]).toBe(1)
    const disc = rasterize([{ kind: 'disc', cx: 0, cy: 0, radius: 5 }], 4)
    const area = disc.data.reduce((sum, value) => sum + value, 0) / 16
    expect(area).toBeGreaterThan(Math.PI * 25 * 0.95)
    expect(area).toBeLessThan(Math.PI * 25 * 1.05)
  })

  it('fills polygons with the even-odd rule', () => {
    const square = rasterize([{ kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] }], 1)
    expect(square.data[5 * square.width + 5]).toBe(1)
  })
})

describe('templates', () => {
  it('has a template per accidental and rest, each matching its own glyph best', () => {
    for (const template of accidentalTemplates()) expect(rankTemplates(template.patch, accidentalTemplates())[0]?.name).toBe(template.name)
    for (const template of restTemplates()) expect(rankTemplates(template.patch, restTemplates())[0]?.name).toBe(template.name)
    expect(accidentalTemplates()).toHaveLength(3)
    expect(restTemplates()).toHaveLength(3)
  })

  it('recognises a glyph drawn at another scale', () => {
    const [sharp] = accidentalTemplates()
    const big = rasterize([strokePath('M-3.5 -19 V21', 1.8), strokePath('M3.5 -21 V19', 1.8), strokePath('M-7.5 -3 L7.5 -8', 4), strokePath('M-7.5 8 L7.5 3', 4)], 6)
    const patch = samplePatch((x, y) => (big.data[y * big.width + x] as number) > 0.5 ? 1 : 0, { x0: 0, y0: 0, x1: big.width - 1, y1: big.height - 1 }, ACCIDENTAL_GRID.columns, ACCIDENTAL_GRID.rows)
    expect(rankTemplates(patch, accidentalTemplates())[0]?.name).toBe(sharp?.name)
  })

  it('discounts a glyph squashed to the wrong proportions', () => {
    const [quarter] = restTemplates()
    if (!quarter) throw new Error('no template')
    const wide = { ...quarter.patch, aspect: quarter.patch.aspect * 4 }
    const same = rankTemplates(quarter.patch, [quarter])[0]?.score ?? 0
    expect(rankTemplates(wide, [quarter])[0]?.score ?? 1).toBeLessThan(same)
    expect(REST_GRID.rows).toBeGreaterThan(0)
    expect(patchOfRaster(rasterize([strokePath('M0 0 L10 0', 2)], 2), 4, 2).columns).toBe(4)
  })
})
