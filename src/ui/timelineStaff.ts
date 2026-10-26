import { motionReduced } from '../platform/appearance'
import { staffStep } from '../music/notes'
import type { Clef, Note } from '../music/notes'
import { el } from './dom'
import {
  STAFF_VIEW_HEIGHT,
  STAFF_VIEW_TOP,
  barLine,
  cancelledSignatureGlyph,
  clefGlyph,
  keySignatureGlyph,
  noteGroup,
  staffLines,
  stepY,
  svgElement,
} from './glyphs'
import {
  CLEF_ORIGIN,
  HEADER_FADE,
  HEADER_KEY_X,
  INLINE_CLEF_SCALE,
  INLINE_CLEF_WIDTH,
  NOTE_LEFT_EXTENT,
  headerWidth,
  isUnderHeader,
  layoutTimeline,
  noteState,
  scrollOffset,
  timelineScale,
  type ChangeBlock,
  type ClefAndKey,
} from './timelineLayout'

const ACCIDENTAL_OFFSET = -22
const HEADER_CLEF_X = 4
const SLOT_STEP = 4
const SLOT_RADIUS = { rx: 12, ry: 8 }
const CLEF_LABELS: Record<Clef, string> = { treble: 'de sol', bass: 'de fa', alto: 'd’ut' }

export interface TimelineItem extends ClefAndKey {
  note: Note
}

export interface TimelineOptions {
  /** Widest key signature the staff will show, so the notes are sized to leave room for it. */
  maxFifths?: number
}

export interface TimelinePoint {
  x: number
  y: number
}

export interface TimelineStaff {
  element: HTMLElement
  /** Makes `index` the note to answer, scrolls to it and pins the clef and key of `item`; a hidden note shows only a question slot. */
  setCurrent: (index: number, item: TimelineItem, options?: { hidden?: boolean }) => void
  /** A wrong key was tapped: the target turns red and keeps pulsing, the wrong note is not drawn. */
  markWrong: (index: number) => void
  /** The note was found: it stays in the timeline, muted when `firstTry`, else recovered (green with a red outline). Reveals a hidden note. */
  markAnswered: (index: number, firstTry: boolean) => void
  /** Centre of the head on screen, to anchor effects. */
  notePoint: (index: number) => TimelinePoint | null
  destroy: () => void
}

interface NoteNode {
  group: SVGGElement
  glyphDrawn: boolean
}

function viewBox(width: number): string {
  return `0 ${STAFF_VIEW_TOP} ${width} ${STAFF_VIEW_HEIGHT}`
}

function sizedSvg(className: string, unitsWide: number, scale: number): SVGSVGElement {
  const svg = svgElement('svg', {
    class: className,
    viewBox: viewBox(unitsWide),
    width: unitsWide * scale,
    height: STAFF_VIEW_HEIGHT * scale,
    'aria-hidden': 'true',
  })
  return svg
}

function clefAt(clef: Clef, x: number, scale = 1): SVGGElement {
  const middle = stepY(SLOT_STEP)
  const placed = svgElement('g', {
    transform: `translate(${x} ${middle}) scale(${scale}) translate(${-CLEF_ORIGIN} ${-middle})`,
  })
  placed.append(clefGlyph(clef))
  return placed
}

function changeGlyphs(block: ChangeBlock, item: ClefAndKey): SVGGElement {
  const group = svgElement('g', { class: 'timeline-change' })
  group.append(barLine(block.barX))
  let x = block.startX
  if (block.clefChanged) {
    group.append(clefAt(item.clef, x, INLINE_CLEF_SCALE))
    x += INLINE_CLEF_WIDTH
  }
  if (item.fifths !== 0) group.append(keySignatureGlyph(item.clef, item.fifths, x))
  else if (block.keyChanged) group.append(cancelledSignatureGlyph(item.clef, block.previousFifths, x))
  return group
}

function slotGlyph(x: number): SVGEllipseElement {
  return svgElement('ellipse', { class: 'timeline-slot', cx: x, cy: stepY(SLOT_STEP), ...SLOT_RADIUS })
}

export function createTimelineStaff({ maxFifths = 0 }: TimelineOptions = {}): TimelineStaff {
  const items: TimelineItem[] = []
  const mistakes: number[] = []
  const nodes = new Map<number, NoteNode>()
  const changeNodes: { group: SVGElement; barX: number }[] = []
  let current = -1
  let cursor = 0
  let hiddenCurrent = false
  let scale = 1
  let visibleUnits = 0
  let boxWidth = 0
  let shownHeader: ClefAndKey | null = null

  const lines = svgElement('g', { class: 'timeline-lines' })
  const barGroup = svgElement('g', { stroke: 'currentColor' })
  const noteGroupLayer = svgElement('g', { class: 'timeline-notes-layer' })
  const notesSvg = sizedSvg('timeline-notes', 0, 1)
  notesSvg.append(lines, barGroup, noteGroupLayer)
  const track = el('div', 'timeline-track', notesSvg)
  const header = el('div', 'timeline-header')
  const fade = el('div', 'timeline-fade')
  const stage = el('div', 'timeline-stage', track, header, fade)
  const element = el('div', 'timeline', stage)
  element.setAttribute('role', 'img')

  function noteX(index: number): number {
    return layoutTimeline(items.slice(0, index + 1)).noteX[index] ?? 0
  }

  function buildGlyph(index: number): void {
    const node = nodes.get(index)
    const item = items[index]
    if (!node || !item || node.glyphDrawn) return
    const step = staffStep(item.note, item.clef)
    node.group.append(noteGroup(item.note, step, item.fifths, noteX(index), {}, ACCIDENTAL_OFFSET))
    node.glyphDrawn = true
  }

  function createNode(index: number): void {
    nodes.get(index)?.group.remove()
    const group = svgElement('g', { class: 'staff-note timeline-note' })
    group.append(slotGlyph(noteX(index)))
    nodes.set(index, { group, glyphDrawn: false })
    noteGroupLayer.append(group)
  }

  function refreshStates(): void {
    for (const [index, node] of nodes) {
      const state = noteState(index, cursor, mistakes[index] ?? 0, hiddenCurrent)
      if (state !== 'hidden' && state !== 'hidden-missed') buildGlyph(index)
      node.group.dataset['state'] = state
    }
  }

  function drawHeader(item: ClefAndKey): void {
    if (shownHeader?.clef === item.clef && shownHeader.fifths === item.fifths && header.firstChild) return
    shownHeader = { clef: item.clef, fifths: item.fifths }
    const width = headerWidth(item.fifths)
    const svg = sizedSvg('timeline-header-svg', width, scale)
    const background = svgElement('rect', { class: 'timeline-header-bg', x: 0, y: STAFF_VIEW_TOP, width, height: STAFF_VIEW_HEIGHT })
    svg.append(background, staffLines(0, width), clefAt(item.clef, HEADER_CLEF_X))
    if (item.fifths !== 0) svg.append(keySignatureGlyph(item.clef, item.fifths, HEADER_KEY_X))
    header.replaceChildren(svg)
    fade.style.left = `${width * scale}px`
    fade.style.width = `${HEADER_FADE * scale}px`
  }

  function drawLines(extent: number): void {
    lines.replaceChildren(staffLines(0, extent))
  }

  function applyLayout(animate: boolean): void {
    if (boxWidth === 0 || current < 0) return
    const x = noteX(current)
    const extent = x + visibleUnits
    notesSvg.setAttribute('viewBox', viewBox(extent))
    notesSvg.setAttribute('width', String(extent * scale))
    notesSvg.setAttribute('height', String(STAFF_VIEW_HEIGHT * scale))
    drawLines(extent)
    const { noteX: xs } = layoutTimeline(items.slice(0, current + 1))
    const offset = scrollOffset(xs, current, visibleUnits)
    const edge = headerWidth(shownHeader?.fifths ?? 0)
    for (const [index, node] of nodes) {
      node.group.classList.toggle('timeline-covered', index < current && isUnderHeader((xs[index] ?? 0) - NOTE_LEFT_EXTENT, offset, edge))
    }
    for (const change of changeNodes) change.group.classList.toggle('timeline-covered', isUnderHeader(change.barX, offset, edge))
    const smooth = animate && !motionReduced()
    if (!smooth) track.style.transition = 'none'
    track.style.transform = `translate3d(${-offset * scale}px, 0, 0)`
    if (!smooth) {
      void track.offsetWidth
      track.style.transition = ''
    }
  }

  function applyScale(width: number, height: number): void {
    const fitted = timelineScale(width, height, maxFifths)
    scale = fitted.scale
    visibleUnits = fitted.visibleUnits
    boxWidth = width
    stage.style.height = `${STAFF_VIEW_HEIGHT * scale}px`
    const item = items[current]
    if (item) {
      shownHeader = null
      drawHeader(item)
    }
    applyLayout(false)
  }

  const resizeObserver = new ResizeObserver(([entry]) => {
    if (entry) applyScale(entry.contentRect.width, entry.contentRect.height)
  })
  resizeObserver.observe(element)

  function drawStructure(index: number): void {
    const item = items[index]
    if (!item) return
    const { bars, changes } = layoutTimeline(items.slice(0, index + 1))
    const block = changes.find((change) => change.index === index)
    if (block) {
      const group = changeGlyphs(block, item)
      changeNodes.push({ group, barX: block.barX })
      barGroup.append(group)
    } else {
      const bar = bars.find((candidate) => candidate.index === index)
      if (!bar) return
      const line = barLine(bar.x)
      line.classList.add('timeline-change')
      changeNodes.push({ group: line, barX: bar.x })
      barGroup.append(line)
    }
  }

  function describe(): void {
    const item = items[current]
    const total = current + 1
    element.setAttribute('aria-label', item ? `Portée en clé ${CLEF_LABELS[item.clef]}, ${total} note${total > 1 ? 's' : ''}` : 'Portée')
  }

  function restartPop(group: SVGGElement): void {
    group.classList.remove('timeline-pop')
    void group.getBoundingClientRect()
    group.classList.add('timeline-pop')
    group.addEventListener('animationend', () => group.classList.remove('timeline-pop'), { once: true })
  }

  return {
    element,
    setCurrent(index, item, { hidden = false } = {}) {
      items[index] = item
      current = index
      cursor = index
      hiddenCurrent = hidden
      createNode(index)
      drawStructure(index)
      refreshStates()
      drawHeader(item)
      describe()
      applyLayout(true)
    },
    markWrong(index) {
      mistakes[index] = (mistakes[index] ?? 0) + 1
      refreshStates()
    },
    markAnswered(index, firstTry) {
      mistakes[index] = firstTry ? 0 : Math.max(1, mistakes[index] ?? 0)
      if (index === cursor) {
        cursor = index + 1
        hiddenCurrent = false
      }
      refreshStates()
      const group = nodes.get(index)?.group
      if (group) restartPop(group)
    },
    notePoint(index) {
      const head = nodes.get(index)?.group.querySelector('.staff-note-head')
      if (!head) return null
      const box = head.getBoundingClientRect()
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    },
    destroy() {
      resizeObserver.disconnect()
    },
  }
}
