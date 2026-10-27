import { INSTRUMENT_LABELS } from '../audio/instruments'
import type { Sound } from '../audio/sound'
import { t } from '../i18n'
import { resolveNaming } from '../i18n/naming'
import { MAX_LEVEL, capsFor, describeCaps, tierName } from '../level/level'
import { CLEFS, type Clef } from '../music/notes'
import type { Difficulty } from '../music/generator'
import { SERIES_DIFFICULTIES } from '../series/series'
import { SURVIVAL_DELAYS, type SurvivalDelay } from '../survival/game'
import { exportData, importData, type KeySize, type Progress, type Settings, type Theme } from '../storage'
import { button, el } from './dom'
import type { KeyboardSpan } from './keyboardLayout'
import { restartAnimation } from './effects'
import { openInstrumentPicker } from './instrumentPicker'
import { shareLink } from './sharing'
import { showToast } from './toast'
import { appBase } from '../share/links'

export interface SettingsOptions {
  settings: Settings
  sound: Sound
  getProgress: () => Progress
  onChange: (patch: Partial<Settings>) => void
  /** The slider was released on a new level; saves it and returns the settings it changed. */
  onLevelChange: (level: number) => Partial<Settings>
  onReset: () => void
  onImport: (data: { settings: Settings; progress: Progress }) => void
  onBack: () => void
}

interface Choice<T> {
  value: T
  label: string
}

type BooleanKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never
}[keyof Settings]

const CLEF_LABELS: Record<Clef, string> = { treble: 'Sol', bass: 'Fa', alto: 'Ut 3' }
const NAMINGS: Choice<Settings['naming']>[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'latin', label: 'Do Ré Mi' },
  { value: 'english', label: 'C D E' },
]
function languageChoices(): Choice<Settings['language']>[] {
  return [
    { value: 'auto', label: t('settings.language.auto') },
    { value: 'fr', label: t('settings.language.fr') },
    { value: 'en', label: t('settings.language.en') },
  ]
}
const THEME_CHOICES: Choice<Theme>[] = [
  { value: 'dark', label: 'Sombre' },
  { value: 'light', label: 'Clair' },
  { value: 'system', label: 'Système' },
]
const KEY_SIZE_CHOICES: Choice<KeySize>[] = [
  { value: 'S', label: 'S' },
  { value: 'M', label: 'M' },
  { value: 'L', label: 'L' },
]
const KEYBOARD_SPAN_CHOICES: Choice<KeyboardSpan>[] = [
  { value: 1, label: '1 octave' },
  { value: 1.5, label: '1,5' },
  { value: 2, label: '2 octaves' },
]
const SURVIVAL_DELAY_CHOICES: Choice<SurvivalDelay>[] = SURVIVAL_DELAYS.map((delay) => ({ value: delay, label: `${delay} s` }))
const SERIES_DIFFICULTY_CHOICES: Choice<Difficulty>[] = SERIES_DIFFICULTIES.map((level) => ({ value: level, label: String(level) }))
const EXPORT_FILE = 'solfege-progress.json'
const ACTION_ROW = 'settings-row action-row'
const STRICT_OCTAVE_HINT = 'La réponse doit être à la bonne octave. Clavier 2 octaves, paysage uniquement.'
const LEVEL_AUTO_HINT = 'Monte ou descend selon tes 50 dernières réponses en Apprendre et Armures'
const KEY_NAMES_HINT = 'Désactivé : touches sans nom, pour les habitués'

export function createSettingsScreen({
  settings: initial,
  sound,
  getProgress,
  onChange,
  onLevelChange,
  onReset,
  onImport,
  onBack,
}: SettingsOptions): HTMLElement {
  let settings = initial
  const element = el('section', 'screen settings-list')
  let clefControl: HTMLElement | null = null

  function update(patch: Partial<Settings>, rerender = true): void {
    settings = { ...settings, ...patch }
    onChange(patch)
    if (rerender) render()
  }

  function row(label: string, control: HTMLElement, hint = '', className = 'settings-row'): HTMLElement {
    const text = el('span', 'settings-label', label)
    if (hint) text.append(el('small', 'settings-hint', hint))
    return el('div', className, text, control)
  }

  function toggle(checked: boolean, onToggle: (next: boolean) => void): HTMLElement {
    const control = button('toggle', '', () => onToggle(!checked))
    control.setAttribute('role', 'switch')
    control.setAttribute('aria-checked', String(checked))
    return control
  }

  function toggleKeyNames(next: boolean): void {
    update({ keyNames: next })
    if (!next) showToast('Touches sans nom : repère-toi au clavier')
  }

  function toggleRow(label: string, key: BooleanKey, hint = ''): HTMLElement {
    return row(label, toggle(settings[key], (next) => update({ [key]: next })), hint)
  }

  function vibrationRow(): HTMLElement {
    if ('vibrate' in navigator) return toggleRow('Vibration', 'vibration')
    const control = toggle(false, () => {})
    control.setAttribute('disabled', '')
    return row('Vibration', control, 'Non disponible sur cet appareil')
  }

  function choiceControl<T>(choices: Choice<T>[], isActive: (value: T) => boolean, onPick: (value: T) => void): HTMLElement {
    const options = choices.map((choice) => {
      const option = button('segment', choice.label, () => onPick(choice.value))
      option.classList.toggle('active', isActive(choice.value))
      return option
    })
    return el('div', 'segmented', ...options)
  }

  function choiceRow<T>(label: string, choices: Choice<T>[], current: T, onPick: (value: T) => void): HTMLElement {
    return row(label, choiceControl(choices, (value) => value === current, onPick))
  }

  function toggleClef(clef: Clef): void {
    const selected = settings.clefs.includes(clef)
    if (selected && settings.clefs.length === 1) {
      showToast('Garde au moins une clé')
      if (clefControl) restartAnimation(clefControl, 'shake')
      return
    }
    update({ clefs: CLEFS.filter((candidate) => (candidate === clef ? !selected : settings.clefs.includes(candidate))) })
  }

  function clefRow(): HTMLElement {
    const choices = CLEFS.map((clef) => ({ value: clef, label: CLEF_LABELS[clef] }))
    clefControl = choiceControl(choices, (clef) => settings.clefs.includes(clef), toggleClef)
    return row('Clés', clefControl)
  }

  function volumeRow(): HTMLElement {
    const slider = el('input', 'slider')
    slider.type = 'range'
    slider.min = '0'
    slider.max = '1'
    slider.step = '0.05'
    slider.value = String(settings.volume)
    slider.setAttribute('aria-label', 'Volume')
    slider.addEventListener('input', () => update({ volume: Number(slider.value) }, false))
    return row('Volume', slider)
  }

  function levelLabel(level: number): string {
    return `${level} · ${tierName(level)}`
  }

  function levelRows(): HTMLElement[] {
    const value = el('span', 'level-value', levelLabel(settings.level))
    const caps = el('p', 'level-caps', describeCaps(capsFor(settings.level)))
    const slider = el('input', 'slider')
    slider.type = 'range'
    slider.min = '0'
    slider.max = String(MAX_LEVEL)
    slider.step = '5'
    slider.value = String(settings.level)
    slider.setAttribute('aria-label', 'Niveau')
    slider.addEventListener('input', () => {
      const level = Number(slider.value)
      value.textContent = levelLabel(level)
      caps.textContent = describeCaps(capsFor(level))
    })
    slider.addEventListener('change', () => {
      const level = Number(slider.value)
      settings = { ...settings, ...onLevelChange(level) }
      render()
    })
    const label = el('span', 'settings-label', 'Niveau')
    return [
      el('div', 'settings-row level-row', el('div', 'level-head', label, value), slider, caps),
      row('Auto', toggle(settings.levelAuto, (levelAuto) => update({ levelAuto })), LEVEL_AUTO_HINT),
    ]
  }

  function instrumentRow(): HTMLElement {
    const choose = button('segment-button', 'Choisir', () =>
      openInstrumentPicker({
        sound,
        current: settings.instrument,
        naming: resolveNaming(settings.naming),
        onSelect: (instrument) => update({ instrument }, false),
        onClose: render,
      }),
    )
    return row('Instrument', choose, INSTRUMENT_LABELS[settings.instrument], ACTION_ROW)
  }

  function exportProgress(): void {
    const blob = new Blob([exportData(settings, getProgress())], { type: 'application/json' })
    const link = el('a')
    link.href = URL.createObjectURL(blob)
    link.download = EXPORT_FILE
    link.click()
    URL.revokeObjectURL(link.href)
  }

  function shareApp(): void {
    void shareLink({ title: 'Solfège hero', text: 'Apprendre à lire les notes, gratuit et hors ligne', url: appBase(location.href) })
  }

  function importControl(): HTMLElement {
    const input = el('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.hidden = true
    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      const imported = file ? importData(await file.text()) : null
      if (imported) {
        settings = imported.settings
        onImport(imported)
        render()
      }
      showToast(imported ? 'Importé !' : 'Fichier invalide')
    })
    return el('div', 'settings-actions', button('segment-button', 'Importer', () => input.click()), input)
  }

  function resetProgress(): void {
    if (!confirm('Effacer toute la progression ?')) return
    onReset()
    showToast('Statistiques réinitialisées')
  }

  function section(title: string, ...rows: HTMLElement[]): HTMLElement {
    return el('div', 'settings-section', el('h2', '', title), ...rows)
  }

  function levelSection(): HTMLElement {
    const level = section('Niveau', ...levelRows())
    level.classList.add('level-section')
    return level
  }

  function render(): void {
    element.replaceChildren(
      el('h1', '', 'Réglages'),
      levelSection(),
      section(
        'Jeu',
        clefRow(),
        toggleRow('Armures', 'accidentals'),
        row('Noms sur les touches', toggle(settings.keyNames, toggleKeyNames), KEY_NAMES_HINT),
        choiceRow('Notation', NAMINGS, settings.naming, (naming) => update({ naming })),
        choiceRow('Séries : difficulté', SERIES_DIFFICULTY_CHOICES, settings.seriesDifficulty, (seriesDifficulty) => update({ seriesDifficulty })),
        choiceRow('Survie : temps par note', SURVIVAL_DELAY_CHOICES, settings.survivalDelayS, (survivalDelayS) => update({ survivalDelayS })),
        row(
          'Clavier',
          choiceControl(KEYBOARD_SPAN_CHOICES, (span) => span === settings.keyboardSpan, (keyboardSpan) => update({ keyboardSpan })),
          'En paysage seulement',
        ),
        toggleRow('Octave stricte', 'strictOctave', STRICT_OCTAVE_HINT),
        toggleRow('Apprendre : chrono 60 s', 'timed'),
      ),
      section(
        'Affichage',
        choiceRow(t('settings.language.label'), languageChoices(), settings.language, (language) => update({ language })),
        choiceRow('Thème', THEME_CHOICES, settings.theme, (theme) => update({ theme })),
        toggleRow('Mode daltonien', 'colorblind', 'bleu/orange au lieu de vert/rouge'),
        toggleRow('Animations réduites', 'reducedMotion'),
        choiceRow('Taille des touches', KEY_SIZE_CHOICES, settings.keySize, (keySize) => update({ keySize })),
      ),
      section(
        'Son',
        row('Sons', toggle(!settings.muted, (next) => update({ muted: !next }))),
        toggleRow('Métronome', 'metronome'),
        vibrationRow(),
        volumeRow(),
        instrumentRow(),
      ),
      section(
        'Données',
        row('Statistiques', button('danger', 'Réinitialiser', resetProgress), '', ACTION_ROW),
        row('Sauvegarde', el('div', 'settings-actions', button('segment-button', 'Exporter', exportProgress)), '', ACTION_ROW),
        row('Restauration', importControl(), '', ACTION_ROW),
      ),
      section('À propos', row('Partager l’app', button('segment-button', 'Partager', shareApp), '', ACTION_ROW)),
      button('primary', 'Retour', onBack),
    )
  }

  render()
  return element
}
