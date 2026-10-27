import { t, type MessageKey } from '../i18n'
import { motionReduced } from '../platform/appearance'
import { staffStep } from '../music/notes'
import type { Clef, Note } from '../music/notes'
import { el } from './dom'
import {
  STAFF_VIEW_HEIGHT,
  STAFF_VIEW_TOP,
  barLine,
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
  BAR_OFFSET,
  NOTE_LEFT_EXTENT,
  anchorAt,
  headerWidth,
  isUnderHeader,
  layoutTimeline,
  noteState,
  scrollOffset,
  timelineScale,
  type ClefAndKey,
  type TimelineAnchor,
} from './timelineLayout'

const ACCIDENTAL_OFFSET = -22
const HEADER_CLEF_X = 4
const SLOT_STEP = 4
const SLOT_RADIUS = { rx: 12, ry: 8 }
const CLEF_OF_KEYS = { treble: 'learn.clefOf.treble', bass: 'learn.clefOf.bass', alto: 'learn.clefOf.alto' } satisfies Record<Clef, MessageKey>

export interface TimelineItem extends ClefAndKey {
  note: Note
}

export interface TimelineOptions {
  /** Widest key signature the staff will show, so the notes are sized to leave room for it. */
  maxFifths?: number
  /** Endless play: only the last notes are kept, the older ones are dropped without moving the others. */
  maxKept?: number
  /** Notes the staff must show after the widest header; fewer notes make a bigger staff on a narrow card. */
  visibleNotes?: number
}

export interface TimelinePoint {
  x: number
  y: number
}

export interface TimelineStaff {
  element: HTMLElement
  /** Makes `index` the note to answer, scrolls to it and pins the clef and key of `item`; a hidden note shows only a question slot. */
  setCurrent: (index: number, item: TimelineItem, options?: { hidden?: boolean; keyChanged?: boolean }) => void
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

function clefAt(clef: Clef, x: number): SVGGElement {
  const middle = stepY(SLOT_STEP)
  const placed = svgElement('g', {
    transform: `translate(${x} ${middle}) translate(${-CLEF_ORIGIN} ${-middle})`,
  })
  placed.append(clefGlyph(clef))
  return placed
}

function markKey(glyph: SVGGElement): SVGGElement {
  glyph.classList.add('staff-key')
  return glyph
}

function slotGlyph(x: number): SVGEllipseElement {
  return svgElement('ellipse', { class: 'timeline-slot', cx: x, cy: stepY(SLOT_STEP), ...SLOT_RADIUS })
}

export function createTimelineStaff({ maxFifths = 0, maxKept = Infinity, visibleNotes }: TimelineOptions = {}): TimelineStaff {
  const items = new Map<number, TimelineItem>()
  const mistakes = new Map<number, number>()
  const nodes = new Map<number, NoteNode>()
  const changeNodes: { index: number; group: SVGElement; barX: number }[] = []
  let base = 0
  let anchor: TimelineAnchor | undefined
  let originX = 0
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

  function kept(upTo: number): TimelineItem[] {
    const window: TimelineItem[] = []
    for (let index = base; index <= upTo; index++) {
      const item = items.get(index)
      if (item) window.push(item)
    }
    return window
  }

  function layoutUpTo(index: number) {
    const { noteX: xs, bars } = layoutTimeline(kept(index), anchor)
    return { xs, bars: bars.map((bar) => ({ ...bar, index: bar.index + base })) }
  }

  function noteX(index: number): number {
    return layoutUpTo(index).xs[index - base] ?? 0
  }

  function dropOldest(): void {
    const newBase = current - maxKept + 1
    if (newBase <= base) return
    const next = anchorAt(kept(current), newBase - base, anchor)
    for (let index = base; index < newBase; index++) {
      nodes.get(index)?.group.remove()
      nodes.delete(index)
      items.delete(index)
      mistakes.delete(index)
    }
    while (changeNodes[0] && changeNodes[0].index < newBase) changeNodes.shift()?.group.remove()
    base = newBase
    anchor = next
    originX = Math.max(0, next.x - NOTE_LEFT_EXTENT - BAR_OFFSET)
  }

  function buildGlyph(index: number): void {
    const node = nodes.get(index)
    const item = items.get(index)
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
      const state = noteState(index, cursor, mistakes.get(index) ?? 0, hiddenCurrent)
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
    if (item.fifths !== 0) svg.append(markKey(keySignatureGlyph(item.clef, item.fifths, HEADER_KEY_X)))
    header.replaceChildren(svg)
    fade.style.left = `${width * scale}px`
    fade.style.width = `${HEADER_FADE * scale}px`
  }

  function drawLines(extent: number): void {
    lines.replaceChildren(staffLines(originX, extent))
  }

  function applyLayout(animate: boolean): void {
    if (boxWidth === 0 || current < 0) return
    const x = noteX(current)
    const extent = x + visibleUnits
    notesSvg.setAttribute('viewBox', `${originX} ${STAFF_VIEW_TOP} ${extent - originX} ${STAFF_VIEW_HEIGHT}`)
    notesSvg.setAttribute('width', String((extent - originX) * scale))
    notesSvg.style.marginLeft = `${originX * scale}px`
    notesSvg.setAttribute('height', String(STAFF_VIEW_HEIGHT * scale))
    drawLines(extent)
    const { xs } = layoutUpTo(current)
    const offset = scrollOffset(xs, current - base, visibleUnits)
    const edge = headerWidth(shownHeader?.fifths ?? 0)
    for (const [index, node] of nodes) {
      node.group.classList.toggle('timeline-covered', index < current && isUnderHeader((xs[index - base] ?? 0) - NOTE_LEFT_EXTENT, offset, edge))
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
    const fitted = timelineScale(width, height, maxFifths, visibleNotes)
    scale = fitted.scale
    visibleUnits = fitted.visibleUnits
    boxWidth = width
    stage.style.height = `${STAFF_VIEW_HEIGHT * scale}px`
    const item = items.get(current)
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
    const bar = layoutUpTo(index).bars.find((candidate) => candidate.index === index)
    if (!bar) return
    const line = barLine(bar.x)
    line.classList.add('timeline-change')
    changeNodes.push({ index, group: line, barX: bar.x })
    barGroup.append(line)
  }

  function describe(): void {
    const item = items.get(current)
    const total = current + 1
    element.setAttribute('aria-label', item ? t('learn.aria.timeline', { clef: t(CLEF_OF_KEYS[item.clef]), count: total }) : t('learn.aria.timelineEmpty'))
  }

  function restartPop(group: SVGGElement): void {
    group.classList.remove('timeline-pop')
    void group.getBoundingClientRect()
    group.classList.add('timeline-pop')
    group.addEventListener('animationend', () => group.classList.remove('timeline-pop'), { once: true })
  }

  return {
    element,
    setCurrent(index, item, { hidden = false, keyChanged = false } = {}) {
      items.set(index, item)
      current = index
      cursor = index
      hiddenCurrent = hidden
      dropOldest()
      createNode(index)
      drawStructure(index)
      refreshStates()
      drawHeader(item)
      header.classList.toggle('key-changed', keyChanged)
      describe()
      applyLayout(true)
    },
    markWrong(index) {
      mistakes.set(index, (mistakes.get(index) ?? 0) + 1)
      refreshStates()
    },
    markAnswered(index, firstTry) {
      mistakes.set(index, firstTry ? 0 : Math.max(1, mistakes.get(index) ?? 0))
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
