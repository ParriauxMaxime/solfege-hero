import { specBeats } from '../hero/meter'
import type { NoteSpec } from '../hero/types'

export interface MeasureSlice {
  first: number
  end: number
}

const EPSILON = 1e-6
const BASE_SLOT_WIDTH = 26
const SLOT_WIDTH_PER_BEAT = 24
export const ACCIDENTAL_ROOM = 20
const DOT_ROOM = 9

/** Cuts the notes into bars of `barBeats` quarter notes; the last bar may be short. */
export function splitMeasures(notes: readonly NoteSpec[], barBeats: number): MeasureSlice[] {
  const measures: MeasureSlice[] = []
  let first = 0
  let filled = 0
  notes.forEach((spec, index) => {
    filled += specBeats(spec)
    if (filled < barBeats - EPSILON) return
    measures.push({ first, end: index + 1 })
    first = index + 1
    filled = 0
  })
  if (first < notes.length) measures.push({ first, end: notes.length })
  return measures
}

/** Natural width of a note's horizontal slot: more room for longer values, accidentals and dots. */
export function slotWidth(spec: NoteSpec, hasAccidental: boolean): number {
  return (
    BASE_SLOT_WIDTH +
    SLOT_WIDTH_PER_BEAT * specBeats(spec) +
    (hasAccidental ? ACCIDENTAL_ROOM : 0) +
    (spec.dots ?? 0) * DOT_ROOM
  )
}

/** Greedy line breaking: indices of the measures of each system, at least one measure per system. */
export function breakSystems(measureWidths: readonly number[], firstAvailable: number, nextAvailable: number): number[][] {
  const systems: number[][] = [[]]
  let used = 0
  measureWidths.forEach((width, index) => {
    const current = systems[systems.length - 1] as number[]
    const available = systems.length === 1 ? firstAvailable : nextAvailable
    if (current.length > 0 && used + width > available) {
      systems.push([index])
      used = width
      return
    }
    current.push(index)
    used += width
  })
  return systems
}

/** Left edge of each slot once `widths` are stretched by `factor`. */
export function slotStarts(widths: readonly number[], factor: number): number[] {
  let position = 0
  return widths.map((width) => {
    const start = position
    position += width * factor
    return start
  })
}

/** How much a system of natural width `natural` is stretched to fill `available`; a short last system is never over-stretched. */
export function stretchFactor(natural: number, available: number, isLast: boolean, maxLastStretch: number): number {
  const fill = available / natural
  return isLast ? Math.min(fill, maxLastStretch) : fill
}
