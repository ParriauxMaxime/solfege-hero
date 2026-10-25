import type { Raster } from './rasterize'

/** A glyph resampled to a fixed grid, so shapes compare whatever their scale. */
export interface Patch {
  columns: number
  rows: number
  values: Float32Array
  /** Width over height of the ink bounding box. */
  aspect: number
}

export interface BoxBounds {
  x0: number
  y0: number
  /** Inclusive. */
  x1: number
  y1: number
}

/** Area-averaged resampling of the ink inside `bounds` to `columns` x `rows`. */
export function samplePatch(ink: (x: number, y: number) => number, bounds: BoxBounds, columns: number, rows: number): Patch {
  const width = bounds.x1 - bounds.x0 + 1
  const height = bounds.y1 - bounds.y0 + 1
  const values = new Float32Array(columns * rows)
  const counts = new Float32Array(columns * rows)
  for (let y = 0; y < height; y++) {
    const row = Math.min(rows - 1, Math.floor((y / height) * rows))
    for (let x = 0; x < width; x++) {
      const column = Math.min(columns - 1, Math.floor((x / width) * columns))
      values[row * columns + column] = (values[row * columns + column] as number) + ink(bounds.x0 + x, bounds.y0 + y)
      counts[row * columns + column] = (counts[row * columns + column] as number) + 1
    }
  }
  for (let i = 0; i < values.length; i++) values[i] = (values[i] as number) / Math.max(1, counts[i] as number)
  return { columns, rows, values, aspect: width / height }
}

export function patchOfRaster(raster: Raster, columns: number, rows: number): Patch {
  let x0 = raster.width
  let y0 = raster.height
  let x1 = 0
  let y1 = 0
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      if ((raster.data[y * raster.width + x] as number) < 0.5) continue
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      y0 = Math.min(y0, y)
      y1 = Math.max(y1, y)
    }
  }
  return samplePatch((x, y) => raster.data[y * raster.width + x] as number, { x0, y0, x1, y1 }, columns, rows)
}

/** Zero-mean normalised correlation, -1..1. */
export function correlation(a: Patch, b: Patch): number {
  const n = a.values.length
  let meanA = 0
  let meanB = 0
  for (let i = 0; i < n; i++) {
    meanA += a.values[i] as number
    meanB += b.values[i] as number
  }
  meanA /= n
  meanB /= n
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < n; i++) {
    const da = (a.values[i] as number) - meanA
    const db = (b.values[i] as number) - meanB
    dot += da * db
    normA += da * da
    normB += db * db
  }
  return normA === 0 || normB === 0 ? 0 : dot / Math.sqrt(normA * normB)
}

export interface Match<T> {
  name: T
  score: number
}

/** Templates ranked by correlation, discounted when the bounding box proportions differ. */
export function rankTemplates<T>(candidate: Patch, templates: readonly { name: T; patch: Patch }[]): Match<T>[] {
  return templates
    .map(({ name, patch }) => {
      const ratio = candidate.aspect / patch.aspect
      const proportion = Math.max(0, 1 - Math.abs(Math.log(ratio)) / Math.log(2.2))
      return { name, score: correlation(candidate, patch) * (0.5 + 0.5 * proportion) }
    })
    .sort((a, b) => b.score - a.score)
}
