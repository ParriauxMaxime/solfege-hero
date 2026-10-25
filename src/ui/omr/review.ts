import type { Sound } from '../../audio/sound'
import type { Duration, TimeSignature } from '../../hero/types'
import type { Accidental } from '../../music/keySignature'
import { scoreId } from '../../music/musicxml'
import type { Clef } from '../../music/notes'
import {
  accidentalOf,
  changeClef,
  changeKey,
  confidenceBand,
  insertAfter,
  moveByStep,
  removeNote,
  reviewNotesOf,
  setAccidental,
  setDuration,
  spelledIn,
  toggleDot,
  toggleRest,
  uncertainMeasures,
} from '../../omr/edit'
import type { ReviewNote } from '../../omr/edit'
import type { OmrResult } from '../../omr/types'
import type { NewScore } from '../../storage/scores'
import { button, el, iconButton, setIcon } from '../dom'
import { confirmOverlay } from '../confirm'
import { icon } from '../icons'
import { renderSheet } from '../sheet'
import type { Sheet } from '../sheet'
import { createEditTools } from './editTools'
import { createPlayback } from './playback'
import { createSettingsPanel } from './settingsPanel'
import { createSourceCrop } from './sourceCrop'

export interface ReviewOptions {
  source: ImageBitmap
  result: OmrResult
  sound: Sound
  onSave: (score: NewScore) => void
  onClose: () => void
  /** Reads the same image again keeping another staff of every system; the review is replaced. */
  onRerun: (staffIndex: number) => void
}

export interface Review {
  element: HTMLElement
  hasEdits: () => boolean
  destroy: () => void
}

const MIN_SHEET_WIDTH = 560
const MAX_SHEET_WIDTH = 1000
/** Screen pixels per sheet unit the page is drawn at: wider panes get more measures per line rather than bigger notes. */
const SHEET_SCALE = 0.44
const STAFF_BAND_TOP = 70
const STAFF_BAND_BOTTOM_MARGIN = 24
const SELECTION_HALF_WIDTH = 20
const MEASURE_PADDING = 24
const UNCERTAIN_BAR_TOP = 52
const UNCERTAIN_BAR_HEIGHT = 8
const SCROLL_MARGIN = 8
const SVG_NS = 'http://www.w3.org/2000/svg'
const DEFAULT_NAME = 'Partition importée'

function cssColour(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function createReview({ source, result, sound, onSave, onClose, onRerun }: ReviewOptions): Review {
  let notes = reviewNotesOf(result)
  let clef: Clef = result.score.clef
  let key = result.score.key
  let time: TimeSignature = result.score.timeSignature
  let name = result.score.name
  let tempo = result.score.tempo
  let selected: number | null = null
  let playing: number | null = null
  let currentStaff = 0
  let edited = false
  let sheet: Sheet | null = null
  let sheetWidth = MIN_SHEET_WIDTH

  const crop = createSourceCrop(source)
  const sheetBox = el('div', 'omr-sheet')
  const staffLabel = el('span', 'omr-staff-label')
  const previousStaff = iconButton('chevron-left', () => goToStaff(currentStaff - 1), 'Portée précédente')
  const nextStaff = iconButton('chevron-right', () => goToStaff(currentStaff + 1), 'Portée suivante')
  const playButton = iconButton('play', togglePlayback, 'Écouter')
  const saveButton = button('primary omr-save', 'Enregistrer', save)
  saveButton.prepend(icon('check'))
  saveButton.classList.add('inline-icon')

  const playback = createPlayback({
    sound,
    notes: () => notes,
    key: () => key,
    tempo: () => tempo,
    onNote(index) {
      playing = index
      markPlaying()
      setIcon(playButton, index === null ? 'play' : 'stop')
      playButton.setAttribute('aria-label', index === null ? 'Écouter' : 'Arrêter')
    },
  })

  const tools = createEditTools({
    move: (delta) => edit((current, index) => moveByStep(current, index, delta, key), true),
    duration: (duration: Duration) => edit((current, index) => setDuration(current, index, duration)),
    dot: () => edit(toggleDot),
    accidental: (accidental: Accidental) =>
      edit((current, index) => {
        const same = accidentalOf(current[index]?.spec.pitch ?? null, key) === accidental
        return setAccidental(current, index, same ? null : accidental, key)
      }, true),
    rest: () => edit((current, index) => toggleRest(current, index, clef, key)),
    insert: () => edit(insertAfter, false, 1),
    remove: removeSelected,
  })

  const settings = createSettingsPanel(
    { name, clef, key, time, tempo, staffIndex: result.staffIndexInSystem },
    {
      name(value) {
        name = value
        edited = true
      },
      clef(next) {
        notes = changeClef(notes, key, clef, next)
        clef = next
        changedGlobally()
      },
      key(next) {
        notes = changeKey(notes, clef, key, next)
        key = next
        changedGlobally()
      },
      time(next) {
        time = next
        changedGlobally()
      },
      tempo(next) {
        tempo = next
        edited = true
      },
      staff: askRerun,
    },
  )

  const warningCount = result.warnings.length
  const warnings = el('details', 'omr-details', el('summary', '', `Avertissements (${warningCount})`, icon('chevron-down')), el('ul', 'omr-warnings', ...result.warnings.map((warning) => el('li', '', warning))))
  warnings.hidden = warningCount === 0
  const settingsDetails = el('details', 'omr-details', el('summary', '', 'Réglages', icon('chevron-down')), settings)
  const legend = el(
    'p',
    'omr-legend',
    ...[
      ['high', 'sûre'],
      ['medium', 'à vérifier'],
      ['low', 'douteuse'],
    ].map(([band, label]) => el('span', 'omr-legend-item', el('i', `omr-swatch ${band}`), label as string)),
    el('span', 'omr-legend-item', el('i', 'omr-swatch bar'), 'mesure à revoir'),
  )

  const element = el(
    'section',
    'omr-review',
    el('header', 'omr-header', iconButton('close', onClose, 'Annuler'), el('h2', '', 'Vérification'), saveButton),
    el(
      'div',
      'omr-main',
      el('div', 'omr-left', crop.element, el('div', 'omr-nav', previousStaff, staffLabel, nextStaff, el('span', 'spacer'), playButton), sheetBox),
      el('div', 'omr-right', legend, tools.element, settingsDetails, warnings),
    ),
  )

  function currentScore() {
    return { clef, key, notes: notes.map((entry) => entry.spec), timeSignature: time }
  }

  function staffBand(position: { system: number }): { y: number; height: number } {
    const system = (sheet as Sheet).systems[position.system]
    const top = (system?.top ?? 0) + STAFF_BAND_TOP
    return { y: top, height: (system?.bottom ?? 0) - STAFF_BAND_BOTTOM_MARGIN - top }
  }

  function backgroundBand(className: string, x: number, width: number, position: { system: number }): SVGRectElement {
    const { y, height } = staffBand(position)
    const rect = document.createElementNS(SVG_NS, 'rect')
    rect.setAttribute('class', className)
    for (const [attribute, value] of Object.entries({ x, y, width, height, rx: 8 })) rect.setAttribute(attribute, String(value))
    return rect
  }

  function addBackgrounds(drawn: Sheet): void {
    const uncertain = uncertainMeasures(notes, time)
    const spans = new Map<string, { measure: number; system: number; left: number; right: number }>()
    for (const position of drawn.notePositions) {
      const measure = notes[position.index]?.measure
      if (measure === undefined || !uncertain.has(measure)) continue
      const id = `${measure}:${position.system}`
      const span = spans.get(id) ?? { measure, system: position.system, left: position.x, right: position.x }
      span.left = Math.min(span.left, position.x)
      span.right = Math.max(span.right, position.x)
      spans.set(id, span)
    }
    const bands = [...spans.values()].map((span) => {
      const bar = document.createElementNS(SVG_NS, 'rect')
      bar.setAttribute('class', 'omr-uncertain')
      const top = (drawn.systems[span.system]?.top ?? 0) + UNCERTAIN_BAR_TOP
      const geometry = { x: span.left - MEASURE_PADDING, y: top, width: span.right - span.left + 2 * MEASURE_PADDING, height: UNCERTAIN_BAR_HEIGHT, rx: 4 }
      for (const [attribute, value] of Object.entries(geometry)) bar.setAttribute(attribute, String(value))
      return bar
    })
    const chosen = drawn.notePositions.find((position) => position.index === selected)
    if (chosen) bands.push(backgroundBand('omr-selection', chosen.x - SELECTION_HALF_WIDTH, 2 * SELECTION_HALF_WIDTH, chosen))
    drawn.svg.prepend(...bands)
  }

  function markPlaying(): void {
    sheetBox.querySelector('.sheet-note.playing')?.classList.remove('playing')
    if (playing === null) return
    sheetBox.querySelector(`.sheet-note[data-note-index="${playing}"]`)?.classList.add('playing')
    const position = sheet?.notePositions.find((candidate) => candidate.index === playing)
    if (position) scrollToSystem(position.system)
  }

  /** Brings the system into view; `always` scrolls even when it is already visible. */
  function scrollToSystem(system: number, always = false): void {
    const drawn = sheet?.systems[system]
    if (!sheet || !drawn) return
    const scale = sheet.svg.clientWidth / sheetWidth
    const top = drawn.top * scale
    const hidden = top < sheetBox.scrollTop || drawn.bottom * scale > sheetBox.scrollTop + sheetBox.clientHeight
    if (always || hidden) sheetBox.scrollTo({ top: top - SCROLL_MARGIN })
  }

  function drawSheet(): void {
    const scrollTop = sheetBox.scrollTop
    const colours = { high: cssColour('--success'), medium: cssColour('--caution'), low: cssColour('--error') }
    const highlight = (index: number) => colours[confidenceBand(notes[index]?.confidence ?? 0)]
    sheet = renderSheet(currentScore(), { width: sheetWidth, highlight, onNoteTap: select })
    addBackgrounds(sheet)
    sheetBox.replaceChildren(sheet.svg)
    sheetBox.scrollTop = scrollTop
    markPlaying()
  }

  function drawSource(): void {
    const box = notes[selected ?? -1]?.box ?? null
    const onStaff = selected !== null && notes[selected]?.staff === currentStaff
    crop.show(result.staves[currentStaff]?.box ?? null, onStaff ? box : null)
  }

  function refreshChrome(): void {
    const count = result.staves.length
    staffLabel.textContent = count === 0 ? 'Aucune portée' : `Portée ${currentStaff + 1} / ${count}`
    previousStaff.disabled = currentStaff <= 0
    nextStaff.disabled = currentStaff >= count - 1
    saveButton.disabled = !notes.some((entry) => entry.spec.pitch !== null)
    const entry = selected === null ? null : notes[selected]
    tools.refresh(
      entry
        ? { pitched: entry.spec.pitch !== null, duration: entry.spec.duration, dotted: Boolean(entry.spec.dots), accidental: accidentalOf(entry.spec.pitch, key) }
        : null,
    )
  }

  function refresh(): void {
    drawSheet()
    drawSource()
    refreshChrome()
  }

  function select(index: number): void {
    selected = index
    currentStaff = notes[index]?.staff ?? currentStaff
    const entry = notes[index]
    if (entry?.spec.pitch != null) sound.playNote(spelledIn(entry.spec.pitch, key))
    refresh()
  }

  function goToStaff(target: number): void {
    currentStaff = Math.min(Math.max(0, target), Math.max(0, result.staves.length - 1))
    selected = null
    refresh()
    const first = notes.findIndex((entry) => entry.staff === currentStaff)
    const position = sheet?.notePositions.find((candidate) => candidate.index === first)
    if (position) scrollToSystem(position.system, true)
  }

  function edit(change: (current: ReviewNote[], index: number) => ReviewNote[], preview = false, selectionShift = 0): void {
    if (selected === null) return
    notes = change(notes, selected)
    selected += selectionShift
    edited = true
    const entry = notes[selected]
    if (preview && entry?.spec.pitch != null) sound.playNote(spelledIn(entry.spec.pitch, key))
    refresh()
  }

  function removeSelected(): void {
    if (selected === null) return
    notes = removeNote(notes, selected)
    selected = notes.length === 0 ? null : Math.min(selected, notes.length - 1)
    edited = true
    refresh()
  }

  async function askRerun(staffIndex: number): Promise<boolean> {
    if (edited && !(await confirmOverlay(element, 'Relire la portée choisie effacera tes corrections.', 'Relire', 'Garder mes corrections'))) return false
    playback.stop()
    onRerun(staffIndex)
    return true
  }

  function changedGlobally(): void {
    edited = true
    refresh()
  }

  function togglePlayback(): void {
    if (playback.isPlaying()) {
      playback.stop()
      return
    }
    sound.unlock()
    const firstOfStaff = notes.findIndex((entry) => entry.staff === currentStaff)
    void playback.start(selected ?? Math.max(0, firstOfStaff))
  }

  function save(): void {
    playback.stop()
    const melody = currentScore()
    onSave({ ...melody, id: scoreId(melody), name: name.trim() || DEFAULT_NAME, tempo })
  }

  function fitSheet(): void {
    const fitted = Math.min(MAX_SHEET_WIDTH, Math.max(MIN_SHEET_WIDTH, Math.round(sheetBox.clientWidth / SHEET_SCALE)))
    if (fitted === sheetWidth) return
    sheetWidth = fitted
    drawSheet()
  }

  function onResize(): void {
    fitSheet()
    drawSource()
  }

  window.addEventListener('resize', onResize)
  refresh()
  requestAnimationFrame(() => {
    fitSheet()
    goToStaff(0)
  })
  return {
    element,
    hasEdits: () => edited,
    destroy() {
      playback.stop()
      window.removeEventListener('resize', onResize)
    },
  }
}
