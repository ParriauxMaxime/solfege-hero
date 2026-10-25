import type { Point } from './types'

export type Shape =
  | { kind: 'stroke'; polylines: Point[][]; width: number }
  | { kind: 'disc'; cx: number; cy: number; radius: number }
  | { kind: 'polygon'; points: Point[] }

export interface Raster {
  width: number
  height: number
  /** Glyph-unit position of the top-left pixel. */
  x0: number
  y0: number
  /** Coverage 0..1 per pixel. */
  data: Float32Array
}

const CURVE_SEGMENTS = 12
const SUPERSAMPLING = 3

function numbersIn(text: string): number[] {
  return (text.match(/-?\d*\.?\d+/g) ?? []).map(Number)
}

/** Flattens an absolute SVG path made of M, L, H, V, C and Z into polylines. */
export function flattenPath(d: string): Point[][] {
  const polylines: Point[][] = []
  let current: Point[] = []
  let at: Point = { x: 0, y: 0 }
  let start: Point = at
  for (const [, command, args] of d.matchAll(/([MLHVCZ])([^MLHVCZ]*)/g)) {
    const n = numbersIn(args as string)
    if (command === 'M') {
      if (current.length > 1) polylines.push(current)
      at = { x: n[0] as number, y: n[1] as number }
      start = at
      current = [at]
    } else if (command === 'L') {
      at = { x: n[0] as number, y: n[1] as number }
      current.push(at)
    } else if (command === 'H') {
      at = { x: n[0] as number, y: at.y }
      current.push(at)
    } else if (command === 'V') {
      at = { x: at.x, y: n[0] as number }
      current.push(at)
    } else if (command === 'C') {
      for (let i = 0; i + 6 <= n.length; i += 6) {
        const [x1, y1, x2, y2, x3, y3] = n.slice(i, i + 6) as [number, number, number, number, number, number]
        const from = at
        for (let k = 1; k <= CURVE_SEGMENTS; k++) {
          const t = k / CURVE_SEGMENTS
          const u = 1 - t
          current.push({
            x: u ** 3 * from.x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3,
            y: u ** 3 * from.y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3,
          })
        }
        at = { x: x3, y: y3 }
      }
    } else {
      current.push(start)
      at = start
    }
  }
  if (current.length > 1) polylines.push(current)
  return polylines
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function insidePolygon(p: Point, points: Point[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i] as Point
    const b = points[j] as Point
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function covers(shape: Shape, p: Point): boolean {
  if (shape.kind === 'disc') return Math.hypot(p.x - shape.cx, p.y - shape.cy) <= shape.radius
  if (shape.kind === 'polygon') return insidePolygon(p, shape.points)
  return shape.polylines.some((line) =>
    line.some((point, i) => i > 0 && distanceToSegment(p, line[i - 1] as Point, point) <= shape.width / 2),
  )
}

function boundsOf(shape: Shape): { x0: number; y0: number; x1: number; y1: number } {
  if (shape.kind === 'disc') {
    return { x0: shape.cx - shape.radius, y0: shape.cy - shape.radius, x1: shape.cx + shape.radius, y1: shape.cy + shape.radius }
  }
  const points = shape.kind === 'polygon' ? shape.points : shape.polylines.flat()
  const pad = shape.kind === 'stroke' ? shape.width / 2 : 0
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return { x0: Math.min(...xs) - pad, y0: Math.min(...ys) - pad, x1: Math.max(...xs) + pad, y1: Math.max(...ys) + pad }
}

/** Rasterises shapes given in glyph units at `scale` pixels per unit, with a supersampled coverage per pixel. */
export function rasterize(shapes: Shape[], scale: number): Raster {
  const boxes = shapes.map(boundsOf)
  const x0 = Math.min(...boxes.map((b) => b.x0))
  const y0 = Math.min(...boxes.map((b) => b.y0))
  const width = Math.ceil((Math.max(...boxes.map((b) => b.x1)) - x0) * scale) + 1
  const height = Math.ceil((Math.max(...boxes.map((b) => b.y1)) - y0) * scale) + 1
  const data = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let hits = 0
      for (let sy = 0; sy < SUPERSAMPLING; sy++) {
        for (let sx = 0; sx < SUPERSAMPLING; sx++) {
          const p = { x: x0 + (x + (sx + 0.5) / SUPERSAMPLING) / scale, y: y0 + (y + (sy + 0.5) / SUPERSAMPLING) / scale }
          if (shapes.some((shape) => covers(shape, p))) hits++
        }
      }
      data[y * width + x] = hits / (SUPERSAMPLING * SUPERSAMPLING)
    }
  }
  return { width, height, x0, y0, data }
}

export function translated(polylines: Point[][], dx: number, dy: number): Point[][] {
  return polylines.map((line) => line.map((p) => ({ x: p.x + dx, y: p.y + dy })))
}

export function strokePath(d: string, width: number, dx = 0, dy = 0): Shape {
  return { kind: 'stroke', polylines: translated(flattenPath(d), dx, dy), width }
}
