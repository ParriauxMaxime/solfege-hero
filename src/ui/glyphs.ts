import { ledgerSteps, TOP_LINE_STEP } from '../music/notes'
import { signatureSteps } from '../music/keySignature'
import type { Accidental } from '../music/keySignature'
import type { Clef } from '../music/notes'

export type HeadFill = 'hollow' | 'filled'

const SVG_NS = 'http://www.w3.org/2000/svg'
const STEP_HEIGHT = 8
const BOTTOM_LINE_Y = 132
const MIDDLE_LINE_STEP = TOP_LINE_STEP / 2
const STEM_LENGTH = 28
const STEM_OFFSET: Record<HeadFill, number> = { hollow: 11, filled: 8.2 }
const BEAM_THICKNESS = 5
const LEDGER_HALF_WIDTH = 19

export const ACCIDENTAL_OFFSET = -34

const CLEF_PATHS: Record<Clef, string[]> = {
  treble: [
    'M58 152 C58 162 46 162 47 153',
    'M58 152 L61 70 C62 52 68 38 73 38 C80 40 72 62 58 90 C42 116 48 135 62 135 C77 135 80 114 67 107 C55 101 46 111 53 122 C57 127 64 124 62 118',
  ],
  bass: ['M42 84 C58 76 72 86 68 104 C64 120 50 134 34 146'],
  alto: ['M48 76 C66 68 80 80 68 92 C63 97 59 97 55 100 C59 103 63 103 68 108 C80 120 66 132 48 124'],
}

const CLEF_BARS: Record<Clef, { x: number; width: number }[]> = {
  treble: [],
  bass: [],
  alto: [
    { x: 36, width: 6 },
    { x: 46, width: 1.8 },
  ],
}

const CLEF_DOTS: Record<Clef, { cx: number; cy: number; r: number }[]> = {
  treble: [],
  alto: [],
  bass: [
    { cx: 42, cy: stepY(6), r: 5.5 },
    { cx: 79, cy: stepY(7), r: 2.8 },
    { cx: 79, cy: stepY(5), r: 2.8 },
  ],
}

interface AccidentalShape {
  stems: string[]
  bars: string[]
}

const ACCIDENTAL_SHAPES: Record<Exclude<Accidental, 'flat'>, AccidentalShape> = {
  sharp: { stems: ['M-3.5 -19 V21', 'M3.5 -21 V19'], bars: ['M-7.5 -3 L7.5 -8', 'M-7.5 8 L7.5 3'] },
  natural: { stems: ['M-3.5 -21 V5', 'M3.5 -5 V21'], bars: ['M-3.5 -2 L3.5 -5', 'M-3.5 5 L3.5 2'] },
}
const FLAT_PATH = 'M-3 -24 V8 C8 2 13 -4 13 -9 C13 -16 3 -15 -3 -5'

const SIGNATURE_SPACING = 14
const SIGNATURE_GAP = 6
const SIGNATURE_GLYPH_HALF_WIDTH = 8

const HEAD_PATHS: Record<HeadFill, string> = {
  hollow:
    'M-12 0 A12 8 0 1 0 12 0 A12 8 0 1 0 -12 0 Z ' +
    'M-4 -5.7 A7 4.2 55 1 0 4 5.7 A7 4.2 55 1 0 -4 -5.7 Z',
  filled: 'M-9 0 A9 6.5 0 1 0 9 0 A9 6.5 0 1 0 -9 0 Z',
}
const HEAD_TILT: Record<HeadFill, number> = { hollow: -15, filled: -20 }

const FLAG_PATH = 'M0 0 C1 8 12 12 10 24'
const QUARTER_REST_PATH = 'M-4 -16 L3 -9 L-3 -1 L4 7 C-4 8 -5 14 2 18'

export function stepY(step: number): number {
  return BOTTOM_LINE_Y - step * STEP_HEIGHT
}

export function svgElement<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, name)
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value))
  return element
}

function horizontalLine(step: number, x1: number, x2: number): SVGLineElement {
  const y = stepY(step)
  return svgElement('line', { x1, x2, y1: y, y2: y })
}

/** Group whose children inherit the engraving stroke used by heads, stems, flags and ledger lines. */
export function inkGroup(attributes: Record<string, string | number> = {}): SVGGElement {
  return svgElement('g', { stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', ...attributes })
}

export function staffLines(left: number, right: number): SVGGElement {
  const group = svgElement('g', { stroke: 'currentColor', 'stroke-width': 1.6 })
  for (let step = 0; step <= TOP_LINE_STEP; step += 2) group.append(horizontalLine(step, left, right))
  return group
}

export function clefGlyph(clef: Clef): SVGGElement {
  const group = svgElement('g', {
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 4,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  })
  for (const d of CLEF_PATHS[clef]) group.append(svgElement('path', { d }))
  for (const { x, width } of CLEF_BARS[clef]) {
    group.append(
      svgElement('path', { d: `M${x} ${stepY(TOP_LINE_STEP)} V${stepY(0)}`, 'stroke-width': width, 'stroke-linecap': 'butt' }),
    )
  }
  for (const dot of CLEF_DOTS[clef]) group.append(svgElement('circle', { ...dot, fill: 'currentColor', stroke: 'none' }))
  return group
}

export function accidentalGlyph(accidental: Accidental, x: number, step: number): SVGGElement {
  const group = svgElement('g', {
    transform: `translate(${x} ${stepY(step)})`,
    fill: 'none',
    'stroke-linejoin': 'round',
  })
  if (accidental === 'flat') {
    group.append(svgElement('path', { d: FLAT_PATH, 'stroke-width': 2.4 }))
    return group
  }
  const { stems, bars } = ACCIDENTAL_SHAPES[accidental]
  for (const d of stems) group.append(svgElement('path', { d, 'stroke-width': 1.8, 'stroke-linecap': 'butt' }))
  for (const d of bars) group.append(svgElement('path', { d, 'stroke-width': 4, 'stroke-linecap': 'butt' }))
  return group
}

export function keySignatureWidth(fifths: number): number {
  return fifths === 0 ? 0 : Math.abs(fifths) * SIGNATURE_SPACING + SIGNATURE_GAP
}

/** Accidentals of the key signature, with `x` as the left edge of the first one. */
export function keySignatureGlyph(clef: Clef, fifths: number, x: number): SVGGElement {
  const group = inkGroup()
  signatureSteps(fifths, clef).forEach(({ alter, step }, index) => {
    const centre = x + SIGNATURE_GLYPH_HALF_WIDTH + index * SIGNATURE_SPACING
    group.append(accidentalGlyph(alter === 1 ? 'sharp' : 'flat', centre, step))
  })
  return group
}

export function noteHead(fill: HeadFill, x: number, step: number): SVGPathElement {
  return svgElement('path', {
    class: 'staff-note-head',
    d: HEAD_PATHS[fill],
    transform: `translate(${x} ${stepY(step)}) rotate(${HEAD_TILT[fill]})`,
    fill: 'currentColor',
    stroke: 'none',
    'fill-rule': 'evenodd',
  })
}

export function ledgerLines(step: number, x: number): SVGLineElement[] {
  return ledgerSteps(step).map((ledger) => horizontalLine(ledger, x - LEDGER_HALF_WIDTH, x + LEDGER_HALF_WIDTH))
}

export function stemsUp(step: number): boolean {
  return step < MIDDLE_LINE_STEP
}

export function stemX(fill: HeadFill, x: number, up: boolean): number {
  return x + (up ? STEM_OFFSET[fill] : -STEM_OFFSET[fill])
}

export function stemTipY(step: number, up: boolean): number {
  return stepY(step) + (up ? -STEM_LENGTH : STEM_LENGTH)
}

export function stem(fill: HeadFill, x: number, step: number, up: boolean, tipY = stemTipY(step, up)): SVGLineElement {
  const sx = stemX(fill, x, up)
  return svgElement('line', { x1: sx, x2: sx, y1: stepY(step), y2: tipY })
}

export function flag(stemXPosition: number, tipY: number, up: boolean): SVGPathElement {
  return svgElement('path', {
    d: FLAG_PATH,
    transform: `translate(${stemXPosition} ${tipY}) scale(1 ${up ? 1 : -1})`,
    fill: 'none',
    'stroke-width': 2.8,
  })
}

/** Horizontal beam whose outer edge sits on `tipY`, between two stems. */
export function beam(x1: number, x2: number, tipY: number, up: boolean): SVGLineElement {
  const y = tipY + (up ? BEAM_THICKNESS / 2 : -BEAM_THICKNESS / 2)
  return svgElement('line', { x1, x2, y1: y, y2: y, 'stroke-width': BEAM_THICKNESS, 'stroke-linecap': 'butt' })
}

export function quarterRest(x: number): SVGPathElement {
  return svgElement('path', {
    d: QUARTER_REST_PATH,
    transform: `translate(${x} ${stepY(MIDDLE_LINE_STEP)})`,
    fill: 'none',
    'stroke-width': 3,
    'stroke-linejoin': 'round',
  })
}

export function barLine(x: number): SVGLineElement {
  return svgElement('line', { x1: x, x2: x, y1: stepY(TOP_LINE_STEP), y2: stepY(0), 'stroke-width': 1.6 })
}
