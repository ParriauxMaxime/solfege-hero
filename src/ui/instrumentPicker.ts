import '../styles/picker.css'
import { instrumentDescription, instrumentLabel, INSTRUMENTS, type Instrument } from '../audio/instruments'
import type { Sound } from '../audio/sound'
import { t } from '../i18n'
import type { Naming } from '../music/notes'
import { createAnswerPad } from './answerPad'
import { button, el, iconButton } from './dom'
import { icon } from './icons'

export interface InstrumentPickerOptions {
  sound: Sound
  current: Instrument
  naming: Naming
  onSelect: (instrument: Instrument) => void
  onClose: () => void
}

const C4 = 60
const ARPEGGIO_SEMITONES = [0, 4, 7, 12]
const ARPEGGIO_STEP_SECONDS = 0.22

let open = false

/** True while the picker owns the hardware back button. */
export function isInstrumentPickerOpen(): boolean {
  return open
}

export function openInstrumentPicker({ sound, current, naming, onSelect, onClose }: InstrumentPickerOptions): void {
  if (open) return
  open = true
  let selected = current
  const cards = new Map<Instrument, HTMLButtonElement>()

  function select(instrument: Instrument): void {
    sound.unlock()
    selected = instrument
    for (const [candidate, card] of cards) {
      card.classList.toggle('selected', candidate === instrument)
      card.setAttribute('aria-pressed', String(candidate === instrument))
    }
    ARPEGGIO_SEMITONES.forEach((semitones, index) => sound.preview(instrument, C4 + semitones, index * ARPEGGIO_STEP_SECONDS))
    onSelect(instrument)
  }

  function card(instrument: Instrument): HTMLButtonElement {
    const control = button(
      'picker-card',
      '',
      () => select(instrument),
    )
    const art = el('span', 'picker-icon')
    art.append(icon(instrument === 'sine' ? 'wave' : instrument))
    control.append(art, el('strong', '', instrumentLabel(instrument)), el('small', '', instrumentDescription(instrument)))
    control.setAttribute('aria-pressed', String(instrument === selected))
    control.classList.toggle('selected', instrument === selected)
    cards.set(instrument, control)
    return control
  }

  const pad = createAnswerPad(
    ({ pitchClass }) => {
      sound.unlock()
      sound.preview(selected, C4 + pitchClass)
    },
    naming,
    1,
  )
  pad.element.classList.add('picker-keys')

  const modal = el(
    'div',
    'picker',
    el('header', 'picker-header', el('h2', '', t('settings.instrument.label')), iconButton('close', () => history.back(), t('common.close'))),
    el('div', 'picker-grid', ...INSTRUMENTS.map(card)),
    el('p', 'picker-hint', t('settings.instrument.hint')),
    pad.element,
  )
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  modal.setAttribute('aria-label', t('settings.instrument.label'))

  function close(): void {
    window.removeEventListener('popstate', close)
    pad.destroy()
    modal.remove()
    open = false
    onClose()
  }

  history.pushState({ screen: 'instrument-picker' }, '')
  window.addEventListener('popstate', close)
  document.body.append(modal)
}
