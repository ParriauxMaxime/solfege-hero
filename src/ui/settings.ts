import { instrumentLabel } from '../audio/instruments'
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

function clefLabel(clef: Clef): string {
  return t(`settings.clefs.${clef}`)
}

function namingChoices(): Choice<Settings['naming']>[] {
  return [
    { value: 'auto', label: t('settings.naming.auto') },
    { value: 'latin', label: t('settings.naming.latin') },
    { value: 'english', label: t('settings.naming.english') },
  ]
}

function languageChoices(): Choice<Settings['language']>[] {
  return [
    { value: 'auto', label: t('settings.language.auto') },
    { value: 'fr', label: t('settings.language.fr') },
    { value: 'en', label: t('settings.language.en') },
  ]
}

function themeChoices(): Choice<Theme>[] {
  return [
    { value: 'dark', label: t('settings.theme.dark') },
    { value: 'light', label: t('settings.theme.light') },
    { value: 'system', label: t('settings.theme.system') },
  ]
}

const KEY_SIZE_CHOICES: Choice<KeySize>[] = [
  { value: 'S', label: 'S' },
  { value: 'M', label: 'M' },
  { value: 'L', label: 'L' },
]

function keyboardSpanChoices(): Choice<KeyboardSpan>[] {
  return [
    { value: 1, label: t('settings.keyboard.oneOctave') },
    { value: 1.5, label: t('settings.keyboard.oneAndHalf') },
    { value: 2, label: t('settings.keyboard.twoOctaves') },
  ]
}

function survivalDelayChoices(): Choice<SurvivalDelay>[] {
  return SURVIVAL_DELAYS.map((delay) => ({ value: delay, label: t('settings.seconds', { count: delay }) }))
}

const SERIES_DIFFICULTY_CHOICES: Choice<Difficulty>[] = SERIES_DIFFICULTIES.map((level) => ({ value: level, label: String(level) }))
const EXPORT_FILE = 'solfege-progress.json'
const ACTION_ROW = 'settings-row action-row'

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
    if (!next) showToast(t('settings.keyNames.toast'))
  }

  function toggleRow(label: string, key: BooleanKey, hint = ''): HTMLElement {
    return row(label, toggle(settings[key], (next) => update({ [key]: next })), hint)
  }

  function vibrationRow(): HTMLElement {
    if ('vibrate' in navigator) return toggleRow(t('settings.vibration.label'), 'vibration')
    const control = toggle(false, () => {})
    control.setAttribute('disabled', '')
    return row(t('settings.vibration.label'), control, t('settings.vibration.unavailable'))
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
      showToast(t('settings.clefs.keepOne'))
      if (clefControl) restartAnimation(clefControl, 'shake')
      return
    }
    update({ clefs: CLEFS.filter((candidate) => (candidate === clef ? !selected : settings.clefs.includes(candidate))) })
  }

  function clefRow(): HTMLElement {
    const choices = CLEFS.map((clef) => ({ value: clef, label: clefLabel(clef) }))
    clefControl = choiceControl(choices, (clef) => settings.clefs.includes(clef), toggleClef)
    return row(t('settings.clefs.label'), clefControl)
  }

  function volumeRow(): HTMLElement {
    const slider = el('input', 'slider')
    slider.type = 'range'
    slider.min = '0'
    slider.max = '1'
    slider.step = '0.05'
    slider.value = String(settings.volume)
    slider.setAttribute('aria-label', t('settings.volume'))
    slider.addEventListener('input', () => update({ volume: Number(slider.value) }, false))
    return row(t('settings.volume'), slider)
  }

  function levelLabel(level: number): string {
    return t('settings.level.value', { level, tier: tierName(level) })
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
    slider.setAttribute('aria-label', t('settings.level.label'))
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
    const label = el('span', 'settings-label', t('settings.level.label'))
    return [
      el('div', 'settings-row level-row', el('div', 'level-head', label, value), slider, caps),
      row(t('settings.level.auto'), toggle(settings.levelAuto, (levelAuto) => update({ levelAuto })), t('settings.level.autoHint')),
    ]
  }

  function instrumentRow(): HTMLElement {
    const choose = button('segment-button', t('settings.instrument.choose'), () =>
      openInstrumentPicker({
        sound,
        current: settings.instrument,
        naming: resolveNaming(settings.naming),
        onSelect: (instrument) => update({ instrument }, false),
        onClose: render,
      }),
    )
    return row(t('settings.instrument.label'), choose, instrumentLabel(settings.instrument), ACTION_ROW)
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
    void shareLink({ title: 'Solfège hero', text: t('settings.about.shareText'), url: appBase(location.href) })
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
      showToast(imported ? t('settings.data.imported') : t('settings.data.invalidFile'))
    })
    return el('div', 'settings-actions', button('segment-button', t('settings.data.import'), () => input.click()), input)
  }

  function resetProgress(): void {
    if (!confirm(t('settings.data.resetConfirm'))) return
    onReset()
    showToast(t('settings.data.resetDone'))
  }

  function section(title: string, ...rows: HTMLElement[]): HTMLElement {
    return el('div', 'settings-section', el('h2', '', title), ...rows)
  }

  function levelSection(): HTMLElement {
    const level = section(t('settings.sections.level'), ...levelRows())
    level.classList.add('level-section')
    return level
  }

  function render(): void {
    element.replaceChildren(
      el('h1', '', t('settings.title')),
      levelSection(),
      section(
        t('settings.sections.game'),
        clefRow(),
        toggleRow(t('settings.accidentals'), 'accidentals'),
        row(t('settings.keyNames.label'), toggle(settings.keyNames, toggleKeyNames), t('settings.keyNames.hint')),
        choiceRow(t('settings.naming.label'), namingChoices(), settings.naming, (naming) => update({ naming })),
        choiceRow(t('settings.seriesDifficulty'), SERIES_DIFFICULTY_CHOICES, settings.seriesDifficulty, (seriesDifficulty) => update({ seriesDifficulty })),
        choiceRow(t('settings.survivalDelay'), survivalDelayChoices(), settings.survivalDelayS, (survivalDelayS) => update({ survivalDelayS })),
        row(
          t('settings.keyboard.label'),
          choiceControl(keyboardSpanChoices(), (span) => span === settings.keyboardSpan, (keyboardSpan) => update({ keyboardSpan })),
          t('settings.keyboard.hint'),
        ),
        toggleRow(t('settings.strictOctave.label'), 'strictOctave', t('settings.strictOctave.hint')),
        toggleRow(t('settings.timed'), 'timed'),
      ),
      section(
        t('settings.sections.display'),
        choiceRow(t('settings.language.label'), languageChoices(), settings.language, (language) => update({ language })),
        choiceRow(t('settings.theme.label'), themeChoices(), settings.theme, (theme) => update({ theme })),
        toggleRow(t('settings.colorblind.label'), 'colorblind', t('settings.colorblind.hint')),
        toggleRow(t('settings.reducedMotion'), 'reducedMotion'),
        choiceRow(t('settings.keySize'), KEY_SIZE_CHOICES, settings.keySize, (keySize) => update({ keySize })),
      ),
      section(
        t('settings.sections.sound'),
        row(t('settings.sounds'), toggle(!settings.muted, (next) => update({ muted: !next }))),
        toggleRow(t('settings.metronome'), 'metronome'),
        vibrationRow(),
        volumeRow(),
        instrumentRow(),
      ),
      section(
        t('settings.sections.data'),
        row(t('settings.data.stats'), button('danger', t('settings.data.reset'), resetProgress), '', ACTION_ROW),
        row(t('settings.data.backup'), el('div', 'settings-actions', button('segment-button', t('settings.data.export'), exportProgress)), '', ACTION_ROW),
        row(t('settings.data.restore'), importControl(), '', ACTION_ROW),
      ),
      section(t('settings.sections.about'), row(t('settings.about.shareApp'), button('segment-button', t('settings.about.share'), shareApp), '', ACTION_ROW)),
      button('primary', t('settings.back'), onBack),
    )
  }

  render()
  return element
}
