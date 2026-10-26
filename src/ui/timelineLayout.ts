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
export const HEADER_KEY_X = 64
export const HEADER_TRAILING = 6
export const FIRST_NOTE_GAP = 28
export const RIGHT_MARGIN = 20
export const CURRENT_NOTE_RATIO = 0.6
export const HEADER_FADE = 14

export type NoteState = 'pending' | 'current' | 'current-missed' | 'correct' | 'recovered' | 'hidden'

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

/** Positions of the notes written so far; a bar line follows every four notes and precedes every change of clef or key. */
export function layoutTimeline(items: readonly ClefAndKey[]): TimelineLayout {
  const noteX: number[] = []
  const bars: BarLine[] = []
  const changes: ChangeBlock[] = []
  let measureStart = 0
  items.forEach((item, index) => {
    const previous = items[index - 1]
    const previousX = noteX[index - 1]
    if (!previous || previousX === undefined) {
      noteX.push(firstNoteX(item.fifths))
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

/** Horizontal shift of the notes: none while the next note still fits, then the current note stays at 60 % of the visible width. */
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
    if (hidden) return 'hidden'
    return mistakes > 0 ? 'current-missed' : 'current'
  }
  return mistakes > 0 ? 'recovered' : 'correct'
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
export function timelineScale(boxWidth: number, boxHeight: number, maxFifths: number): TimelineScale {
  const unitsForNotes = firstNoteX(maxFifths) + (MIN_VISIBLE_NOTES - 1) * NOTE_SPACING + TRAILING_UNITS
  const byHeight = boxHeight / STAFF_VIEW_HEIGHT
  const byWidth = boxWidth / unitsForNotes
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, byHeight, byWidth))
  return { scale, visibleUnits: boxWidth / scale }
}
