import { closeSquare, toOdd } from './components'
import type { Staff } from './staves'
import type { BinaryImage } from './types'

/** Band of the page around one staff, with its staff lines (and the ledger lines they extend to) erased. */
export interface StaffCrop {
  unit: number
  thickness: number
  originX: number
  originY: number
  /** Ink as binarised, staff lines included. */
  raw: BinaryImage
  /** Ink without staff and ledger lines. */
  clean: BinaryImage
  /** `clean` with the small breaks the line removal leaves in thin strokes closed, for grouping pixels into glyphs. */
  closed: BinaryImage
  /** Row of the top line's centre per column of the crop. */
  topY: Float32Array
}

const BAND_UNITS = 7
/** Extra pixels a vertical run may have over the line thickness and still be a bare staff line. */
const LINE_TOLERANCE = 1
const LEDGER_LINES_ABOVE = 6
const LEDGER_LINES_BELOW = 6
const CLOSING_UNITS = 0.3

export function cropStaff(page: BinaryImage, staff: Staff, yMin: number, yMax: number): StaffCrop {
  const topLine = staff.topY[Math.round((staff.left + staff.right) / 2)] as number
  const bandTop = Math.max(0, Math.floor(Math.max(yMin, topLine - BAND_UNITS * staff.unit)))
  const bandBottom = Math.min(page.height - 1, Math.ceil(Math.min(yMax, topLine + (4 + BAND_UNITS) * staff.unit)))
  const originX = staff.left
  const width = staff.right - staff.left + 1
  const height = bandBottom - bandTop + 1
  const raw = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    const source = (y + bandTop) * page.width + originX
    raw.set(page.data.subarray(source, source + width), y * width)
  }
  const topY = new Float32Array(width)
  for (let x = 0; x < width; x++) topY[x] = (staff.topY[x + originX] as number) - bandTop
  const clean = { width, height, data: raw.slice() }
  const crop: StaffCrop = {
    unit: staff.unit,
    thickness: staff.thickness,
    originX,
    originY: bandTop,
    raw: { width, height, data: raw },
    clean,
    closed: clean,
    topY,
  }
  eraseStaffLines(crop)
  crop.closed = closeSquare(clean, toOdd(staff.unit * CLOSING_UNITS))
  return crop
}

function eraseStaffLines(crop: StaffCrop): void {
  const { width, height, data } = crop.clean
  const maxRun = crop.thickness + LINE_TOLERANCE
  const reach = crop.thickness + 1
  for (let x = 0; x < width; x++) {
    const top = crop.topY[x] as number
    let run = 0
    for (let y = 0; y <= height; y++) {
      if (y < height && data[y * width + x]) {
        run++
        continue
      }
      if (run > 0 && run <= maxRun) {
        const centre = y - (run + 1) / 2
        const line = Math.round((centre - top) / crop.unit)
        const onLine = line >= -LEDGER_LINES_ABOVE && line <= 4 + LEDGER_LINES_BELOW
        if (onLine && Math.abs(centre - (top + line * crop.unit)) <= reach) {
          for (let k = y - run; k < y; k++) data[k * width + x] = 0
        }
      }
      run = 0
    }
  }
}

export function topAt(crop: StaffCrop, x: number): number {
  return crop.topY[Math.min(crop.topY.length - 1, Math.max(0, Math.round(x)))] as number
}

/** Staff steps above the bottom line at a crop point. */
export function stepAt(crop: StaffCrop, x: number, y: number): number {
  return (topAt(crop, x) + 4 * crop.unit - y) / (crop.unit / 2)
}
