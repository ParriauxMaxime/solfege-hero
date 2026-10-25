import type { BinaryImage } from './types'

const MAX_SKEW_DEGREES = 5
const COARSE_STEP = 0.5
const FINE_STEP = 0.05
const MAX_SAMPLES = 400_000
const MIN_SAMPLES = 100

function inkSamples(image: BinaryImage): { xs: Float32Array; ys: Float32Array } {
  const { width, height, data } = image
  let total = 0
  for (let i = 0; i < data.length; i++) total += data[i] as number
  const stride = Math.max(1, Math.ceil(total / MAX_SAMPLES))
  const xs = new Float32Array(Math.ceil(total / stride))
  const ys = new Float32Array(xs.length)
  let seen = 0
  let kept = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!data[y * width + x]) continue
      if (seen++ % stride === 0) {
        xs[kept] = x - width / 2
        ys[kept] = y
        kept++
      }
    }
  }
  return { xs: xs.subarray(0, kept), ys: ys.subarray(0, kept) }
}

function projectionSharpness(xs: Float32Array, ys: Float32Array, degrees: number, height: number): number {
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const bins = new Float64Array(height * 3)
  for (let i = 0; i < xs.length; i++) {
    const bin = Math.round((ys[i] as number) * cos - (xs[i] as number) * sin) + height
    if (bin >= 0 && bin < bins.length) bins[bin] = (bins[bin] as number) + 1
  }
  let sharpness = 0
  for (let i = 0; i < bins.length; i++) sharpness += (bins[i] as number) ** 2
  return sharpness
}

/** Angle in degrees such that rotating the page by it makes the staff lines horizontal. */
export function estimateSkew(image: BinaryImage): number {
  const { xs, ys } = inkSamples(image)
  if (xs.length < MIN_SAMPLES) return 0
  const sharpness = (degrees: number) => projectionSharpness(xs, ys, degrees, image.height)
  let best = 0
  let bestScore = -1
  const search = (from: number, to: number, step: number) => {
    for (let degrees = from; degrees <= to + 1e-9; degrees += step) {
      const score = sharpness(degrees)
      if (score > bestScore) {
        bestScore = score
        best = degrees
      }
    }
  }
  search(-MAX_SKEW_DEGREES, MAX_SKEW_DEGREES, COARSE_STEP)
  const coarse = best
  search(coarse - COARSE_STEP, coarse + COARSE_STEP, FINE_STEP)
  return best
}
