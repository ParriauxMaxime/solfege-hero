import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { decodePng } from './png'

function chunk(type: string, body: number[]): number[] {
  const length = body.length
  return [(length >>> 24) & 255, (length >>> 16) & 255, (length >>> 8) & 255, length & 255, ...[...type].map((c) => c.charCodeAt(0)), ...body, 0, 0, 0, 0]
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)]
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** Encodes `rows` of samples, row r using filter type r % 5. */
function encode(width: number, rows: number[][], colorType: number, channels: number): Uint8Array {
  const raw: number[] = []
  rows.forEach((row, r) => {
    const filter = r % 5
    raw.push(filter)
    row.forEach((value, i) => {
      const left = i >= channels ? (row[i - channels] as number) : 0
      const up = r > 0 ? ((rows[r - 1] as number[])[i] as number) : 0
      const upLeft = r > 0 && i >= channels ? ((rows[r - 1] as number[])[i - channels] as number) : 0
      const predictor = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter] as number
      raw.push((value - predictor + 256) & 255)
    })
  })
  const header = [0, 0, 0, width, 0, 0, 0, rows.length, 8, colorType, 0, 0, 0]
  return Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, ...chunk('IHDR', header), ...chunk('IDAT', [...deflateSync(Uint8Array.from(raw))]), ...chunk('IEND', [])])
}

describe('decodePng', () => {
  it('undoes the five scanline filters on grayscale', () => {
    const rows = Array.from({ length: 6 }, (_, r) => Array.from({ length: 5 }, (_, x) => (r * 37 + x * 53) % 256))
    const image = decodePng(encode(5, rows, 0, 1))
    expect(image.width).toBe(5)
    expect(image.height).toBe(6)
    expect([...image.data]).toEqual(rows.flat())
  })

  it('converts RGB to luma', () => {
    const image = decodePng(encode(2, [[255, 0, 0, 255, 255, 255]], 2, 3))
    expect([...image.data]).toEqual([76, 255])
  })

  it('composites RGBA and gray+alpha over white', () => {
    expect([...decodePng(encode(1, [[0, 0, 0, 0]], 6, 4)).data]).toEqual([255])
    expect([...decodePng(encode(2, [[0, 255, 100, 0]], 4, 2)).data]).toEqual([0, 255])
  })

  it('rejects other files', () => {
    expect(() => decodePng(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow()
  })
})
