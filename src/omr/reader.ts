import type { Duration } from '../hero/types'
import { closeSquare, componentMask, labelComponents, toOdd } from './components'
import type { Component, Labelling } from './components'
import { rankTemplates, samplePatch } from './glyphMatch'
import { detectHeads } from './heads'
import type { Head } from './heads'
import { ACCIDENTAL_HEIGHT_UNITS, isBarLike, matchAccidental, readHeader } from './header'
import type { Header } from './header'
import { withoutNotes } from './noteless'
import { stepAt, topAt } from './staffCrop'
import type { StaffCrop } from './staffCrop'
import { countFlags, findStem } from './stems'
import type { Stem } from './stems'
import { REST_GRID, restTemplates } from './templates'
import type { AccidentalKind } from './templates'
import type { Box } from './types'

export interface NoteEvent {
  kind: 'note'
  x: number
  /** Staff step of the (top) head, rounded. */
  step: number
  duration: Duration
  dots: number
  accidental: AccidentalKind | null
  /** 0..1 */
  quality: number
  box: Box
}

export interface RestEvent {
  kind: 'rest'
  x: number
  duration: Duration
  dots: number
  quality: number
  box: Box
}

export interface BarEvent {
  kind: 'bar'
  x: number
}

export type StaffEvent = NoteEvent | RestEvent | BarEvent

export interface StaffReading {
  header: Header
  events: StaffEvent[]
}

const NOISE_UNITS_SQUARED = 0.04
/** Three ledger lines below and above the staff: heads further out are lyrics, titles or chord symbols. */
const HEAD_STEP_RANGE: readonly [number, number] = [-7, 15]
const DOT_SIZE_UNITS: readonly [number, number] = [0.15, 0.55]
const DOT_MIN_FILL = 0.5
const DOT_REACH_UNITS = 1.3
const DOT_SPACING_UNITS = 0.9
const DOT_VERTICAL_UNITS = 0.3
const ACCIDENTAL_WIDTH_UNITS: readonly [number, number] = [0.4, 1.45]
const ACCIDENTAL_REACH_UNITS = 2.3
const ACCIDENTAL_OVERLAP_UNITS = 0.3
const ACCIDENTAL_VERTICAL_UNITS = 2
const REST_STEP_RANGE: readonly [number, number] = [2.5, 6.8]
const REST_DOT_STEP = 5
const BLOCK_REST_HEIGHT_UNITS = 0.65
const BLOCK_REST_WIDTH_UNITS: readonly [number, number] = [0.55, 1.5]
const BLOCK_REST_FILL = 0.75
const WHOLE_REST_MIN_STEP = 5
const GLYPH_REST_HEIGHT_UNITS: readonly [number, number] = [1, 3.4]
const GLYPH_REST_MAX_WIDTH_UNITS = 1.5
const MIN_REST_SCORE = 0.4
const REST_QUALITY_BONUS = 0.2
const BAR_COVERAGE = 0.93
const BAR_MAX_WIDTH_UNITS = 1
const BAR_STEM_CLEARANCE_UNITS = 0.25
const SAME_STEM_UNITS = 0.3
const SAME_COLUMN_UNITS = 0.5
const WHOLE_NOTE_QUALITY = 0.8
const SYMBOL_CLOSING_UNITS = 0.3
/** Marks this close to a stem are what is left of a beam or flag, not a symbol of their own. */
const STEM_MARGIN_UNITS = 0.5

interface NoteGroup {
  head: Head
  stem: Stem | null
  flags: number
}

function dims(c: Component, unit: number) {
  return { w: (c.x1 - c.x0 + 1) / unit, h: (c.y1 - c.y0 + 1) / unit, cx: (c.x0 + c.x1) / 2, cy: (c.y0 + c.y1) / 2 }
}

function boxOf(c: Component): Box {
  return { x: c.x0, y: c.y0, width: c.x1 - c.x0 + 1, height: c.y1 - c.y0 + 1 }
}

/** Heads sharing a stem (or a column when stemless) are one chord, represented by their top head. */
function groupHeads(crop: StaffCrop, heads: Head[]): NoteGroup[] {
  const groups: NoteGroup[] = []
  for (const head of heads) {
    const stem = findStem(crop, head)
    if (!stem && !head.hollow) continue
    const flags = stem ? countFlags(crop, stem, head) : 0
    const existing = groups.find((group) => {
      if (stem && group.stem) return group.stem.direction === stem.direction && Math.abs(group.stem.x - stem.x) <= SAME_STEM_UNITS * crop.unit
      return !stem && !group.stem && Math.abs(group.head.x - head.x) <= SAME_COLUMN_UNITS * crop.unit
    })
    if (!existing) groups.push({ head, stem, flags })
    else if (head.y < existing.head.y) {
      existing.head = head
      existing.flags = Math.max(existing.flags, flags)
    }
  }
  return groups
}

function durationOf(group: NoteGroup): Duration {
  const { head, stem, flags } = group
  if (!stem) return head.hollow ? 'whole' : 'quarter'
  if (head.hollow) return 'half'
  return flags === 0 ? 'quarter' : flags === 1 ? 'eighth' : 'sixteenth'
}

function dotCount(unit: number, dots: Component[], rightEdge: number, centreY: number): number {
  const candidates = dots
    .filter((c) => c.x0 >= rightEdge && c.x0 - rightEdge <= DOT_REACH_UNITS * unit && Math.abs(dims(c, unit).cy - centreY) <= DOT_VERTICAL_UNITS * unit)
    .sort((a, b) => a.x0 - b.x0)
  let count = 0
  let last = rightEdge
  for (const dot of candidates) {
    if (dot.x0 - last > (count === 0 ? DOT_REACH_UNITS : DOT_SPACING_UNITS) * unit) break
    count++
    last = dot.x1
  }
  return Math.min(count, 2)
}

function noteDots(unit: number, dots: Component[], group: NoteGroup): number {
  const { head } = group
  const onLine = Math.round(head.step) % 2 === 0
  const dotY = onLine ? head.y - unit / 2 : head.y
  const stemEdge = group.stem?.direction === 'up' ? group.stem.x + 1 : 0
  return dotCount(unit, dots, Math.max(head.box.x + head.box.width - unit * 0.1, stemEdge), dotY)
}

function readBars(crop: StaffCrop, fromX: number, groups: NoteGroup[]): number[] {
  const { unit, clean } = crop
  const columns: number[] = []
  for (let x = Math.ceil(fromX); x < clean.width; x++) {
    const top = Math.round(topAt(crop, x))
    const bottom = Math.round(top + 4 * unit)
    let ink = 0
    for (let y = top; y <= bottom; y++) ink += clean.data[y * clean.width + x] as number
    if (ink / (bottom - top + 1) >= BAR_COVERAGE) columns.push(x)
  }
  const bars: number[] = []
  let start = 0
  for (let i = 0; i < columns.length; i++) {
    if (i < columns.length - 1 && (columns[i + 1] as number) - (columns[i] as number) <= 1) continue
    const from = columns[start] as number
    const to = columns[i] as number
    start = i + 1
    const centre = (from + to) / 2
    const onStem = groups.some((group) => group.stem && Math.abs(group.stem.x - centre) <= BAR_STEM_CLEARANCE_UNITS * unit)
    if ((to - from + 1) / unit > BAR_MAX_WIDTH_UNITS || onStem) continue
    const previous = bars[bars.length - 1]
    if (previous !== undefined && centre - previous < unit) continue
    bars.push(centre)
  }
  return bars
}

function restOf(crop: StaffCrop, labelling: Labelling, c: Component): { duration: Duration; score: number } | null {
  const { unit } = crop
  const { w, h, cx, cy } = dims(c, unit)
  const step = stepAt(crop, cx, cy)
  if (step < REST_STEP_RANGE[0] || step > REST_STEP_RANGE[1]) return null
  if (h <= BLOCK_REST_HEIGHT_UNITS && w >= BLOCK_REST_WIDTH_UNITS[0] && w <= BLOCK_REST_WIDTH_UNITS[1]) {
    const fill = c.area / ((c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1))
    return fill < BLOCK_REST_FILL ? null : { duration: step >= WHOLE_REST_MIN_STEP ? 'whole' : 'half', score: fill }
  }
  if (h < GLYPH_REST_HEIGHT_UNITS[0] || h > GLYPH_REST_HEIGHT_UNITS[1] || w > GLYPH_REST_MAX_WIDTH_UNITS) return null
  const mask = componentMask(labelling, crop.clean.width, c)
  const patch = samplePatch((x, y) => mask.data[y * mask.width + x] as number, { x0: 0, y0: 0, x1: mask.width - 1, y1: mask.height - 1 }, REST_GRID.columns, REST_GRID.rows)
  const best = rankTemplates(patch, restTemplates())[0]
  return best && best.score >= MIN_REST_SCORE ? { duration: best.name, score: best.score } : null
}

/** Accidentals standing just left of a head, and the rests, read from the ink left once notes are taken out. */
function readSymbols(crop: StaffCrop, header: Header, groups: NoteGroup[]): { accidentals: Map<NoteGroup, AccidentalKind>; rests: { c: Component; duration: Duration; score: number }[] } {
  const { unit } = crop
  const ink = closeSquare(
    withoutNotes(crop.clean, unit, groups.map((group) => ({ headBox: group.head.box, stem: group.stem }))),
    toOdd(unit * SYMBOL_CLOSING_UNITS),
  )
  const labelling = labelComponents(ink, 1, true)
  const accidentals = new Map<NoteGroup, AccidentalKind>()
  const rests: { c: Component; duration: Duration; score: number }[] = []
  const onStem = (c: Component) =>
    groups.some(
      (g) =>
        g.stem &&
        c.x1 >= g.stem.x - STEM_MARGIN_UNITS * unit &&
        c.x0 <= g.stem.x + STEM_MARGIN_UNITS * unit &&
        c.y1 >= Math.min(g.stem.tip, g.head.y) &&
        c.y0 <= Math.max(g.stem.tip, g.head.y),
    )
  const candidates = labelling.components.filter(
    (c) => c.area >= NOISE_UNITS_SQUARED * unit * unit && c.x0 > header.endX - unit * 0.2 && !isBarLike(c, unit),
  )
  for (const c of candidates) {
    const { w, h, cy } = dims(c, unit)
    const rest = onStem(c) ? null : restOf(crop, labelling, c)
    const sized = h >= ACCIDENTAL_HEIGHT_UNITS[0] && h <= ACCIDENTAL_HEIGHT_UNITS[1] && w >= ACCIDENTAL_WIDTH_UNITS[0] && w <= ACCIDENTAL_WIDTH_UNITS[1]
    const owner = sized
      ? groups
          .filter((g) => g.head.box.x - c.x1 >= -ACCIDENTAL_OVERLAP_UNITS * unit && g.head.box.x - c.x1 <= ACCIDENTAL_REACH_UNITS * unit && Math.abs(g.head.y - cy) <= ACCIDENTAL_VERTICAL_UNITS * unit)
          .sort((a, b) => a.head.x - b.head.x)[0]
      : undefined
    const accidental = owner ? matchAccidental(crop, labelling, c) : null
    if (owner && accidental && (!rest || accidental.score > rest.score)) accidentals.set(owner, accidental.kind)
    else if (rest) rests.push({ c, ...rest })
  }
  return { accidentals, rests }
}

export function readStaff(crop: StaffCrop): StaffReading {
  const { unit } = crop
  const headerLabelling = labelComponents(crop.closed, 1, true)
  const allHeads = detectHeads(crop, 0)
  const header = readHeader(crop, headerLabelling, allHeads)
  const groups = groupHeads(
    crop,
    allHeads.filter((head) => head.x > header.endX && head.step >= HEAD_STEP_RANGE[0] && head.step <= HEAD_STEP_RANGE[1]),
  )
  const { accidentals, rests } = readSymbols(crop, header, groups)
  const dotBlobs = labelComponents(crop.clean, 1, true).components.filter((c) => {
    const { w, h } = dims(c, unit)
    return w >= DOT_SIZE_UNITS[0] && w <= DOT_SIZE_UNITS[1] && h >= DOT_SIZE_UNITS[0] && h <= DOT_SIZE_UNITS[1] && c.area / ((c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1)) > DOT_MIN_FILL
  })

  const events: StaffEvent[] = []
  for (const group of groups) {
    const { head } = group
    const stemQuality = group.stem ? 1 : WHOLE_NOTE_QUALITY
    events.push({
      kind: 'note',
      x: head.x,
      step: Math.round(head.step),
      duration: durationOf(group),
      dots: noteDots(unit, dotBlobs, group),
      accidental: accidentals.get(group) ?? null,
      quality: 0.5 * head.quality + 0.5 * stemQuality,
      box: head.box,
    })
  }
  for (const { c, duration, score } of rests) {
    const { cy } = dims(c, unit)
    const restDotY = topAt(crop, c.x1) + (4 - REST_DOT_STEP / 2) * unit
    events.push({
      kind: 'rest',
      x: (c.x0 + c.x1) / 2,
      duration,
      dots: dotCount(unit, dotBlobs, c.x1, Math.abs(cy - restDotY) < unit ? restDotY : cy),
      quality: Math.min(1, score + REST_QUALITY_BONUS),
      box: boxOf(c),
    })
  }
  for (const x of readBars(crop, header.endX, groups)) events.push({ kind: 'bar', x })
  events.sort((a, b) => a.x - b.x)
  return { header, events }
}
