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

const VIEW_TOP = 20
const VIEW_HEIGHT = 158
const VIEW_PADDING = 4
const STAFF_LEFT = 12
const NOTE_TRAILING_SPACE = 34
const MIN_NOTE_X = 170
const SIGNATURE_X = 92
const NOTE_CLEARANCE = 60

const CLEF_LABELS: Record<Clef, string> = { treble: 'de sol', bass: 'de fa', alto: 'd’ut' }

function renderNote(note: Note, step: number, fifths: number, noteX: number): SVGGElement {
  const group = inkGroup({ class: 'staff-note', style: 'transform-box: fill-box; transform-origin: center' })
  group.append(...ledgerLines(step, noteX))
  const accidental = inlineAccidental(note, fifths)
  if (accidental) group.append(accidentalGlyph(accidental, noteX + ACCIDENTAL_OFFSET, step))
  group.append(noteHead('hollow', noteX, step))
  return group
}

function markKeySignature(glyph: SVGGElement): SVGGElement {
  glyph.classList.add('staff-key')
  return glyph
}

export function renderStaff(clef: Clef, note: Note, fifths: number): SVGSVGElement {
  const noteX = Math.max(MIN_NOTE_X, SIGNATURE_X + keySignatureWidth(fifths) + NOTE_CLEARANCE)
  const staffRight = noteX + NOTE_TRAILING_SPACE
  const svg = svgElement('svg', {
    class: 'staff',
    viewBox: `${STAFF_LEFT - VIEW_PADDING} ${VIEW_TOP} ${staffRight - STAFF_LEFT + 2 * VIEW_PADDING} ${VIEW_HEIGHT}`,
    width: '100%',
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': `Note sur la portée en clé ${CLEF_LABELS[clef]}`,
  })
  svg.append(
    staffLines(STAFF_LEFT, staffRight),
    clefGlyph(clef),
    markKeySignature(keySignatureGlyph(clef, fifths, SIGNATURE_X)),
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
