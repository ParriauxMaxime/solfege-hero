import type { TimeSignature } from '../../hero/types'
import type { Clef } from '../../music/notes'
import { el } from '../dom'
import { createStaffPicker } from './staffPicker'

export interface SettingsValues {
  name: string
  clef: Clef
  key: number
  time: TimeSignature
  tempo: number
  staffIndex: number
}

export interface SettingsHandlers {
  name: (name: string) => void
  clef: (clef: Clef) => void
  key: (fifths: number) => void
  time: (time: TimeSignature) => void
  tempo: (tempo: number) => void
  /** Resolves false when the change is refused and the picker must go back. */
  staff: (staffIndex: number) => Promise<boolean>
}

const CLEF_CHOICES: { value: Clef; label: string }[] = [
  { value: 'treble', label: 'Sol' },
  { value: 'bass', label: 'Fa' },
  { value: 'alto', label: 'Ut 3' },
]
const COMMON_TIMES = ['2/4', '3/4', '4/4', '5/4', '2/2', '3/8', '6/8', '9/8', '12/8']
const MAX_NAME_LENGTH = 80
const MIN_TEMPO = 40
const MAX_TEMPO = 200

export function keyLabel(fifths: number): string {
  if (fifths === 0) return 'Aucune'
  return fifths > 0 ? `${fifths} ♯` : `${-fifths} ♭`
}

function timeLabel(time: TimeSignature): string {
  return `${time.beats}/${time.beatType}`
}

function parseTime(label: string): TimeSignature {
  const [beats, beatType] = label.split('/').map(Number)
  return { beats: beats as number, beatType: beatType as number }
}

function field(label: string, control: HTMLElement): HTMLElement {
  return el('label', 'omr-field', el('span', 'omr-label', label), control)
}

function select(options: { value: string; label: string }[], value: string, onChange: (value: string) => void): HTMLSelectElement {
  const element = el('select', 'omr-select', ...options.map((option) => Object.assign(el('option', '', option.label), { value: option.value })))
  element.value = value
  element.addEventListener('change', () => onChange(element.value))
  return element
}

export function createSettingsPanel(values: SettingsValues, handlers: SettingsHandlers): HTMLElement {
  const name = el('input', 'omr-input')
  name.type = 'text'
  name.maxLength = MAX_NAME_LENGTH
  name.value = values.name
  name.addEventListener('input', () => handlers.name(name.value))

  const tempo = el('input', 'omr-input')
  tempo.type = 'number'
  tempo.inputMode = 'numeric'
  tempo.min = String(MIN_TEMPO)
  tempo.max = String(MAX_TEMPO)
  tempo.value = String(values.tempo)
  tempo.addEventListener('change', () => {
    const clamped = Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(Number(tempo.value)) || values.tempo))
    tempo.value = String(clamped)
    handlers.tempo(clamped)
  })

  const keys = Array.from({ length: 15 }, (_, index) => index - 7).map((fifths) => ({ value: String(fifths), label: keyLabel(fifths) }))
  const times = new Set([...COMMON_TIMES, timeLabel(values.time)])
  const timeOptions = [...times].map((label) => ({ value: label, label }))

  return el(
    'div',
    'omr-settings-body',
    field('Titre', name),
    field('Clé', select(CLEF_CHOICES, values.clef, (value) => handlers.clef(value as Clef))),
    field('Armure', select(keys, String(values.key), (value) => handlers.key(Number(value)))),
    field('Chiffrage', select(timeOptions, timeLabel(values.time), (value) => handlers.time(parseTime(value)))),
    field('Tempo', tempo),
    createStaffPicker(values.staffIndex, handlers.staff).element,
  )
}
