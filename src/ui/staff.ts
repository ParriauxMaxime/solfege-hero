import { staffStep } from '../music/notes'
import type { Clef, Note } from '../music/notes'
import {
  ACCIDENTAL_OFFSET,
  accidentalGlyph,
  clefGlyph,
  inkGroup,
  ledgerLines,
  noteHead,
  staffLines,
  svgElement,
} from './glyphs'

const VIEW_WIDTH = 300
const VIEW_HEIGHT = 200
const STAFF_LEFT = 16
const STAFF_RIGHT = 284
const NOTE_X = 196

const CLEF_LABELS: Record<Clef, string> = { treble: 'de sol', bass: 'de fa', alto: "d'ut" }

function renderNote(step: number, alter: Note['alter']): SVGGElement {
  const group = inkGroup({ class: 'staff-note', style: 'transform-box: fill-box; transform-origin: center' })
  group.append(...ledgerLines(step, NOTE_X))
  if (alter !== 0) group.append(accidentalGlyph(alter, NOTE_X + ACCIDENTAL_OFFSET, step))
  group.append(noteHead('hollow', NOTE_X, step))
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
  svg.append(staffLines(STAFF_LEFT, STAFF_RIGHT), clefGlyph(clef), renderNote(staffStep(note, clef), note.alter))
  return svg
}

export function noteCenter(svg: SVGSVGElement): DOMPoint | null {
  const head = svg.querySelector('.staff-note-head')
  if (!head) return null
  const box = head.getBoundingClientRect()
  return new DOMPoint(box.x + box.width / 2, box.y + box.height / 2)
}
