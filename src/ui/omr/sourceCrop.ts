import type { Box } from '../../omr/types'
import { el } from '../dom'

const MAX_CROP_PIXELS_HIGH = 260
const MIN_STROKE = 2
const STROKE_DIVISOR = 36

export interface SourceCrop {
  element: HTMLElement
  /** Draws `staff` of the source image and outlines `note`, scrolling it into view. */
  show: (staff: Box | null, note: Box | null) => void
}

function cssColour(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function createSourceCrop(source: ImageBitmap): SourceCrop {
  const canvas = el('canvas', 'omr-crop-canvas')
  const element = el('div', 'omr-crop', canvas)
  element.setAttribute('aria-label', 'Portée de la photo')

  function show(staff: Box | null, note: Box | null): void {
    element.hidden = !staff
    if (!staff) return
    const scale = Math.min(1, MAX_CROP_PIXELS_HIGH / staff.height)
    canvas.width = Math.max(1, Math.ceil(staff.width * scale))
    canvas.height = Math.max(1, Math.ceil(staff.height * scale))
    const context = canvas.getContext('2d')
    if (!context) return
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(source, staff.x, staff.y, staff.width, staff.height, 0, 0, canvas.width, canvas.height)
    if (!note) {
      element.scrollLeft = 0
      return
    }
    const outline = { x: (note.x - staff.x) * scale, y: (note.y - staff.y) * scale, width: note.width * scale, height: note.height * scale }
    context.fillStyle = `${cssColour('--accent')}55`
    context.fillRect(outline.x, outline.y, outline.width, outline.height)
    context.strokeStyle = cssColour('--accent')
    context.lineWidth = Math.max(MIN_STROKE, canvas.height / STROKE_DIVISOR)
    context.strokeRect(outline.x, outline.y, outline.width, outline.height)
    const shown = canvas.clientWidth / canvas.width
    element.scrollLeft = (outline.x + outline.width / 2) * shown - element.clientWidth / 2
  }

  return { element, show }
}
