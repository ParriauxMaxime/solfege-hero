import { inflateSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import type { GrayImage } from '../types'

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 }

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

function unfilter(raw: Uint8Array, width: number, height: number, bytesPerPixel: number): Uint8Array {
  const stride = width * bytesPerPixel
  const out = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] as number
    const line = y * (stride + 1) + 1
    for (let i = 0; i < stride; i++) {
      const left = i >= bytesPerPixel ? (out[y * stride + i - bytesPerPixel] as number) : 0
      const up = y > 0 ? (out[(y - 1) * stride + i] as number) : 0
      const upLeft = y > 0 && i >= bytesPerPixel ? (out[(y - 1) * stride + i - bytesPerPixel] as number) : 0
      const value = raw[line + i] as number
      let predictor = 0
      if (filter === 1) predictor = left
      else if (filter === 2) predictor = up
      else if (filter === 3) predictor = (left + up) >> 1
      else if (filter === 4) predictor = paeth(left, up, upLeft)
      out[y * stride + i] = (value + predictor) & 255
    }
  }
  return out
}

/** Decodes a non-interlaced 8-bit grayscale, gray+alpha, RGB or RGBA PNG to gray, compositing alpha over white. */
export function decodePng(bytes: Uint8Array): GrayImage {
  if (SIGNATURE.some((value, i) => bytes[i] !== value)) throw new Error('not a PNG file')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let width = 0
  let height = 0
  let colorType = 0
  const chunks: Uint8Array[] = []
  for (let offset = 8; offset < bytes.length; ) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    const body = bytes.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = view.getUint32(offset + 8)
      height = view.getUint32(offset + 12)
      if (bytes[offset + 16] !== 8 || bytes[offset + 20] !== 0) throw new Error('only 8-bit non-interlaced PNG')
      colorType = bytes[offset + 17] as number
    } else if (type === 'IDAT') chunks.push(body)
    else if (type === 'IEND') break
    offset += length + 12
  }
  const channels = CHANNELS[colorType]
  if (!channels) throw new Error(`unsupported PNG colour type ${colorType}`)
  const joined = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0))
  let position = 0
  for (const chunk of chunks) {
    joined.set(chunk, position)
    position += chunk.length
  }
  const pixels = unfilter(inflateSync(joined), width, height, channels)
  const data = new Uint8Array(width * height)
  for (let i = 0; i < data.length; i++) {
    const base = i * channels
    const gray = channels >= 3 ? 0.299 * (pixels[base] as number) + 0.587 * (pixels[base + 1] as number) + 0.114 * (pixels[base + 2] as number) : (pixels[base] as number)
    const alpha = channels === 2 ? (pixels[base + 1] as number) : channels === 4 ? (pixels[base + 3] as number) : 255
    data[i] = Math.round((gray * alpha + 255 * (255 - alpha)) / 255)
  }
  return { width, height, data }
}

export function readPng(path: string | URL): GrayImage {
  return decodePng(readFileSync(path))
}
