import { barLength } from '../hero/meter'
import { COMMON_TIME } from '../hero/types'
import { t } from '../i18n'
import type { NoteSpec, TimeSignature } from '../hero/types'
import { scoreId } from '../music/musicxml'
import type { Clef } from '../music/notes'
import { assembleStaff } from './assemble'
import { binarize, denoise, resizeGray, rotateGray, rotatedToSource } from './image'
import { readStaff } from './reader'
import { estimateSkew } from './skew'
import { cropStaff } from './staffCrop'
import { detectStaves, groupSystems, measureStaffMetrics, staffBottomAt, staffTopAt } from './staves'
import type { Staff, StaffMetrics } from './staves'
import type { BinaryImage, Box, GrayImage, OmrMeasure, OmrResult, OmrStaffReport, OmrStage, RecognizeOptions } from './types'

export { rgbaToGray } from './image'

const DEFAULT_TEMPO = 80
const MIN_ROTATION_RADIANS = 0.0006
const BEAT_EPSILON = 1e-6
const DOUBTFUL_CONFIDENCE = 0.5
const INCONSISTENT_MEASURE_FACTOR = 0.6
const STAFF_MARGIN_UNITS = 1.5
/** Staves taller than this are shrunk to the size the symbol sizes were tuned on, smaller than MIN_WORKING_UNIT enlarged to it. */
const MAX_UNIT = 34
const MIN_WORKING_UNIT = 15
const TARGET_UNIT = 22
const MIN_READABLE_UNIT = 11

interface Page {
  binary: BinaryImage
  metrics: StaffMetrics | null
  /** Rotation applied to the (possibly shrunk) image, in radians. */
  angle: number
  /** Pixels of the working image per pixel of the source. */
  scale: number
  source: { width: number; height: number }
}

function preparePage(image: GrayImage): Page {
  const source = { width: image.width, height: image.height }
  let gray = denoise(image)
  let scale = 1
  let binary = binarize(gray)
  let metrics = measureStaffMetrics(binary)
  if (metrics && (metrics.unit > MAX_UNIT || metrics.unit < MIN_WORKING_UNIT)) {
    scale = TARGET_UNIT / metrics.unit
    gray = resizeGray(gray, scale)
    binary = binarize(gray)
    metrics = measureStaffMetrics(binary)
  }
  const angle = (estimateSkew(binary) * Math.PI) / 180
  if (Math.abs(angle) < MIN_ROTATION_RADIANS) return { binary, metrics, angle: 0, scale, source }
  const rotated = binarize(rotateGray(gray, angle))
  return { binary: rotated, metrics: measureStaffMetrics(rotated) ?? metrics, angle, scale, source }
}

function boxInSource(page: Page, x0: number, y0: number, x1: number, y1: number): Box {
  const working = { width: Math.round(page.source.width * page.scale), height: Math.round(page.source.height * page.scale) }
  const corners = [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ].map(([x, y]) => {
    const unrotated = page.angle === 0 ? { x: x as number, y: y as number } : rotatedToSource(page.angle, working.width, working.height, x as number, y as number)
    return { x: unrotated.x / page.scale, y: unrotated.y / page.scale }
  })
  const xs = corners.map((corner) => corner.x)
  const ys = corners.map((corner) => corner.y)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  return { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top }
}

/** Rows between the neighbouring staves of the page, so a crop never reaches into another staff. */
function cropLimits(staves: Staff[], staff: Staff): { yMin: number; yMax: number } {
  const sorted = [...staves].sort((a, b) => staffTopAt(a, a.left) - staffTopAt(b, b.left))
  const index = sorted.indexOf(staff)
  const previous = sorted[index - 1]
  const next = sorted[index + 1]
  const midX = (staff.left + staff.right) / 2
  return {
    yMin: previous ? (staffBottomAt(previous, midX) + staffTopAt(staff, midX)) / 2 : 0,
    yMax: next ? (staffBottomAt(staff, midX) + staffTopAt(next, midX)) / 2 : Infinity,
  }
}

function resultOf(
  notes: NoteSpec[],
  clef: Clef,
  key: number,
  timeSignature: TimeSignature,
  extra: Omit<OmrResult, 'score'>,
): OmrResult {
  const melody = { clef, key, notes, timeSignature }
  return { score: { ...melody, id: scoreId(melody), name: t('omr.defaultName'), tempo: DEFAULT_TEMPO }, ...extra }
}

export function recognize(image: GrayImage, options: RecognizeOptions = {}): OmrResult {
  const staffIndexInSystem = options.staffIndexInSystem ?? 0
  const timings: Record<OmrStage, number> = { preprocess: 0, staves: 0, symbols: 0, music: 0 }
  const warnings: string[] = []
  let clock = performance.now()
  const stage = (name: OmrStage, fraction: number) => options.onProgress?.(name, fraction)
  const lap = (name: OmrStage) => {
    const now = performance.now()
    timings[name] += now - clock
    clock = now
  }
  const empty = (message: string) =>
    resultOf([], 'treble', 0, COMMON_TIME, { warnings: [message], confidence: [], measures: [], staves: [], systems: 0, staffIndexInSystem, timings })

  stage('preprocess', 0)
  const page = preparePage(image)
  lap('preprocess')
  stage('preprocess', 1)
  if (!page.metrics) return empty(t('omr.warnings.noStaffBlurry'))
  if (page.metrics.unit / page.scale < MIN_READABLE_UNIT) {
    warnings.push(t('omr.warnings.lowResolution'))
  }

  stage('staves', 0)
  const staves = detectStaves(page.binary, page.metrics)
  const systems = groupSystems(page.binary, staves)
  const chosen: { staff: Staff; system: number }[] = []
  systems.forEach((system, index) => {
    const staff = system[staffIndexInSystem]
    if (staff) chosen.push({ staff, system: index })
    else warnings.push(t('omr.warnings.systemSkipped', { system: index + 1, count: system.length }))
  })
  const crops = chosen.map(({ staff, system }) => {
    const limits = cropLimits(staves, staff)
    return { staff, system, crop: cropStaff(page.binary, staff, limits.yMin, limits.yMax) }
  })
  lap('staves')
  stage('staves', 1)
  if (systems.length === 0) return empty(t('omr.warnings.noStaffFrame'))

  const readings = crops.map(({ crop }, order) => {
    stage('symbols', order / crops.length)
    return readStaff(crop)
  })
  lap('symbols')
  stage('symbols', 1)

  stage('music', 0)
  const firstWithClef = readings.find((reading) => reading.header.clef)
  const clef: Clef = firstWithClef?.header.clef ?? 'treble'
  const key = firstWithClef?.header.fifths ?? 0
  const time = readings.map((reading) => reading.header.time).find((found) => found !== null) ?? null
  const timeSignature = time ?? COMMON_TIME
  if (!firstWithClef) warnings.push(t('omr.warnings.clefUnknown'))
  if (readings.some((reading) => reading.header.clef && reading.header.clef !== clef)) {
    warnings.push(t('omr.warnings.clefChanges'))
  }
  if (!time) warnings.push(t('omr.warnings.timeUnknown'))
  const bar = barLength(timeSignature)

  const notes: NoteSpec[] = []
  const confidence: number[] = []
  const measures: OmrMeasure[] = []
  const reports: OmrStaffReport[] = []
  readings.forEach((reading, order) => {
    const { crop, staff, system } = crops[order] as (typeof crops)[number]
    const staffClef = reading.header.clef ?? clef
    const read = assembleStaff(reading.events, staffClef, reading.header.clef ? reading.header.fifths : key)
    const first = notes.length
    const measureOfNote: boolean[] = []
    read.measureBeats.forEach((beats, measure) => {
      const members = read.notes.map((note, index) => ({ note, index })).filter(({ note }) => note.measure === measure)
      const start = members[0]
      const end = members[members.length - 1]
      if (!start || !end) return
      const uncertain = Math.abs(beats - bar) > BEAT_EPSILON
      measures.push({ startNote: first + start.index, endNote: first + end.index + 1, uncertain })
      for (const { index } of members) measureOfNote[index] = uncertain
    })
    const report: OmrStaffReport = {
      system,
      box: boxInSource(page, staff.left, staffTopAt(staff, staff.left) - STAFF_MARGIN_UNITS * staff.unit, staff.right, staffBottomAt(staff, staff.right) + STAFF_MARGIN_UNITS * staff.unit),
      notes: [],
    }
    read.notes.forEach((note, index) => {
      notes.push(note.spec)
      confidence.push(Math.max(0, Math.min(1, note.quality * (measureOfNote[index] ? INCONSISTENT_MEASURE_FACTOR : 1))))
      const { x, y, width, height } = note.box
      report.notes.push({ index: first + index, box: boxInSource(page, crop.originX + x, crop.originY + y, crop.originX + x + width, crop.originY + y + height) })
    })
    reports.push(report)
  })
  lap('music')
  stage('music', 1)

  const uncertainMeasures = measures.filter((measure) => measure.uncertain).length
  const doubtful = confidence.filter((value) => value < DOUBTFUL_CONFIDENCE).length
  if (notes.length === 0) warnings.push(t('omr.warnings.noNotes'))
  if (uncertainMeasures > 0) {
    warnings.push(t('omr.warnings.measureMismatch', { count: uncertainMeasures, beats: timeSignature.beats, beatType: timeSignature.beatType }))
  }
  if (doubtful > 0) warnings.push(t('omr.warnings.doubtfulNotes', { count: doubtful }))

  return resultOf(notes, clef, key, timeSignature, { warnings, confidence, measures, staves: reports, systems: systems.length, staffIndexInSystem, timings })
}
