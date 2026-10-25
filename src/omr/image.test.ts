import { describe, expect, it } from 'vitest'
import { binarize, denoise, resizeGray, rgbaToGray, rotateGray, rotatedToSource } from './image'
import { blankPage, fillRect } from './testing/draw'

describe('rgbaToGray', () => {
  it('weights the channels and composites transparency over white', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 255])
    const gray = rgbaToGray(rgba, 3, 1)
    expect(gray.data[0]).toBe(76)
    expect(gray.data[1]).toBe(255)
    expect(gray.data[2]).toBe(0)
  })
})

describe('binarize', () => {
  it('keeps dark strokes under uneven lighting and ignores a bright-to-dark gradient', () => {
    const page = blankPage(300, 120)
    for (let y = 0; y < page.height; y++) for (let x = 0; x < page.width; x++) page.data[y * page.width + x] = 255 - Math.round((x / page.width) * 120)
    fillRect(page, 20, 50, 60, 54, 20)
    fillRect(page, 240, 50, 280, 54, 20)
    const binary = binarize(page)
    const ink = (x: number, y: number) => binary.data[y * binary.width + x]
    expect(ink(40, 52)).toBe(1)
    expect(ink(260, 52)).toBe(1)
    expect(ink(150, 20)).toBe(0)
    expect(ink(280, 100)).toBe(0)
  })

  it('does not turn paper noise into ink', () => {
    const page = blankPage(200, 100)
    for (let i = 0; i < page.data.length; i++) page.data[i] = 245 + ((i * 7919) % 11)
    expect(binarize(page).data.every((value) => value === 0)).toBe(true)
  })
})

describe('denoise', () => {
  it('leaves a clean page alone and smooths a grainy one', () => {
    const clean = blankPage(120, 80)
    clean.data.fill(200)
    fillRect(clean, 20, 30, 100, 33, 0)
    expect(denoise(clean).data).toEqual(clean.data)
    const grainy = { ...clean, data: Uint8Array.from(clean.data, (value, i) => Math.max(0, Math.min(255, value + (((i * 2654435761) >>> 0) % 81) - 40))) }
    const spread = (image: typeof clean) => {
      const paper = Array.from(image.data.subarray(0, 20 * 120))
      const mean = paper.reduce((sum, value) => sum + value, 0) / paper.length
      return Math.sqrt(paper.reduce((sum, value) => sum + (value - mean) ** 2, 0) / paper.length)
    }
    expect(spread(denoise(grainy))).toBeLessThan(spread(grainy) / 2)
  })
})

describe('rotateGray', () => {
  it('levels a tilted line when rotated by its slope', () => {
    const page = blankPage(400, 200)
    const slope = Math.tan((2 * Math.PI) / 180)
    for (let x = 0; x < 400; x++) fillRect(page, x, 100 + (x - 200) * slope, x, 101 + (x - 200) * slope, 0)
    const rotated = rotateGray(page, (2 * Math.PI) / 180)
    const rows = [50, 200, 350].map((x) => {
      for (let y = 0; y < 200; y++) if ((rotated.data[y * 400 + x] as number) < 128) return y
      return -1
    })
    expect(Math.max(...rows) - Math.min(...rows)).toBeLessThanOrEqual(1)
  })

  it('maps rotated points back to the source', () => {
    const angle = 0.03
    const back = rotatedToSource(angle, 401, 201, 200, 100)
    expect(back.x).toBeCloseTo(200, 5)
    expect(back.y).toBeCloseTo(100, 5)
    const off = rotatedToSource(angle, 401, 201, 300, 100)
    expect(off.y).toBeCloseTo(100 + 100 * Math.sin(angle), 5)
  })
})

describe('resizeGray', () => {
  it('averages the covered pixels', () => {
    const page = blankPage(8, 8)
    fillRect(page, 0, 0, 3, 7, 0)
    const small = resizeGray(page, 0.5)
    expect(small.width).toBe(4)
    expect(Array.from(small.data.subarray(0, 4))).toEqual([0, 0, 255, 255])
  })
})
