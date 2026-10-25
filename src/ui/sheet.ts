import { barLength, specBeats } from '../hero/meter'
import { COMMON_TIME } from '../hero/types'
import type { HeroNote, Melody, NoteSpec, TimeSignature } from '../hero/types'
import { keyAlteration, spellInKey } from '../music/keySignature'
import type { Accidental } from '../music/keySignature'
import { spell, staffStep } from '../music/notes'
import type { Alter, Clef, Note } from '../music/notes'
import {
  accidentalGlyph,
  augmentationDots,
  barLine,
  beam,
  clefGlyph,
  dotsStartX,
  flag,
  inkGroup,
  keySignatureGlyph,
  keySignatureWidth,
  ledgerLines,
  noteHead,
  restGlyph,
  staffLines,
  stem,
  stemsUp,
  stemTipY,
  stemX,
  stepY,
  svgElement,
  timeSignatureGlyph,
  timeSignatureWidth,
} from './glyphs'
import type { HeadFill } from './glyphs'
import { beamRun, beamUnitOf } from './heroStaff'
import { ACCIDENTAL_ROOM, breakSystems, slotStarts, slotWidth, splitMeasures, stretchFactor } from './sheetLayout'
import type { MeasureSlice } from './sheetLayout'

export interface SheetOptions {
  /** Width of the page in SVG units; one staff interline is 16 units. */
  width: number
  /** Pages are stacked vertically in one SVG, each `pageHeight` tall; all systems on one page when absent. */
  systemsPerPage?: number
  /** Colour of the ink; the surrounding text colour when absent. */
  ink?: string
  /** Paper colour; transparent when absent. */
  background?: string
  /** Colour override of a note's ink, or null to keep the default. */
  highlight?: (noteIndex: number) => string | null
  onNoteTap?: (noteIndex: number) => void
}

export interface SheetSystem {
  /** Vertical extent of the system band in SVG units. */
  top: number
  bottom: number
  firstNote: number
  lastNote: number
}

export interface SheetNotePosition {
  index: number
  x: number
  y: number
  system: number
}

export interface Sheet {
  svg: SVGSVGElement
  systems: SheetSystem[]
  notePositions: SheetNotePosition[]
  pageHeight: number
}

type SheetScore = Pick<Melody, 'clef' | 'key' | 'notes'> & { timeSignature?: TimeSignature }

const MARGIN_X = 24
const CLEF_SHIFT = MARGIN_X - 8
const KEY_SIGNATURE_X = MARGIN_X + 82
const NOTES_LEAD_AFTER_SIGNATURE = 8
const MEASURE_LEAD = 10
const MEASURE_TRAIL = 8
const FIRST_MEASURE_EXTRA_LEAD = 6
const HEAD_HALF_WIDTH = 12
const ACCIDENTAL_X = -22
const MAX_LAST_SYSTEM_STRETCH = 1.25
const SYSTEM_ABOVE_STAFF = 96
const SYSTEM_PITCH = 190
const PAGE_MARGIN = 30
const STAFF_HEIGHT = 64
const BEAM_STUB = 10
const FLAG_PITCH = 8
const REST_DOT_X = 10
const REST_DOT_STEP = 5
/** Transparent tap target, generous so notes stay tappable when the page is drawn small. */
const TAP_HALF_WIDTH = 26
const TAP_HALF_HEIGHT = 44
const FINAL_BAR_THICKNESS = 5
const FINAL_BAR_GAP = 4

interface PlacedNote {
  index: number
  spec: NoteSpec
  note: Note | null
  accidental: Accidental | null
  x: number
}

function spelled(spec: NoteSpec, key: number): Note | null {
  return spec.pitch === null ? null : (spellInKey(spec.pitch, key) ?? spell(spec.pitch, key < 0))
}

/** Accidentals a measure needs: an alteration holds for the rest of the bar on the same line or space. */
function measureAccidentals(notes: readonly (Note | null)[], key: number): (Accidental | null)[] {
  const current = new Map<string, Alter>()
  return notes.map((note) => {
    if (!note) return null
    const position = `${note.letter}${note.octave}`
    const standing = current.get(position) ?? keyAlteration(note.letter, key)
    current.set(position, note.alter)
    if (note.alter === standing) return null
    if (note.alter === 1) return 'sharp'
    return note.alter === -1 ? 'flat' : 'natural'
  })
}

function heroNotes(placed: readonly PlacedNote[]): HeroNote[] {
  let beat = 0
  return placed.map(({ index, spec, note }) => {
    const hero: HeroNote = { id: index, beat, duration: spec.duration, dots: spec.dots ?? 0, pitch: spec.pitch, note }
    beat += specBeats(spec)
    return hero
  })
}

function appendBeams(layer: SVGGElement, xs: readonly number[], runStart: number, run: readonly HeroNote[], tipY: number, up: boolean): void {
  const stemAt = (offset: number) => xs[runStart + offset] as number
  layer.append(beam(stemAt(0), stemAt(run.length - 1), tipY, up))
  run.forEach((hero, offset) => {
    if (hero.duration !== 'sixteenth') return
    if (run[offset + 1]?.duration === 'sixteenth') layer.append(beam(stemAt(offset), stemAt(offset + 1), tipY, up, 1))
    else if (run[offset - 1]?.duration !== 'sixteenth') {
      const direction = run[offset + 1] ? 1 : -1
      layer.append(beam(stemAt(offset), stemAt(offset) + direction * BEAM_STUB, tipY, up, 1))
    }
  })
}

interface DrawnMeasure {
  notes: SVGGElement[]
  beams: SVGGElement
  positions: Omit<SheetNotePosition, 'system'>[]
}

function drawMeasure(placed: readonly PlacedNote[], clef: Clef, time: TimeSignature): DrawnMeasure {
  const heroes = heroNotes(placed)
  const beamUnit = beamUnitOf(time)
  const beams = inkGroup()
  const xs = placed.map((entry) => entry.x)
  const positions: DrawnMeasure['positions'] = []
  const groups = placed.map(({ index, spec, note, accidental, x }, offset) => {
    const group = inkGroup({ class: 'sheet-note', 'data-note-index': index })
    const centreStep = note ? staffStep(note, clef) : 4
    const centreY = stepY(centreStep)
    group.append(
      svgElement('rect', {
        x: x - TAP_HALF_WIDTH,
        y: centreY - TAP_HALF_HEIGHT,
        width: TAP_HALF_WIDTH * 2,
        height: TAP_HALF_HEIGHT * 2,
        fill: 'transparent',
        stroke: 'none',
      }),
    )
    positions.push({ index, x, y: centreY })
    if (!note) {
      group.append(restGlyph(spec.duration, x), ...augmentationDots(x + REST_DOT_X, REST_DOT_STEP, spec.dots ?? 0))
      return group
    }

    const step = centreStep
    const fill: HeadFill = spec.duration === 'whole' || spec.duration === 'half' ? 'hollow' : 'filled'
    group.append(...ledgerLines(step, x))
    if (accidental) group.append(accidentalGlyph(accidental, x + ACCIDENTAL_X, step))
    group.append(noteHead(fill, x, step), ...augmentationDots(x + dotsStartX(fill), step, spec.dots ?? 0))
    if (spec.duration === 'whole') return group

    const run = beamRun(heroes, offset, beamUnit)
    const runStart = offset - run.findIndex((member) => member === heroes[offset])
    const steps = run.length > 1 ? run.map((member) => staffStep(member.note, clef)) : [step]
    const up = stemsUp(steps.reduce((sum, value) => sum + value, 0) / steps.length)
    const tips = steps.map((value) => stemTipY(value, up))
    const tipY = up ? Math.min(...tips) : Math.max(...tips)
    group.append(stem(fill, x, step, up, tipY))
    if (run.length > 1) {
      if (runStart === offset) appendBeams(beams, xs.map((value) => stemX(fill, value, up)), runStart, run, tipY, up)
      return group
    }
    const flagCount = spec.duration === 'sixteenth' ? 2 : spec.duration === 'eighth' ? 1 : 0
    for (let level = 0; level < flagCount; level++) {
      group.append(flag(stemX(fill, x, up), tipY + (up ? 1 : -1) * level * FLAG_PITCH, up))
    }
    return group
  })
  return { notes: groups, beams, positions }
}

function strokedBarLine(x: number): SVGGElement {
  const group = svgElement('g', { stroke: 'currentColor' })
  group.append(barLine(x))
  return group
}

function finalBarLine(x: number): SVGGElement {
  const group = svgElement('g', { stroke: 'currentColor' })
  group.append(barLine(x - FINAL_BAR_GAP - FINAL_BAR_THICKNESS / 2))
  const thick = barLine(x - FINAL_BAR_THICKNESS / 2)
  thick.setAttribute('stroke-width', String(FINAL_BAR_THICKNESS))
  group.append(thick)
  return group
}

export function renderSheet(score: SheetScore, options: SheetOptions): Sheet {
  const time = score.timeSignature ?? COMMON_TIME
  const spellings = score.notes.map((spec) => spelled(spec, score.key))
  const measures = splitMeasures(score.notes, barLength(time))
  const accidentalsByMeasure = measures.map((measure) => measureAccidentals(spellings.slice(measure.first, measure.end), score.key))
  const slotsByMeasure = measures.map((measure, measureIndex) =>
    score.notes.slice(measure.first, measure.end).map((spec, offset) => slotWidth(spec, accidentalsByMeasure[measureIndex]?.[offset] != null)),
  )
  const measureWidths = slotsByMeasure.map((slots, index) => {
    const lead = MEASURE_LEAD + (index === 0 ? FIRST_MEASURE_EXTRA_LEAD : 0)
    return lead + slots.reduce((sum, width) => sum + width, 0) + MEASURE_TRAIL
  })

  const signatureWidth = keySignatureWidth(score.key)
  const notesStartX = KEY_SIGNATURE_X + signatureWidth + NOTES_LEAD_AFTER_SIGNATURE
  const staffRight = options.width - MARGIN_X
  const systemsOfMeasures = breakSystems(
    measureWidths,
    staffRight - notesStartX - timeSignatureWidth(time),
    staffRight - notesStartX,
  )

  const systemsPerPage = options.systemsPerPage ?? Math.max(systemsOfMeasures.length, 1)
  const pageHeight = PAGE_MARGIN * 2 + systemsPerPage * SYSTEM_PITCH
  const pages = Math.ceil(systemsOfMeasures.length / systemsPerPage)
  const svg = svgElement('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${options.width} ${pages * pageHeight}`,
    width: options.width,
    height: pages * pageHeight,
    role: 'img',
    'aria-label': 'Partition',
  })
  if (options.ink) svg.setAttribute('color', options.ink)
  if (options.background) svg.append(svgElement('rect', { width: options.width, height: pages * pageHeight, fill: options.background }))

  const systems: SheetSystem[] = []
  const notePositions: SheetNotePosition[] = []

  systemsOfMeasures.forEach((measureIndexes, systemIndex) => {
    const page = Math.floor(systemIndex / systemsPerPage)
    const bandTop = page * pageHeight + PAGE_MARGIN + (systemIndex % systemsPerPage) * SYSTEM_PITCH
    const offsetY = bandTop + SYSTEM_ABOVE_STAFF + STAFF_HEIGHT - stepY(0)
    const isFirst = systemIndex === 0
    const isLast = systemIndex === systemsOfMeasures.length - 1
    const startX = notesStartX + (isFirst ? timeSignatureWidth(time) : 0)
    const widths = measureIndexes.map((index) => measureWidths[index] as number)
    const natural = widths.reduce((sum, width) => sum + width, 0)
    const factor = stretchFactor(natural, staffRight - startX, isLast, MAX_LAST_SYSTEM_STRETCH)
    const starts = slotStarts(widths, factor)
    const endX = startX + natural * factor

    const layer = svgElement('g', { transform: `translate(0 ${offsetY})` })
    const clef = svgElement('g', { transform: `translate(${CLEF_SHIFT} 0)` })
    clef.append(clefGlyph(score.clef))
    layer.append(
      staffLines(MARGIN_X, isLast ? endX : staffRight),
      strokedBarLine(MARGIN_X),
      clef,
      keySignatureGlyph(score.clef, score.key, KEY_SIGNATURE_X),
    )
    if (isFirst) layer.append(timeSignatureGlyph(time, KEY_SIGNATURE_X + signatureWidth))

    const noteLayer = svgElement('g', {})
    const beamLayer = svgElement('g', {})
    layer.append(beamLayer, noteLayer)
    measureIndexes.forEach((measureIndex, position) => {
      const measure = measures[measureIndex] as MeasureSlice
      const accidentals = accidentalsByMeasure[measureIndex] as (Accidental | null)[]
      const slots = slotsByMeasure[measureIndex] as number[]
      const lead = MEASURE_LEAD + (measureIndex === 0 ? FIRST_MEASURE_EXTRA_LEAD : 0)
      const slotOffsets = slotStarts(slots, factor)
      const left = startX + (starts[position] as number)
      const placed: PlacedNote[] = slots.map((_, offset) => {
        const index = measure.first + offset
        const accidentalRoom = accidentals[offset] ? ACCIDENTAL_ROOM : 0
        return {
          index,
          spec: score.notes[index] as NoteSpec,
          note: spellings[index] ?? null,
          accidental: accidentals[offset] ?? null,
          x: left + lead * factor + (slotOffsets[offset] as number) + accidentalRoom + HEAD_HALF_WIDTH,
        }
      })
      const drawn = drawMeasure(placed, score.clef, time)
      beamLayer.append(drawn.beams)
      drawn.notes.forEach((group, offset) => {
        const index = measure.first + offset
        const colour = options.highlight?.(index)
        if (colour) group.setAttribute('color', colour)
        if (options.onNoteTap) {
          group.style.cursor = 'pointer'
          group.addEventListener('click', () => options.onNoteTap?.(index))
        }
        noteLayer.append(group)
      })
      for (const { index, x, y } of drawn.positions) notePositions.push({ index, x, y: y + offsetY, system: systemIndex })
      const isFinalBar = isLast && position === measureIndexes.length - 1
      const barX = startX + (starts[position] as number) + (widths[position] as number) * factor
      layer.append(isFinalBar ? finalBarLine(barX) : strokedBarLine(barX))
    })

    svg.append(layer)
    const firstMeasure = measures[measureIndexes[0] as number]
    const lastMeasure = measures[measureIndexes[measureIndexes.length - 1] as number]
    systems.push({
      top: bandTop,
      bottom: bandTop + SYSTEM_PITCH,
      firstNote: firstMeasure?.first ?? 0,
      lastNote: (lastMeasure?.end ?? 0) - 1,
    })
  })

  return { svg, systems, notePositions, pageHeight }
}
