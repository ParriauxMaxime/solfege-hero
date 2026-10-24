import { inlineAccidental } from '../music/keySignature'
import { staffStep } from '../music/notes'
import type { Clef, Note } from '../music/notes'
import {
  ACCIDENTAL_OFFSET,
  accidentalGlyph,
  clefGlyph,
  inkGroup,
  keySignatureGlyph,
  keySignatureWidth,
  ledgerLines,
  noteHead,
  staffLines,
  svgElement,
} from './glyphs'

const VIEW_WIDTH = 300
const VIEW_HEIGHT = 200
const STAFF_LEFT = 16
const STAFF_RIGHT = 284
const MIN_NOTE_X = 196
const SIGNATURE_X = 92
const NOTE_CLEARANCE = 60

const CLEF_LABELS: Record<Clef, string> = { treble: 'de sol', bass: 'de fa', alto: "d'ut" }

function renderNote(note: Note, step: number, fifths: number, noteX: number): SVGGElement {
  const group = inkGroup({ class: 'staff-note', style: 'transform-box: fill-box; transform-origin: center' })
  group.append(...ledgerLines(step, noteX))
  const accidental = inlineAccidental(note, fifths)
  if (accidental) group.append(accidentalGlyph(accidental, noteX + ACCIDENTAL_OFFSET, step))
  group.append(noteHead('hollow', noteX, step))
  return group
}

export function renderStaff(clef: Clef, note: Note, fifths: number): SVGSVGElement {
  const noteX = Math.max(MIN_NOTE_X, SIGNATURE_X + keySignatureWidth(fifths) + NOTE_CLEARANCE)
  const svg = svgElement('svg', {
    class: 'staff',
    viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
    width: '100%',
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': `Note sur la portée en clé ${CLEF_LABELS[clef]}`,
  })
  svg.append(
    staffLines(STAFF_LEFT, STAFF_RIGHT),
    clefGlyph(clef),
    keySignatureGlyph(clef, fifths, SIGNATURE_X),
    renderNote(note, staffStep(note, clef), fifths, noteX),
  )
  return svg
}

export function noteCenter(svg: SVGSVGElement): DOMPoint | null {
  const head = svg.querySelector('.staff-note-head')
  if (!head) return null
  const box = head.getBoundingClientRect()
  return new DOMPoint(box.x + box.width / 2, box.y + box.height / 2)
}
