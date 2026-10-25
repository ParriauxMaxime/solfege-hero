import { rasterize } from '../rasterize'
import type { Shape } from '../rasterize'
import type { GrayImage } from '../types'

const BLACK = 0
const WHITE = 255

export function blankPage(width: number, height: number): GrayImage {
  return { width, height, data: new Uint8Array(width * height).fill(WHITE) }
}

export function fillRect(image: GrayImage, x0: number, y0: number, x1: number, y1: number, value = BLACK): void {
  for (let y = Math.max(0, Math.round(y0)); y <= Math.min(image.height - 1, Math.round(y1)); y++) {
    for (let x = Math.max(0, Math.round(x0)); x <= Math.min(image.width - 1, Math.round(x1)); x++) image.data[y * image.width + x] = value
  }
}

export function fillEllipse(image: GrayImage, cx: number, cy: number, rx: number, ry: number, tilt = 0, value = BLACK): void {
  const cos = Math.cos(tilt)
  const sin = Math.sin(tilt)
  const reach = Math.ceil(Math.max(rx, ry))
  for (let y = Math.floor(cy - reach); y <= Math.ceil(cy + reach); y++) {
    for (let x = Math.floor(cx - reach); x <= Math.ceil(cx + reach); x++) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue
      const u = (x - cx) * cos + (y - cy) * sin
      const v = -(x - cx) * sin + (y - cy) * cos
      if ((u / rx) ** 2 + (v / ry) ** 2 <= 1) image.data[y * image.width + x] = value
    }
  }
}

/** Thick line segment drawn by stamping discs along it. */
export function drawLine(image: GrayImage, x0: number, y0: number, x1: number, y1: number, thickness: number, value = BLACK): void {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    fillEllipse(image, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, thickness / 2, thickness / 2, 0, value)
  }
}

export interface DrawnStaff {
  left: number
  right: number
  /** Row of the top line. */
  top: number
  unit: number
  thickness: number
}

/** Five staff lines, optionally tilted by `slope` (rows per column) and with a bar line at both ends. */
export function drawStaff(image: GrayImage, staff: DrawnStaff, slope = 0): void {
  for (let line = 0; line < 5; line++) {
    for (let x = staff.left; x <= staff.right; x++) {
      const y = staff.top + line * staff.unit + (x - staff.left) * slope
      fillRect(image, x, y - staff.thickness / 2 + 0.5, x, y + staff.thickness / 2 - 0.5)
    }
  }
  const bottom = staff.top + 4 * staff.unit
  fillRect(image, staff.left, staff.top, staff.left + 1, bottom)
  fillRect(image, staff.right - 1, staff.top, staff.right, bottom)
}

export function stepRow(staff: DrawnStaff, step: number): number {
  return staff.top + (8 - step) * (staff.unit / 2)
}

/** A quarter note: filled head on `step` with a stem on the side the engraving rules give. */
export function drawQuarter(image: GrayImage, staff: DrawnStaff, x: number, step: number): void {
  const { unit } = staff
  const y = stepRow(staff, step)
  fillEllipse(image, x, y, unit * 0.62, unit * 0.43, -0.35)
  if (step < 4) drawLine(image, x + unit * 0.55, y, x + unit * 0.55, y - unit * 3.2, 2)
  else drawLine(image, x - unit * 0.55, y, x - unit * 0.55, y + unit * 3.2, 2)
}

export function drawLedgerLines(image: GrayImage, staff: DrawnStaff, x: number, step: number): void {
  const { unit } = staff
  const half = unit * 0.95
  for (let s = -2; s >= step; s -= 2) fillRect(image, x - half, stepRow(staff, s) - 1, x + half, stepRow(staff, s) + 1)
  for (let s = 10; s <= step; s += 2) fillRect(image, x - half, stepRow(staff, s) - 1, x + half, stepRow(staff, s) + 1)
}

function stemFoot(staff: DrawnStaff, x: number, step: number): { sx: number; tip: number; inward: 1 | -1 } {
  const y = stepRow(staff, step)
  return step < 4
    ? { sx: x + staff.unit * 0.55, tip: y - staff.unit * 3.2, inward: 1 }
    : { sx: x - staff.unit * 0.55, tip: y + staff.unit * 3.2, inward: -1 }
}

/** `count` curled flags at the free end of the stem `drawQuarter` draws. */
export function drawFlag(image: GrayImage, staff: DrawnStaff, x: number, step: number, count: number): void {
  const { unit } = staff
  const { sx, tip, inward } = stemFoot(staff, x, step)
  for (let flag = 0; flag < count; flag++) {
    const y = tip + inward * flag * unit * 0.5
    drawLine(image, sx, y, sx + unit * 0.9, y + inward * unit * 1.1, 3)
  }
}

/** `count` straight beams joining the stems of two notes drawn with `drawQuarter` on the same step. */
export function drawBeam(image: GrayImage, staff: DrawnStaff, x1: number, x2: number, step: number, count: number): void {
  const first = stemFoot(staff, x1, step)
  const second = stemFoot(staff, x2, step)
  for (let beam = 0; beam < count; beam++) {
    const offset = first.inward * beam * (staff.unit * 0.5)
    fillRect(image, first.sx - 1, first.tip + offset - (first.inward === 1 ? 0 : 6), second.sx + 1, first.tip + offset - (first.inward === 1 ? 0 : 6) + 6)
  }
}

/** Stamps glyph shapes (16 units per staff space) with their origin at (x, y), scaled to the staff. */
export function stampGlyph(image: GrayImage, staff: DrawnStaff, shapes: Shape[], x: number, y: number): void {
  const scale = staff.unit / 16
  const raster = rasterize(shapes, scale)
  for (let row = 0; row < raster.height; row++) {
    for (let column = 0; column < raster.width; column++) {
      if ((raster.data[row * raster.width + column] as number) < 0.5) continue
      const px = Math.round(x + raster.x0 * scale + column)
      const py = Math.round(y + raster.y0 * scale + row)
      if (px >= 0 && py >= 0 && px < image.width && py < image.height) image.data[py * image.width + px] = BLACK
    }
  }
}

export function drawBarLine(image: GrayImage, staff: DrawnStaff, x: number): void {
  fillRect(image, x, staff.top, x + 1, staff.top + 4 * staff.unit)
}

/** Hollow head: a ring around a white inner ellipse. */
export function drawHollowHead(image: GrayImage, staff: DrawnStaff, x: number, step: number): void {
  const { unit } = staff
  const y = stepRow(staff, step)
  fillEllipse(image, x, y, unit * 0.65, unit * 0.45, -0.3)
  fillEllipse(image, x, y, unit * 0.4, unit * 0.2, -0.9, WHITE)
}
