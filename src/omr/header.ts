import { signatureSteps } from '../music/keySignature'
import type { Clef } from '../music/notes'
import type { TimeSignature } from '../hero/types'
import { componentMask } from './components'
import type { Component, Labelling } from './components'
import { classifyDigit } from './digits'
import { rankTemplates, samplePatch } from './glyphMatch'
import type { Head } from './heads'
import { stepAt, topAt } from './staffCrop'
import type { StaffCrop } from './staffCrop'
import { ACCIDENTAL_GRID, accidentalTemplates } from './templates'
import type { AccidentalKind } from './templates'
import type { BinaryImage } from './types'

export interface Header {
  clef: Clef | null
  fifths: number
  /** Null when the staff carries no time signature (new system) or it could not be read. */
  time: TimeSignature | null
  /** Column of the crop where the music starts. */
  endX: number
}

const MAX_CLEF_START_UNITS = 8
const MIN_CLEF_HEIGHT_UNITS = 2.2
/** Narrower than any clef: a note with its stem. */
const MIN_CLEF_WIDTH_UNITS = 1.5
const TREBLE_HEIGHT_UNITS = 4.7
const DOT_MAX_UNITS = 0.7
const BAR_MAX_WIDTH_UNITS = 0.5
const BAR_MIN_HEIGHT_UNITS = 3.6
const FIRST_GAP_UNITS = 2.6
const NEXT_GAP_UNITS = 1.5
const SIGNATURE_PITCH_UNITS = 0.875
const SIGNATURE_GLYPH_UNITS = 1.0
const MERGED_WIDTH_UNITS = 1.35
const MERGED_MAX_HEIGHT_UNITS = 6.5
/** Marks centred further than this from the staff are text and chord symbols, not header symbols. */
const ZONE_UNITS = 2.5
const TALL_STROKE_UNITS = 1.6
/** The natural is the plainest glyph and correlates less well than the others, so it is let in at a lower score. */
const MIN_ACCIDENTAL_SCORE: Record<AccidentalKind, number> = { sharp: 0.4, flat: 0.4, natural: 0.3 }
const MIN_ACCIDENTAL_MARGIN = 0.1
const STEP_TOLERANCE = 1.7
const MIN_NOISE_UNITS_SQUARED = 0.04
/** A lone accidental this close to a head belongs to that note rather than to a key signature. */
const OWNED_DISTANCE_UNITS = 1.45

export const ACCIDENTAL_HEIGHT_UNITS: readonly [number, number] = [1.3, 3.8]

function sizeOf(c: Component, unit: number): { w: number; h: number; cx: number; cy: number } {
  return { w: (c.x1 - c.x0 + 1) / unit, h: (c.y1 - c.y0 + 1) / unit, cx: (c.x0 + c.x1) / 2, cy: (c.y0 + c.y1) / 2 }
}

export function inStaffZone(crop: StaffCrop, c: Component): boolean {
  const { cx, cy } = sizeOf(c, crop.unit)
  const top = topAt(crop, cx)
  return cy >= top - ZONE_UNITS * crop.unit && cy <= top + (4 + ZONE_UNITS) * crop.unit
}

export function isBarLike(c: Component, unit: number): boolean {
  const { w, h } = sizeOf(c, unit)
  return w <= BAR_MAX_WIDTH_UNITS && h >= BAR_MIN_HEIGHT_UNITS
}

/** Which accidental a component looks like, and how well. */
export function matchAccidental(crop: StaffCrop, labelling: Labelling, c: Component): { kind: AccidentalKind; score: number } | null {
  const mask = componentMask(labelling, crop.clean.width, c)
  const patch = samplePatch((x, y) => mask.data[y * mask.width + x] as number, { x0: 0, y0: 0, x1: mask.width - 1, y1: mask.height - 1 }, ACCIDENTAL_GRID.columns, ACCIDENTAL_GRID.rows)
  const [best, second] = rankTemplates(patch, accidentalTemplates())
  if (!best || best.score < MIN_ACCIDENTAL_SCORE[best.name] || best.score - (second?.score ?? 0) < MIN_ACCIDENTAL_MARGIN) return null
  return { kind: best.name, score: best.score }
}

function tallStrokeCount(mask: BinaryImage, minHeight: number): number {
  let strokes = 0
  let inside = false
  for (let x = 0; x < mask.width; x++) {
    let run = 0
    let longest = 0
    for (let y = 0; y < mask.height; y++) {
      run = mask.data[y * mask.width + x] ? run + 1 : 0
      longest = Math.max(longest, run)
    }
    const tall = longest >= minHeight
    if (tall && !inside) strokes++
    inside = tall
  }
  return strokes
}

/** Touching accidentals of a key signature: sharps show two tall strokes each, flats one. */
function mergedSignatureKind(crop: StaffCrop, labelling: Labelling, c: Component, glyphs: number): { kind: AccidentalKind; score: number } | null {
  const strokes = tallStrokeCount(componentMask(labelling, crop.clean.width, c, crop.clean), crop.unit * TALL_STROKE_UNITS)
  const perGlyph = strokes / glyphs
  if (perGlyph >= 1.6) return { kind: 'sharp', score: 1 }
  return perGlyph >= 0.7 ? { kind: 'flat', score: 1 } : null
}

function findClef(crop: StaffCrop, comps: Component[]): { clef: Clef; end: number; component: Component } | null {
  const { unit } = crop
  const body = comps.find((c) => {
    const { w, h } = sizeOf(c, unit)
    return c.x0 < MAX_CLEF_START_UNITS * unit && !isBarLike(c, unit) && h >= MIN_CLEF_HEIGHT_UNITS && w >= MIN_CLEF_WIDTH_UNITS
  })
  if (!body) return null
  const dots = comps.filter((c) => {
    const { w, h, cy } = sizeOf(c, unit)
    return (
      c !== body &&
      w <= DOT_MAX_UNITS &&
      h <= DOT_MAX_UNITS &&
      c.x0 >= body.x0 + (body.x1 - body.x0) * 0.4 &&
      c.x0 <= body.x1 + unit &&
      cy > topAt(crop, c.x0) &&
      cy < topAt(crop, c.x0) + 3 * unit
    )
  })
  const end = Math.max(body.x1, ...dots.map((c) => c.x1))
  const { h } = sizeOf(body, unit)
  if (dots.length >= 2) return { clef: 'bass', end, component: body }
  return { clef: h >= TREBLE_HEIGHT_UNITS ? 'treble' : 'alto', end, component: body }
}

function digitOf(crop: StaffCrop, labelling: Labelling, c: Component) {
  return classifyDigit(componentMask(labelling, crop.clean.width, c, crop.clean))
}

function findTimeSignature(crop: StaffCrop, labelling: Labelling, comps: Component[], from: number): { time: TimeSignature | null; end: number; start: number } | null {
  const { unit } = crop
  const candidates = comps.filter((c) => {
    const { w, h } = sizeOf(c, unit)
    return c.x0 >= from && c.x0 <= from + 12 * unit && w >= 0.35 && w <= 1.8 && h >= 0.9 && h <= 2.4
  })
  for (const upper of candidates) {
    const a = sizeOf(upper, unit)
    const top = topAt(crop, a.cx)
    if (a.cy < top + 0.3 * unit || a.cy > top + 2.1 * unit) continue
    for (const lower of candidates) {
      const b = sizeOf(lower, unit)
      if (Math.abs(a.cx - b.cx) > 0.6 * unit || b.cy < top + 1.9 * unit || b.cy > top + 3.8 * unit || b.cy <= a.cy) continue
      const beats = digitOf(crop, labelling, upper)
      const beatType = digitOf(crop, labelling, lower)
      if (beats === null || beatType === null) continue
      const valid = [2, 4, 8].includes(beatType)
      return { time: valid ? { beats, beatType } : null, start: Math.min(upper.x0, lower.x0), end: Math.max(upper.x1, lower.x1) }
    }
  }
  return stackedDigits(crop, labelling, comps, from)
}

/** Digits that touch each other make one tall component: both are as tall as the other, so cut it in the middle and read both halves. */
function stackedDigits(crop: StaffCrop, labelling: Labelling, comps: Component[], from: number): { time: TimeSignature | null; end: number; start: number } | null {
  const { unit } = crop
  for (const c of comps) {
    const { w, h, cx, cy } = sizeOf(c, unit)
    const middle = topAt(crop, cx) + 2 * unit
    if (c.x0 < from || c.x0 > from + 12 * unit || w < 0.6 || w > 2.4 || h < 2.6 || h > 4.6 || Math.abs(cy - middle) > 0.8 * unit) continue
    const mask = componentMask(labelling, crop.clean.width, c, crop.clean)
    const cut = Math.floor(mask.height / 2)
    const half = (from: number, to: number): BinaryImage => ({ width: mask.width, height: to - from, data: mask.data.slice(from * mask.width, to * mask.width) })
    const beats = classifyDigit(half(0, cut))
    const beatType = classifyDigit(half(cut, mask.height))
    if (beats === null || beatType === null) continue
    return { time: [2, 4, 8].includes(beatType) ? { beats, beatType } : null, start: c.x0, end: c.x1 }
  }
  return null
}

function findCommonTime(crop: StaffCrop, comps: Component[], from: number, heads: Head[]): Component | null {
  const { unit } = crop
  return (
    comps.find((c) => {
      const { w, h, cy, cx } = sizeOf(c, unit)
      if (heads.some((head) => head.x >= c.x0 && head.x <= c.x1 && head.y >= c.y0 && head.y <= c.y1)) return false
      const middle = topAt(crop, cx) + 2 * unit
      return c.x0 >= from && c.x0 - from <= FIRST_GAP_UNITS * unit && w >= 1 && w <= 2.2 && h >= 1.4 && h <= 2.8 && Math.abs(cy - middle) <= 0.7 * unit
    }) ?? null
  )
}

export function readHeader(crop: StaffCrop, labelling: Labelling, heads: Head[]): Header {
  const { unit } = crop
  const comps = labelling.components
    .filter((c) => c.area >= MIN_NOISE_UNITS_SQUARED * unit * unit && inStaffZone(crop, c))
    .sort((a, b) => a.x0 - b.x0)
  const found = findClef(crop, comps)
  if (!found) return { clef: null, fifths: 0, time: null, endX: 0 }
  const after = comps.filter((c) => c.x0 > found.end - 0.2 * unit && !isBarLike(c, unit))

  let cursor = found.end
  let fifths = 0
  let kind: AccidentalKind | null = null
  let count = 0
  let lastKeyEnd = found.end
  let lastCentre = { x: 0, y: 0 }
  for (const c of after) {
    const { w, h, cx, cy } = sizeOf(c, unit)
    const gap = (c.x0 - cursor) / unit
    if (gap > (count === 0 ? FIRST_GAP_UNITS : NEXT_GAP_UNITS)) break
    const merged = w > MERGED_WIDTH_UNITS
    if (h < ACCIDENTAL_HEIGHT_UNITS[0] || h > (merged ? MERGED_MAX_HEIGHT_UNITS : ACCIDENTAL_HEIGHT_UNITS[1])) break
    const glyphs = merged ? Math.round((w - SIGNATURE_GLYPH_UNITS) / SIGNATURE_PITCH_UNITS) + 1 : 1
    const match = merged ? mergedSignatureKind(crop, labelling, c, glyphs) : matchAccidental(crop, labelling, c)
    if (!match || match.kind === 'natural' || (kind && match.kind !== kind)) break
    if (!merged) {
      const sign = match.kind === 'sharp' ? 1 : -1
      const expected = signatureSteps(sign * Math.min(7, count + 1), found.clef)[count]
      if (!expected || Math.abs(stepAt(crop, cx, cy) - expected.step) > STEP_TOLERANCE) break
    }
    kind = match.kind
    count += glyphs
    cursor = c.x1
    lastKeyEnd = c.x1
    lastCentre = { x: cx, y: cy }
  }
  const timeSignature = findTimeSignature(crop, labelling, after, lastKeyEnd)
  if (kind && !timeSignature && count === 1) {
    const owned = heads.find((head) => head.x - lastCentre.x > 0 && head.x - lastCentre.x <= OWNED_DISTANCE_UNITS * unit && Math.abs(head.y - lastCentre.y) <= unit)
    if (owned) {
      count = 0
      lastKeyEnd = found.end
    }
  }
  if (kind) fifths = (kind === 'sharp' ? 1 : -1) * Math.min(7, count)

  let endX = Math.max(found.end, lastKeyEnd)
  let time: TimeSignature | null = null
  if (timeSignature) {
    time = timeSignature.time
    endX = Math.max(endX, timeSignature.end)
  } else {
    const common = findCommonTime(crop, after, endX, heads)
    if (common) {
      time = { beats: 4, beatType: 4 }
      endX = Math.max(endX, common.x1)
    }
  }
  return { clef: found.clef, fifths, time, endX }
}
