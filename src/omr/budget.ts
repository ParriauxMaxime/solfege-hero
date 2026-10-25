import { binarize, rgbaToGray } from './image'
import { measureStaffMetrics } from './staves'
import type { GrayImage } from './types'

/** Width of the first, cheap render that only measures the staff spacing. */
export const PROBE_WIDTH = 800
/** Staff spacing, in pixels, the symbol heuristics read reliably (they enlarge anything smaller). */
export const WORKING_UNIT = 16
export const DEFAULT_MAX_WIDTH = 2480
export const PHONE_MAX_WIDTH = 1400
export const MAX_PAGE_PIXELS = 12_000_000
export const LOW_MEMORY_GIGABYTES = 4
/** Rows converted to gray per `getImageData`, so a full-size RGBA copy of the page never exists. */
export const GRAY_STRIP_ROWS = 128

export interface WidthPlan {
  width: number
  /** The width was cut below what the staves need, to spare the device's memory. */
  reduced: boolean
}

export function isLowMemoryDevice(deviceMemory: number | undefined): boolean {
  return deviceMemory !== undefined && deviceMemory <= LOW_MEMORY_GIGABYTES
}

/** Staff spacing of a page rendered at PROBE_WIDTH, or null when no staff shows. */
export function probeUnit(gray: GrayImage): number | null {
  return measureStaffMetrics(binarize(gray))?.unit ?? null
}

/**
 * Width to render the page at: the one giving a staff spacing of WORKING_UNIT, never below the probe, never above the source,
 * capped at DEFAULT_MAX_WIDTH, or at PHONE_MAX_WIDTH on a small device or when even that page would exceed MAX_PAGE_PIXELS.
 */
export function planWidth(probeWidth: number, unit: number | null, aspect: number, deviceMemory: number | undefined, sourceWidth?: number): WidthPlan {
  const needed = unit ? (probeWidth * WORKING_UNIT) / unit : DEFAULT_MAX_WIDTH
  const wanted = Math.min(Math.max(probeWidth, needed), sourceWidth ?? Infinity, DEFAULT_MAX_WIDTH)
  const crowded = wanted * wanted * aspect > MAX_PAGE_PIXELS
  const cap = isLowMemoryDevice(deviceMemory) || crowded ? PHONE_MAX_WIDTH : DEFAULT_MAX_WIDTH
  return { width: Math.round(Math.min(wanted, Math.max(cap, probeWidth))), reduced: wanted > cap }
}

/** Anything that can be read back as RGBA rows: an offscreen or a regular canvas context. */
export interface RowReader {
  width: number
  height: number
  rows: (y: number, count: number) => Uint8ClampedArray
}

/** Gray copy of a canvas, read a strip at a time. */
export function grayFromRows(reader: RowReader): GrayImage {
  const { width, height } = reader
  const data = new Uint8Array(width * height)
  for (let y = 0; y < height; y += GRAY_STRIP_ROWS) {
    const count = Math.min(GRAY_STRIP_ROWS, height - y)
    data.set(rgbaToGray(reader.rows(y, count), width, count).data, y * width)
  }
  return { width, height, data }
}
