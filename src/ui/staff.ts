import { ledgerSteps, staffStep } from '../music/notes'
import type { Clef, Note } from '../music/notes'

const SVG_NS = 'http://www.w3.org/2000/svg'
const VIEW_WIDTH = 300
const VIEW_HEIGHT = 200
const STEP_HEIGHT = 8
const BOTTOM_LINE_Y = 132
const STAFF_LEFT = 16
const STAFF_RIGHT = 284
const NOTE_X = 196
const LEDGER_HALF_WIDTH = 19

const CLEF_PATHS: Record<Clef, string[]> = {
  treble: [
    'M58 152 C58 162 46 162 47 153',
    'M58 152 L61 70 C62 52 68 38 73 38 C80 40 72 62 58 90 C42 116 48 135 62 135 C77 135 80 114 67 107 C55 101 46 111 53 122 C57 127 64 124 62 118',
  ],
  bass: [
    'M42 84 C58 76 72 86 68 104 C64 120 50 134 34 146',
  ],
  alto: [
    'M48 76 C66 68 80 80 68 92 C63 97 59 97 55 100 C59 103 63 103 68 108 C80 120 66 132 48 124',
  ],
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

const CLEF_LABELS: Record<Clef, string> = { treble: 'de sol', bass: 'de fa', alto: "d'ut" }

const ACCIDENTAL_X = NOTE_X - 34
const SHARP_STEMS = ['M-3.5 -19 V21', 'M3.5 -21 V19']
const SHARP_BARS = ['M-7.5 -3 L7.5 -8', 'M-7.5 8 L7.5 3']
const FLAT_PATH = 'M-3 -24 V8 C8 2 13 -4 13 -9 C13 -16 3 -15 -3 -5'

const WHOLE_NOTE_PATH =
  'M-12 0 A12 8 0 1 0 12 0 A12 8 0 1 0 -12 0 Z ' +
  'M-4 -5.7 A7 4.2 55 1 0 4 5.7 A7 4.2 55 1 0 -4 -5.7 Z'

function stepY(step: number): number {
  return BOTTOM_LINE_Y - step * STEP_HEIGHT
}

function svgElement<K extends keyof SVGElementTagNameMap>(
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

function renderClef(clef: Clef): SVGGElement {
  const group = svgElement('g', {
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 4,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  })
  for (const d of CLEF_PATHS[clef]) group.append(svgElement('path', { d }))
  for (const { x, width } of CLEF_BARS[clef]) {
    group.append(svgElement('path', { d: `M${x} ${stepY(8)} V${stepY(0)}`, 'stroke-width': width, 'stroke-linecap': 'butt' }))
  }
  for (const dot of CLEF_DOTS[clef]) {
    group.append(svgElement('circle', { ...dot, fill: 'currentColor', stroke: 'none' }))
  }
  return group
}

function renderAccidental(alter: Note['alter'], step: number): SVGGElement {
  const group = svgElement('g', {
    transform: `translate(${ACCIDENTAL_X} ${stepY(step)})`,
    fill: 'none',
    'stroke-linejoin': 'round',
  })
  if (alter === 1) {
    for (const d of SHARP_STEMS) group.append(svgElement('path', { d, 'stroke-width': 1.8, 'stroke-linecap': 'butt' }))
    for (const d of SHARP_BARS) group.append(svgElement('path', { d, 'stroke-width': 4, 'stroke-linecap': 'butt' }))
  } else {
    group.append(svgElement('path', { d: FLAT_PATH, 'stroke-width': 2.4 }))
  }
  return group
}

function renderNote(step: number, alter: Note['alter']): SVGGElement {
  const group = svgElement('g', {
    class: 'staff-note',
    style: 'transform-box: fill-box; transform-origin: center',
    stroke: 'currentColor',
    'stroke-width': 2.4,
    'stroke-linecap': 'round',
  })
  for (const ledger of ledgerSteps(step)) {
    group.append(horizontalLine(ledger, NOTE_X - LEDGER_HALF_WIDTH, NOTE_X + LEDGER_HALF_WIDTH))
  }
  if (alter !== 0) group.append(renderAccidental(alter, step))
  group.append(
    svgElement('path', {
      class: 'staff-note-head',
      d: WHOLE_NOTE_PATH,
      transform: `translate(${NOTE_X} ${stepY(step)}) rotate(-15)`,
      fill: 'currentColor',
      stroke: 'none',
      'fill-rule': 'evenodd',
    }),
  )
  return group
}

export function renderStaff(clef: Clef, note: Note): SVGSVGElement {
  const svg = svgElement('svg', {
    class: 'staff',
    viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
    width: '100%',
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': `Note sur la portée en clé ${CLEF_LABELS[clef]}`,
  })
  const lines = svgElement('g', { stroke: 'currentColor', 'stroke-width': 1.6 })
  for (let step = 0; step <= 8; step += 2) lines.append(horizontalLine(step, STAFF_LEFT, STAFF_RIGHT))
  svg.append(lines, renderClef(clef), renderNote(staffStep(note, clef), note.alter))
  return svg
}

export function noteCenter(svg: SVGSVGElement): DOMPoint | null {
  const head = svg.querySelector('.staff-note-head')
  if (!head) return null
  const box = head.getBoundingClientRect()
  return new DOMPoint(box.x + box.width / 2, box.y + box.height / 2)
}
