import { CLEFS, type Clef } from '../music/notes'
import type { Settings } from '../storage'
import { button, el } from './dom'

export interface SettingsOptions {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onBack: () => void
}

const CLEF_LABELS: Record<Clef, string> = { treble: 'Sol', bass: 'Fa', alto: 'Ut 3' }
const ON_OFF = [
  { value: false, label: 'Non' },
  { value: true, label: 'Oui' },
]

export function createSettingsScreen({ settings: initial, onChange, onBack }: SettingsOptions): HTMLElement {
  let settings = initial
  const element = el('section', 'screen panel')

  function update(patch: Partial<Settings>): void {
    settings = { ...settings, ...patch }
    onChange(patch)
    render()
  }

  function toggleClef(clef: Clef): void {
    const selected = settings.clefs.includes(clef)
    if (selected && settings.clefs.length === 1) return
    update({ clefs: CLEFS.filter((candidate) => (candidate === clef ? !selected : settings.clefs.includes(candidate))) })
  }

  function clefSetting(): HTMLElement {
    const options = CLEFS.map((clef) => {
      const option = button('segment', CLEF_LABELS[clef], () => toggleClef(clef))
      option.classList.toggle('active', settings.clefs.includes(clef))
      return option
    })
    return el('div', 'setting', el('h2', '', 'Clés'), el('div', 'segmented', ...options))
  }

  function onOffSetting(title: string, key: 'accidentals' | 'timed'): HTMLElement {
    const options = ON_OFF.map((choice) => {
      const option = button('segment', choice.label, () => update({ [key]: choice.value }))
      option.classList.toggle('active', choice.value === settings[key])
      return option
    })
    return el('div', 'setting', el('h2', '', title), el('div', 'segmented', ...options))
  }

  function render(): void {
    element.replaceChildren(
      el('h1', '', 'Réglages'),
      clefSetting(),
      onOffSetting('Altérations', 'accidentals'),
      onOffSetting('Mode chrono 60 s', 'timed'),
      button('primary', 'Retour', onBack),
    )
  }

  render()
  return element
}
