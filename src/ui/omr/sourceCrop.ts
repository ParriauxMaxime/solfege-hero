import type { Box } from '../../omr/types'
import { el } from '../dom'

/** A staff box spans four interlines; the crop adds this many above and below so ledger notes stay visible. */
const STAFF_INTERLINES = 4
const MARGIN_INTERLINES = 4
const FALLBACK_CROP_HEIGHT = 140
const OUTLINE_PADDING = 3
const OUTLINE_WIDTH = 2.5
const OUTLINE_HALO_WIDTH = 5

export interface SourceCrop {
  element: HTMLElement
  /** Draws `staff` of the source image with its margins and outlines `note`, centring the crop on it. */
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
    const interline = staff.height / STAFF_INTERLINES
    const margin = interline * MARGIN_INTERLINES
    const area = { x: Math.max(0, staff.x - interline), y: staff.y - margin, width: staff.width + 2 * interline, height: staff.height + 2 * margin }
    const shownHeight = element.clientHeight || FALLBACK_CROP_HEIGHT
    const shownScale = shownHeight / area.height
    const drawScale = Math.min(1, shownScale * (window.devicePixelRatio || 1))
    const backingPerCss = drawScale / shownScale
    canvas.width = Math.max(1, Math.ceil(area.width * drawScale))
    canvas.height = Math.max(1, Math.ceil(area.height * drawScale))
    canvas.style.width = `${area.width * shownScale}px`
    canvas.style.height = `${shownHeight}px`
    const context = canvas.getContext('2d')
    if (!context) return
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    const left = area.x
    const top = Math.max(0, area.y)
    const right = Math.min(source.width, area.x + area.width)
    const bottom = Math.min(source.height, area.y + area.height)
    context.drawImage(source, left, top, right - left, bottom - top, 0, (top - area.y) * drawScale, (right - left) * drawScale, (bottom - top) * drawScale)
    if (!note) {
      element.scrollLeft = 0
      return
    }
    const outline = {
      x: (note.x - area.x - OUTLINE_PADDING) * drawScale,
      y: (note.y - area.y - OUTLINE_PADDING) * drawScale,
      width: (note.width + 2 * OUTLINE_PADDING) * drawScale,
      height: (note.height + 2 * OUTLINE_PADDING) * drawScale,
    }
    context.strokeStyle = '#fff'
    context.lineWidth = OUTLINE_HALO_WIDTH * backingPerCss
    context.strokeRect(outline.x, outline.y, outline.width, outline.height)
    context.strokeStyle = cssColour('--accent')
    context.lineWidth = OUTLINE_WIDTH * backingPerCss
    context.strokeRect(outline.x, outline.y, outline.width, outline.height)
    element.scrollLeft = (note.x + note.width / 2 - area.x) * shownScale - element.clientWidth / 2
  }

  return { element, show }
}
