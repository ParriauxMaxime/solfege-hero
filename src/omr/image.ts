import type { BinaryImage, GrayImage } from './types'

const SAUVOLA_K = 0.25
const SAUVOLA_RANGE = 128
const MIN_CONTRAST = 25
const MIN_WINDOW = 15
const WINDOW_DIVISOR = 40
const WHITE = 255
const NOISE_STRIDE = 7
const PAPER_LEVEL = 150
/** For gaussian noise: sigma = 1.4826 x median absolute deviation, times sqrt(9/8) because the mean includes the pixel itself. */
const MEDIAN_DEVIATION_TO_SIGMA = 1.4826 * Math.sqrt(9 / 8)
const NOISE_PASS_LEVELS = [6, 16, 32]

export function rgbaToGray(rgba: ArrayLike<number>, width: number, height: number): GrayImage {
  const data = new Uint8Array(width * height)
  for (let i = 0; i < data.length; i++) {
    const alpha = (rgba[i * 4 + 3] as number) / 255
    const luma = 0.299 * (rgba[i * 4] as number) + 0.587 * (rgba[i * 4 + 1] as number) + 0.114 * (rgba[i * 4 + 2] as number)
    data[i] = Math.round(luma * alpha + WHITE * (1 - alpha))
  }
  return { width, height, data }
}

function oddWindow(width: number): number {
  const size = Math.max(MIN_WINDOW, Math.round(width / WINDOW_DIVISOR))
  return size % 2 === 0 ? size + 1 : size
}

/** Sauvola local threshold from running window sums, so memory stays linear in the width. */
export function binarize(gray: GrayImage): BinaryImage {
  const { width, height, data } = gray
  const radius = (oddWindow(width) - 1) / 2
  const out = new Uint8Array(width * height)
  const columnSum = new Float64Array(width)
  const columnSquares = new Float64Array(width)

  const addRow = (y: number, sign: 1 | -1) => {
    if (y < 0 || y >= height) return
    for (let x = 0; x < width; x++) {
      const value = data[y * width + x] as number
      columnSum[x] = (columnSum[x] as number) + sign * value
      columnSquares[x] = (columnSquares[x] as number) + sign * value * value
    }
  }

  for (let y = 0; y < Math.min(radius, height); y++) addRow(y, 1)
  for (let y = 0; y < height; y++) {
    addRow(y + radius, 1)
    addRow(y - radius - 1, -1)
    const rows = Math.min(height - 1, y + radius) - Math.max(0, y - radius) + 1
    let sum = 0
    let squares = 0
    let count = 0
    for (let x = 0; x < Math.min(radius, width); x++) {
      sum += columnSum[x] as number
      squares += columnSquares[x] as number
      count += rows
    }
    for (let x = 0; x < width; x++) {
      const entering = x + radius
      if (entering < width) {
        sum += columnSum[entering] as number
        squares += columnSquares[entering] as number
        count += rows
      }
      const leaving = x - radius - 1
      if (leaving >= 0) {
        sum -= columnSum[leaving] as number
        squares -= columnSquares[leaving] as number
        count -= rows
      }
      const mean = sum / count
      const variance = Math.max(0, squares / count - mean * mean)
      const threshold = mean * (1 + SAUVOLA_K * (Math.sqrt(variance) / SAUVOLA_RANGE - 1))
      const value = data[y * width + x] as number
      if (value < threshold && value < mean - MIN_CONTRAST) out[y * width + x] = 1
    }
  }
  return { width, height, data: out }
}

function boxBlur(gray: GrayImage): GrayImage {
  const { width, height, data } = gray
  const out = new Uint8Array(data.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let count = 0
      for (let dy = -1; dy <= 1; dy++) {
        const row = y + dy
        if (row < 0 || row >= height) continue
        for (let dx = -1; dx <= 1; dx++) {
          const column = x + dx
          if (column < 0 || column >= width) continue
          sum += data[row * width + column] as number
          count++
        }
      }
      out[y * width + x] = Math.round(sum / count)
    }
  }
  return { width, height, data: out }
}

/** Noise of the paper: the median deviation of bright pixels from their 3x3 mean, which ink edges barely move. */
function paperNoise(gray: GrayImage): number {
  const { width, height, data } = gray
  const histogram = new Int32Array(256)
  let samples = 0
  for (let y = 1; y < height - 1; y += NOISE_STRIDE) {
    for (let x = 1; x < width - 1; x += NOISE_STRIDE) {
      let sum = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += data[(y + dy) * width + x + dx] as number
      const mean = sum / 9
      if (mean < PAPER_LEVEL) continue
      const bin = Math.min(255, Math.round(Math.abs((data[y * width + x] as number) - mean)))
      histogram[bin] = (histogram[bin] as number) + 1
      samples++
    }
  }
  let seen = 0
  for (let bin = 0; bin < 256; bin++) {
    seen += histogram[bin] as number
    if (seen >= samples / 2) return bin * MEDIAN_DEVIATION_TO_SIGMA
  }
  return 0
}

/** Smooths grainy photos with 3x3 averages (one pass per noise level reached); clean images are returned untouched. */
export function denoise(gray: GrayImage): GrayImage {
  const noise = paperNoise(gray)
  const passes = NOISE_PASS_LEVELS.filter((level) => noise > level).length
  let result = gray
  for (let pass = 0; pass < passes; pass++) result = boxBlur(result)
  return result
}

/** Shrinks by `scale` (< 1) averaging the source pixels each new pixel covers. */
export function resizeGray(gray: GrayImage, scale: number): GrayImage {
  const width = Math.max(1, Math.round(gray.width * scale))
  const height = Math.max(1, Math.round(gray.height * scale))
  const out = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y / scale)
    const y1 = Math.max(y0 + 1, Math.min(gray.height, Math.ceil((y + 1) / scale)))
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x / scale)
      const x1 = Math.max(x0 + 1, Math.min(gray.width, Math.ceil((x + 1) / scale)))
      let sum = 0
      for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) sum += gray.data[sy * gray.width + sx] as number
      out[y * width + x] = Math.round(sum / ((y1 - y0) * (x1 - x0)))
    }
  }
  return { width, height, data: out }
}

/** Rotates around the centre; an angle equal to the slope of a tilted line makes it horizontal. The canvas keeps its size. */
export function rotateGray(gray: GrayImage, angle: number): GrayImage {
  const { width, height, data } = gray
  const out = new Uint8Array(width * height).fill(WHITE)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const cx = (width - 1) / 2
  const cy = (height - 1) / 2
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = (x - cx) * cos - (y - cy) * sin + cx
      const sy = (x - cx) * sin + (y - cy) * cos + cy
      const x0 = Math.floor(sx)
      const y0 = Math.floor(sy)
      if (x0 < 0 || y0 < 0 || x0 >= width - 1 || y0 >= height - 1) continue
      const fx = sx - x0
      const fy = sy - y0
      const i = y0 * width + x0
      const top = (data[i] as number) * (1 - fx) + (data[i + 1] as number) * fx
      const bottom = (data[i + width] as number) * (1 - fx) + (data[i + width + 1] as number) * fx
      out[y * width + x] = Math.round(top * (1 - fy) + bottom * fy)
    }
  }
  return { width, height, data: out }
}

/** Maps a point of an image rotated with `rotateGray` back to the source image. */
export function rotatedToSource(angle: number, width: number, height: number, x: number, y: number): { x: number; y: number } {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const cx = (width - 1) / 2
  const cy = (height - 1) / 2
  return { x: (x - cx) * cos - (y - cy) * sin + cx, y: (x - cx) * sin + (y - cy) * cos + cy }
}
