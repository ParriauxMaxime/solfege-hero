import { t, type MessageKey } from '../i18n'
import { MAX_FIFTHS } from '../music/keySignature'
import { staffStep } from '../music/notes'
import type { Clef, Note } from '../music/notes'
import {
  STAFF_VIEW_HEIGHT as VIEW_HEIGHT,
  STAFF_VIEW_TOP as VIEW_TOP,
  clefGlyph,
  keySignatureGlyph,
  keySignatureWidth,
  noteGroup,
  staffLines,
  svgElement,
} from './glyphs'

const VIEW_PADDING = 4
const STAFF_LEFT = 12
const NOTE_TRAILING_SPACE = 34
const MIN_NOTE_X = 170
const SIGNATURE_X = 92
const NOTE_CLEARANCE = 60
const SIGNATURE_TRAILING_SPACE = 40

const CLEF_OF_KEYS = { treble: 'learn.clefOf.treble', bass: 'learn.clefOf.bass', alto: 'learn.clefOf.alto' } satisfies Record<Clef, MessageKey>

function renderNote(note: Note, step: number, fifths: number, noteX: number): SVGGElement {
  return noteGroup(note, step, fifths, noteX, { class: 'staff-note', style: 'transform-box: fill-box; transform-origin: center' })
}

function markKeySignature(glyph: SVGGElement): SVGGElement {
  glyph.classList.add('staff-key')
  return glyph
}

function staffSvg(clef: Clef, staffRight: number, label: string, fifths: number): SVGSVGElement {
  const svg = svgElement('svg', {
    class: 'staff',
    viewBox: `${STAFF_LEFT - VIEW_PADDING} ${VIEW_TOP} ${staffRight - STAFF_LEFT + 2 * VIEW_PADDING} ${VIEW_HEIGHT}`,
    width: '100%',
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': label,
  })
  svg.append(staffLines(STAFF_LEFT, staffRight), clefGlyph(clef), markKeySignature(keySignatureGlyph(clef, fifths, SIGNATURE_X)))
  return svg
}

export function renderStaff(clef: Clef, note: Note, fifths: number): SVGSVGElement {
  const noteX = Math.max(MIN_NOTE_X, SIGNATURE_X + keySignatureWidth(fifths) + NOTE_CLEARANCE)
  const svg = staffSvg(clef, noteX + NOTE_TRAILING_SPACE, t('learn.aria.note', { clef: t(CLEF_OF_KEYS[clef]) }), fifths)
  svg.append(renderNote(note, staffStep(note, clef), fifths, noteX))
  return svg
}

/** A clef and its key signature alone; the staff keeps the width of seven accidentals so it never resizes between prompts. */
export function renderKeySignatureStaff(clef: Clef, fifths: number): SVGSVGElement {
  const staffRight = SIGNATURE_X + keySignatureWidth(MAX_FIFTHS) + SIGNATURE_TRAILING_SPACE
  return staffSvg(clef, staffRight, t('learn.aria.keySignature', { clef: t(CLEF_OF_KEYS[clef]) }), fifths)
}

export function noteCenter(svg: SVGSVGElement): DOMPoint | null {
  const head = svg.querySelector('.staff-note-head')
  if (!head) return null
  const box = head.getBoundingClientRect()
  return new DOMPoint(box.x + box.width / 2, box.y + box.height / 2)
}
