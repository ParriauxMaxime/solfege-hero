import type { BinaryImage } from './types'

export interface Component {
  /** Label of its pixels in `Labelling.labels`. */
  label: number
  x0: number
  y0: number
  /** Inclusive. */
  x1: number
  y1: number
  area: number
}

export interface Labelling {
  labels: Int32Array
  components: Component[]
}

const NEIGHBOURS_4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const NEIGHBOURS_8: readonly (readonly [number, number])[] = [...NEIGHBOURS_4, [1, 1], [-1, -1], [1, -1], [-1, 1]]

/** Connected components of the pixels equal to `target`; labels start at 1, 0 is the other colour. */
export function labelComponents(image: BinaryImage, target: 0 | 1, eightConnected: boolean): Labelling {
  const { width, height, data } = image
  const labels = new Int32Array(width * height)
  const components: Component[] = []
  const neighbours = eightConnected ? NEIGHBOURS_8 : NEIGHBOURS_4
  const stack = new Int32Array(width * height)
  for (let start = 0; start < data.length; start++) {
    if (data[start] !== target || labels[start]) continue
    const label = components.length + 1
    const component: Component = { label, x0: width, y0: height, x1: 0, y1: 0, area: 0 }
    let top = 0
    stack[top++] = start
    labels[start] = label
    while (top > 0) {
      const index = stack[--top] as number
      const x = index % width
      const y = (index - x) / width
      component.area++
      if (x < component.x0) component.x0 = x
      if (x > component.x1) component.x1 = x
      if (y < component.y0) component.y0 = y
      if (y > component.y1) component.y1 = y
      for (const [dx, dy] of neighbours) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const next = ny * width + nx
        if (data[next] !== target || labels[next]) continue
        labels[next] = label
        stack[top++] = next
      }
    }
    components.push(component)
  }
  return { labels, components }
}

/** The pixels of one component cropped to its bounding box, optionally keeping only those that are ink in `ink`. */
export function componentMask(labelling: Labelling, imageWidth: number, component: Component, ink?: BinaryImage): BinaryImage {
  const width = component.x1 - component.x0 + 1
  const height = component.y1 - component.y0 + 1
  const data = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (component.y0 + y) * imageWidth + component.x0 + x
      if (labelling.labels[index] === component.label && (!ink || ink.data[index])) data[y * width + x] = 1
    }
  }
  return { width, height, data }
}

/** Sets to ink the background pockets under `maxArea` that do not reach the border and that `keepOpen` does not veto. */
export function fillSmallHoles(image: BinaryImage, maxArea: number, keepOpen: (pocket: Component, labelling: Labelling) => boolean = () => false): BinaryImage {
  const { width, height } = image
  const out = { width, height, data: image.data.slice() }
  const labelling = labelComponents(image, 0, false)
  const { labels, components } = labelling
  const keep = new Set<number>()
  for (const component of components) {
    const touchesBorder = component.x0 === 0 || component.y0 === 0 || component.x1 === width - 1 || component.y1 === height - 1
    if (touchesBorder || component.area >= maxArea || keepOpen(component, labelling)) keep.add(component.label)
  }
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i] as number
    if (label && !keep.has(label)) out.data[i] = 1
  }
  return out
}

function slide(source: Uint8Array, width: number, height: number, size: number, vertical: boolean, all: boolean): Uint8Array {
  const out = new Uint8Array(source.length)
  const radius = (size - 1) / 2
  const lines = vertical ? width : height
  const length = vertical ? height : width
  const stride = vertical ? width : 1
  const lineStride = vertical ? 1 : width
  const prefix = new Int32Array(length + 1)
  for (let line = 0; line < lines; line++) {
    const base = line * lineStride
    for (let i = 0; i < length; i++) prefix[i + 1] = (prefix[i] as number) + (source[base + i * stride] as number)
    for (let i = 0; i < length; i++) {
      const from = i - radius
      const to = i + radius
      if (all && (from < 0 || to >= length)) continue
      const count = (prefix[Math.min(length - 1, to) + 1] as number) - (prefix[Math.max(0, from)] as number)
      if (all ? count === size : count > 0) out[base + i * stride] = 1
    }
  }
  return out
}

/** Morphological opening with a square structuring element of odd side `size`. */
export function openSquare(image: BinaryImage, size: number): BinaryImage {
  const { width, height, data } = image
  const eroded = slide(slide(data, width, height, size, false, true), width, height, size, true, true)
  const dilated = slide(slide(eroded, width, height, size, false, false), width, height, size, true, false)
  return { width, height, data: dilated }
}

/** Morphological closing with a square of odd side `size`, padded so strokes touching the border survive. */
export function closeSquare(image: BinaryImage, size: number): BinaryImage {
  const { width, height, data } = image
  const radius = (size - 1) / 2
  const padded = new Uint8Array((width + 2 * radius) * (height + 2 * radius))
  const paddedWidth = width + 2 * radius
  for (let y = 0; y < height; y++) padded.set(data.subarray(y * width, (y + 1) * width), (y + radius) * paddedWidth + radius)
  const dilated = slide(slide(padded, paddedWidth, height + 2 * radius, size, false, false), paddedWidth, height + 2 * radius, size, true, false)
  const closed = slide(slide(dilated, paddedWidth, height + 2 * radius, size, false, true), paddedWidth, height + 2 * radius, size, true, true)
  const out = new Uint8Array(data.length)
  for (let y = 0; y < height; y++) out.set(closed.subarray((y + radius) * paddedWidth + radius, (y + radius) * paddedWidth + radius + width), y * width)
  return { width, height, data: out }
}

export function toOdd(value: number): number {
  const rounded = Math.max(1, Math.round(value))
  return rounded % 2 === 0 ? rounded + 1 : rounded
}
