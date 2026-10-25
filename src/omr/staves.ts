import type { BinaryImage } from './types'

export interface StaffMetrics {
  /** Staff line thickness in pixels. */
  thickness: number
  /** Distance between two staff lines, centre to centre. */
  unit: number
}

export interface Staff {
  unit: number
  thickness: number
  /** First and last column holding staff line, inclusive. */
  left: number
  right: number
  /** Row of the top line's centre for every column of the page, following skew residue and curvature. */
  topY: Float32Array
}

const MAX_RUN = 80
const MAX_PERIOD = 400
const MIN_STAFF_UNITS = 10
const LINE_RUN_UNITS = 2
const LINE_SCORE_FRACTION = 0.12
const MIN_LINE_SCORE_UNITS = 8
const MAX_LINE_ROWS_PER_THICKNESS = 3
const SPACING_TOLERANCE = 0.2
const MIN_LINE_WEIGHT_RATIO = 0.4
const MIN_LINE_COVERAGE = 0.6
const UNIT_RANGE: readonly [number, number] = [0.5, 2]
const SLICE_UNITS = 5
/** Consecutive columns on the lines that mark where a staff really starts or ends. */
const EDGE_RUN = 6
const SLICE_SEARCH_UNITS = 0.4
const SLICE_MIN_COVERAGE = 0.5
const LINKED_COVERAGE = 0.9
const MAX_LINK_GAP_UNITS = 14

function histogramMode(histogram: Int32Array, from: number): number {
  let best = from
  for (let i = from; i < histogram.length; i++) if ((histogram[i] as number) > (histogram[best] as number)) best = i
  return best
}

/** Dominant staff line thickness and line spacing from the vertical run lengths of the page. */
export function measureStaffMetrics(image: BinaryImage): StaffMetrics | null {
  const { width, height, data } = image
  const lengths = new Int32Array(MAX_RUN + 1)
  for (let x = 0; x < width; x += 2) {
    let run = 0
    for (let y = 0; y <= height; y++) {
      if (y < height && data[y * width + x]) run++
      else if (run > 0) {
        lengths[Math.min(run, MAX_RUN)] = (lengths[Math.min(run, MAX_RUN)] as number) + 1
        run = 0
      }
    }
  }
  const thickness = histogramMode(lengths, 1)
  if ((lengths[thickness] as number) < 20) return null
  const periods = new Int32Array(MAX_PERIOD + 1)
  const maxLine = thickness * 2 + 1
  for (let x = 0; x < width; x += 2) {
    let run = 0
    let previousStart = -1
    for (let y = 0; y <= height; y++) {
      if (y < height && data[y * width + x]) {
        run++
        continue
      }
      if (run > 0) {
        const start = y - run
        if (run <= maxLine) {
          if (previousStart >= 0 && start - previousStart <= MAX_PERIOD) {
            periods[start - previousStart] = (periods[start - previousStart] as number) + 1
          }
          previousStart = start
        } else previousStart = -1
        run = 0
      }
    }
  }
  const unit = histogramMode(periods, thickness + 2)
  if ((periods[unit] as number) < 20) return null
  return { thickness, unit }
}

interface LineGroup {
  centre: number
  rows: number
  /** Summed score of its rows: how much ink in long horizontal runs. */
  weight: number
}

function longRunScores(image: BinaryImage, minRun: number): Float64Array {
  const { width, height, data } = image
  const scores = new Float64Array(height)
  for (let y = 0; y < height; y++) {
    let run = 0
    let score = 0
    for (let x = 0; x <= width; x++) {
      if (x < width && data[y * width + x]) run++
      else {
        if (run >= minRun) score += run
        run = 0
      }
    }
    scores[y] = score
  }
  return scores
}

function lineGroups(scores: Float64Array, threshold: number, maxRows: number): LineGroup[] {
  const groups: LineGroup[] = []
  let y = 0
  while (y < scores.length) {
    if ((scores[y] as number) < threshold) {
      y++
      continue
    }
    const start = y
    let weight = 0
    let moment = 0
    while (y < scores.length && (scores[y] as number) >= threshold) {
      weight += scores[y] as number
      moment += (scores[y] as number) * y
      y++
    }
    if (y - start <= maxRows) groups.push({ centre: moment / weight, rows: y - start, weight })
  }
  return groups
}

/** Five evenly spaced groups starting at `first`, skipping stray groups (beams, text rules) lying between the lines. */
function chainFrom(groups: LineGroup[], used: Set<number>, first: number, unit: number): number[] | null {
  const start = (groups[first] as LineGroup).centre
  for (let second = first + 1; second < groups.length; second++) {
    if (used.has(second)) continue
    const spacing = (groups[second] as LineGroup).centre - start
    if (spacing > unit * UNIT_RANGE[1]) break
    if (spacing < unit * UNIT_RANGE[0]) continue
    const chain = [first, second]
    for (let k = 2; k <= 4; k++) {
      const last = (groups[chain[chain.length - 1] as number] as LineGroup).centre
      const expected = last + (last - start) / (k - 1)
      let nearest = -1
      for (let m = second + 1; m < groups.length; m++) {
        const distance = Math.abs((groups[m] as LineGroup).centre - expected)
        if (!used.has(m) && distance <= spacing * SPACING_TOLERANCE && (nearest < 0 || distance < Math.abs((groups[nearest] as LineGroup).centre - expected))) nearest = m
      }
      if (nearest < 0) break
      chain.push(nearest)
    }
    if (chain.length < 5) continue
    const weights = chain.map((index) => (groups[index] as LineGroup).weight)
    if (Math.min(...weights) < Math.max(...weights) * MIN_LINE_WEIGHT_RATIO) continue
    return chain
  }
  return null
}

function chainStaves(groups: LineGroup[], unit: number): number[][] {
  const staves: number[][] = []
  const used = new Set<number>()
  for (let first = 0; first < groups.length; first++) {
    if (used.has(first)) continue
    const chain = chainFrom(groups, used, first, unit)
    if (!chain) continue
    for (const index of chain) used.add(index)
    staves.push(chain.map((index) => (groups[index] as LineGroup).centre))
  }
  return staves
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] as number
}

interface Tracked {
  left: number
  right: number
  /** Vertical shift of the staff against its nominal rows, for every column of the page. */
  offsets: Float32Array
}

/** Shift of the five lines inside one slice of columns, looked for around `expected`; null when the slice holds no staff. */
function sliceOffset(image: BinaryImage, lineRows: number[], from: number, to: number, expected: number, reach: number): number | null {
  const { width, height, data } = image
  const shifts: number[] = []
  for (const centre of lineRows) {
    let weight = 0
    let moment = 0
    let peak = 0
    for (let d = -reach; d <= reach; d++) {
      const y = Math.round(centre + expected) + d
      if (y < 0 || y >= height) continue
      let count = 0
      for (let x = from; x <= to; x++) count += data[y * width + x] as number
      weight += count
      moment += count * d
      peak = Math.max(peak, count)
    }
    if (peak >= (to - from + 1) * SLICE_MIN_COVERAGE && weight > 0) shifts.push(Math.round(centre + expected) - centre + moment / weight)
  }
  return shifts.length >= 3 ? median(shifts) : null
}

/** Follows the five lines slice by slice from the page middle outwards, so tilt and curvature left after deskew are followed and the staff ends where its lines end. */
function trackStaff(image: BinaryImage, lineRows: number[], unit: number): Tracked | null {
  const { width } = image
  const sliceWidth = Math.round(unit * SLICE_UNITS)
  const reach = Math.max(2, Math.round(unit * SLICE_SEARCH_UNITS))
  const slices = Math.ceil(width / sliceWidth)
  const bounds = (slice: number): [number, number] => [slice * sliceWidth, Math.min(width - 1, (slice + 1) * sliceWidth - 1)]
  const shiftOf: (number | null)[] = new Array(slices).fill(null)
  const valid: number[] = []
  for (let slice = 0; slice < slices; slice++) {
    const [from, to] = bounds(slice)
    shiftOf[slice] = sliceOffset(image, lineRows, from, to, 0, reach)
    if (shiftOf[slice] !== null) valid.push(slice)
  }
  const start = valid[Math.floor(valid.length / 2)]
  if (start === undefined) return null
  const grow = (direction: 1 | -1) => {
    let expected = shiftOf[start] as number
    let misses = 0
    let last = start
    for (let slice = start + direction; slice >= 0 && slice < slices; slice += direction) {
      const [from, to] = bounds(slice)
      const found = sliceOffset(image, lineRows, from, to, expected, reach)
      shiftOf[slice] = found
      if (found === null) {
        if (++misses > 1) break
        continue
      }
      misses = 0
      expected = found
      last = slice
    }
    return last
  }
  const lastSlice = grow(1)
  const firstSlice = grow(-1)
  const centres: number[] = []
  const shifts: number[] = []
  for (let slice = firstSlice; slice <= lastSlice; slice++) {
    const shift = shiftOf[slice]
    if (shift === null || shift === undefined) continue
    const [from, to] = bounds(slice)
    centres.push((from + to) / 2)
    shifts.push(shift)
  }
  const offsets = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    let k = 0
    while (k < centres.length - 1 && (centres[k + 1] as number) < x) k++
    const next = Math.min(k + 1, shifts.length - 1)
    const span = (centres[next] as number) - (centres[k] as number)
    const t = span <= 0 ? 0 : Math.min(1, Math.max(0, (x - (centres[k] as number)) / span))
    offsets[x] = (shifts[k] as number) * (1 - t) + (shifts[next] as number) * t
  }
  const onLines = (x: number): boolean => {
    let found = 0
    for (const centre of lineRows) {
      const row = Math.round(centre + (offsets[x] as number))
      for (let y = Math.max(0, row - 1); y <= Math.min(image.height - 1, row + 1); y++) {
        if (image.data[y * width + x]) {
          found++
          break
        }
      }
    }
    return found >= 4
  }
  const settled = (x: number, direction: 1 | -1): boolean => {
    for (let k = 0; k < EDGE_RUN; k++) if (!onLines(Math.min(width - 1, Math.max(0, x + direction * k)))) return false
    return true
  }
  let left = bounds(firstSlice)[0]
  let right = bounds(lastSlice)[1]
  for (let x = Math.max(0, left - sliceWidth); x <= left + sliceWidth && x < width; x++) {
    if (settled(x, 1)) {
      left = x
      break
    }
  }
  for (let x = Math.min(width - 1, right + sliceWidth); x >= right - sliceWidth && x >= 0; x--) {
    if (settled(x, -1)) {
      right = x
      break
    }
  }
  return { left, right, offsets }
}

/** Smallest share of the staff width that is inked on one of its lines: rules and chord diagrams line up like a staff but are mostly empty. */
function lineCoverage(image: BinaryImage, lineRows: number[], tracked: Tracked): number {
  const { width, height, data } = image
  let least = 1
  for (const centre of lineRows) {
    let ink = 0
    for (let x = tracked.left; x <= tracked.right; x++) {
      const row = Math.round(centre + (tracked.offsets[x] as number))
      for (let y = Math.max(0, row - 1); y <= Math.min(height - 1, row + 1); y++) {
        if (data[y * width + x]) {
          ink++
          break
        }
      }
    }
    least = Math.min(least, ink / (tracked.right - tracked.left + 1))
  }
  return least
}

export function detectStaves(image: BinaryImage, metrics: StaffMetrics): Staff[] {
  const { unit, thickness } = metrics
  const scores = longRunScores(image, Math.round(unit * LINE_RUN_UNITS))
  let maxScore = 0
  for (const score of scores) maxScore = Math.max(maxScore, score)
  const threshold = Math.max(maxScore * LINE_SCORE_FRACTION, unit * MIN_LINE_SCORE_UNITS)
  const groups = lineGroups(scores, threshold, thickness * MAX_LINE_ROWS_PER_THICKNESS + 3)
  const staves: Staff[] = []
  for (const lineRows of chainStaves(groups, unit)) {
    const spacing = ((lineRows[4] as number) - (lineRows[0] as number)) / 4
    const tracked = trackStaff(image, lineRows, spacing)
    if (!tracked || tracked.right - tracked.left < unit * MIN_STAFF_UNITS) continue
    if (lineCoverage(image, lineRows, tracked) < MIN_LINE_COVERAGE) continue
    const topY = new Float32Array(image.width)
    for (let x = 0; x < image.width; x++) topY[x] = (lineRows[0] as number) + (tracked.offsets[x] as number)
    staves.push({ unit: spacing, thickness, left: tracked.left, right: tracked.right, topY })
  }
  return staves
}

export function staffTopAt(staff: Staff, x: number): number {
  return staff.topY[Math.min(staff.topY.length - 1, Math.max(0, Math.round(x)))] as number
}

export function staffBottomAt(staff: Staff, x: number): number {
  return staffTopAt(staff, x) + 4 * staff.unit
}

/** Staff steps above the bottom line (lines are even, spaces odd) of a point, as a real number. */
export function stepOfPoint(staff: Staff, x: number, y: number): number {
  return (staffBottomAt(staff, x) - y) / (staff.unit / 2)
}

function barLineCoverage(image: BinaryImage, x: number, y0: number, y1: number): number {
  if (y1 <= y0) return 0
  let ink = 0
  for (let y = Math.round(y0); y <= Math.round(y1); y++) ink += image.data[y * image.width + x] as number
  return ink / (Math.round(y1) - Math.round(y0) + 1)
}

function joinedByLeftBarLine(image: BinaryImage, upper: Staff, lower: Staff): boolean {
  const gapUnits = (staffTopAt(lower, lower.left) - staffBottomAt(upper, upper.left)) / upper.unit
  if (gapUnits > MAX_LINK_GAP_UNITS || Math.abs(upper.left - lower.left) > upper.unit * 3) return false
  const centre = Math.round((upper.left + lower.left) / 2)
  const margin = upper.thickness * 2 + 2
  for (let x = Math.max(0, centre - margin); x <= Math.min(image.width - 1, centre + margin + upper.thickness); x++) {
    const coverage = barLineCoverage(image, x, staffBottomAt(upper, x) + upper.thickness, staffTopAt(lower, x) - upper.thickness)
    if (coverage >= LINKED_COVERAGE) return true
  }
  return false
}

/** Staves tied by a bar line on their left edge form one system; staves are sorted top to bottom. */
export function groupSystems(image: BinaryImage, staves: Staff[]): Staff[][] {
  const sorted = [...staves].sort((a, b) => staffTopAt(a, a.left) - staffTopAt(b, b.left))
  const systems: Staff[][] = []
  for (const staff of sorted) {
    const current = systems[systems.length - 1]
    const previous = current?.[current.length - 1]
    if (current && previous && joinedByLeftBarLine(image, previous, staff)) current.push(staff)
    else systems.push([staff])
  }
  return systems
}
