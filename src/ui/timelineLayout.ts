import type { Clef } from '../music/notes'
import { STAFF_VIEW_HEIGHT, keySignatureWidth } from './glyphs'

export interface ClefAndKey {
  clef: Clef
  fifths: number
}

/** Layout units are SVG user units of the staff, not pixels. */
export const NOTE_SPACING = 40
export const NOTES_PER_BAR = 4
export const BAR_OFFSET = 20
export const CHANGE_LEAD = 10
export const CHANGE_PAD = 22
export const INLINE_CLEF_SCALE = 0.8
export const INLINE_CLEF_WIDTH = 44
export const CLEF_ORIGIN = 30
export const HEADER_KEY_X = 56
export const HEADER_TRAILING = 6
export const FIRST_NOTE_GAP = 28
export const RIGHT_MARGIN = 20
export const CURRENT_NOTE_RATIO = 0.68
export const HEADER_FADE = 8
export const NOTE_LEFT_EXTENT = 24

export type NoteState = 'pending' | 'current' | 'current-missed' | 'correct' | 'recovered' | 'hidden' | 'hidden-missed'

export interface ChangeBlock {
  index: number
  barX: number
  startX: number
  clefChanged: boolean
  keyChanged: boolean
  previousFifths: number
  width: number
}

export interface BarLine {
  index: number
  x: number
}

export interface TimelineLayout {
  noteX: number[]
  bars: BarLine[]
  changes: ChangeBlock[]
}

export function headerWidth(fifths: number): number {
  return HEADER_KEY_X + keySignatureWidth(fifths) + HEADER_TRAILING
}

export function firstNoteX(fifths: number): number {
  return headerWidth(fifths) + FIRST_NOTE_GAP
}

/** What a change of clef and key costs: nothing when neither moves, else the clef, the signature (or the naturals cancelling it) and some air. */
export function changeWidth(previous: ClefAndKey, next: ClefAndKey): number {
  const clefChanged = previous.clef !== next.clef
  const keyChanged = previous.fifths !== next.fifths
  if (!clefChanged && !keyChanged) return 0
  const signatureFifths = next.fifths === 0 ? previous.fifths : next.fifths
  const signature = next.fifths === 0 && !keyChanged ? 0 : keySignatureWidth(signatureFifths)
  return CHANGE_PAD + (clefChanged ? INLINE_CLEF_WIDTH : 0) + signature
}

/** Where the first of the given items sits once the notes before it were dropped: its x and how many notes since the last bar line. */
export interface TimelineAnchor {
  x: number
  sinceBar: number
}

/** The anchor of `items[index]`: laying out `items.slice(index)` from it keeps every x and bar line where they were. */
export function anchorAt(items: readonly ClefAndKey[], index: number, anchor?: TimelineAnchor): TimelineAnchor {
  const { noteX, bars } = layoutTimeline(items, anchor)
  const lastBar = bars.filter((bar) => bar.index <= index).at(-1)
  return { x: noteX[index] ?? 0, sinceBar: lastBar ? index - lastBar.index : index + (anchor?.sinceBar ?? 0) }
}

/** Positions of the notes written so far; a bar line follows every four notes and precedes every change of clef or key. */
export function layoutTimeline(items: readonly ClefAndKey[], anchor?: TimelineAnchor): TimelineLayout {
  const noteX: number[] = []
  const bars: BarLine[] = []
  const changes: ChangeBlock[] = []
  let measureStart = -(anchor?.sinceBar ?? 0)
  items.forEach((item, index) => {
    const previous = items[index - 1]
    const previousX = noteX[index - 1]
    if (!previous || previousX === undefined) {
      noteX.push(anchor?.x ?? firstNoteX(item.fifths))
      return
    }
    const width = changeWidth(previous, item)
    const barX = previousX + BAR_OFFSET
    if (width > 0) {
      changes.push({
        index,
        barX,
        startX: barX + CHANGE_LEAD,
        clefChanged: previous.clef !== item.clef,
        keyChanged: previous.fifths !== item.fifths,
        previousFifths: previous.fifths,
        width,
      })
    }
    if (width > 0 || index - measureStart === NOTES_PER_BAR) {
      bars.push({ index, x: barX })
      measureStart = index
    }
    noteX.push(previousX + NOTE_SPACING + width)
  })
  return { noteX, bars, changes }
}

/** Horizontal shift of the notes: none while the next note still fits, then the current note stays at 68 % of the visible width. */
export function scrollOffset(noteX: readonly number[], index: number, visibleWidth: number): number {
  let offset = 0
  for (let step = 0; step <= index; step++) {
    const x = noteX[step]
    if (x === undefined) break
    if (x + NOTE_SPACING > visibleWidth - RIGHT_MARGIN) offset = Math.max(offset, x - CURRENT_NOTE_RATIO * visibleWidth)
  }
  return offset
}

/** The state of a note, given the note being answered, the wrong taps it received and whether it is kept secret until answered. */
export function noteState(index: number, currentIndex: number, mistakes: number, hidden = false): NoteState {
  if (index > currentIndex) return 'pending'
  if (index === currentIndex) {
    if (hidden) return mistakes > 0 ? 'hidden-missed' : 'hidden'
    return mistakes > 0 ? 'current-missed' : 'current'
  }
  return mistakes > 0 ? 'recovered' : 'correct'
}

/** Whether something whose left edge sits at `left` (layout units) is, at this scroll offset, at least partly under the pinned header. */
export function isUnderHeader(left: number, offset: number, headerEdge: number): boolean {
  return left - offset < headerEdge
}

export interface TimelineScale {
  scale: number
  visibleUnits: number
}

const MIN_SCALE = 0.62
const MAX_SCALE = 1.25
const MIN_VISIBLE_NOTES = 5
const TRAILING_UNITS = 8

/** Pixels per layout unit: as tall as the box allows, but small enough to show five notes after the widest header. */
export function timelineScale(boxWidth: number, boxHeight: number, maxFifths: number, visibleNotes = MIN_VISIBLE_NOTES): TimelineScale {
  const unitsForNotes = firstNoteX(maxFifths) + (visibleNotes - 1) * NOTE_SPACING + TRAILING_UNITS
  const byHeight = boxHeight / STAFF_VIEW_HEIGHT
  const byWidth = boxWidth / unitsForNotes
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, byHeight, byWidth))
  return { scale, visibleUnits: boxWidth / scale }
}
