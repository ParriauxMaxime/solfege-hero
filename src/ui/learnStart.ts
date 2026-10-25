import { ALL_FIFTHS, type LearnKeyChange, type LearnKeyMode } from '../game/learnKey'
import { keyTonicName, signatureLabel } from '../music/keySignature'
import { vibrate } from '../platform/haptics'
import type { Clef } from '../music/notes'
import type { Settings } from '../storage'
import { button, el } from './dom'
import { levelPill } from './levelPill'
import { renderKeySignatureStaff } from './staff'

export interface LearnStartOptions {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onPlay: () => void
  onOpenSettings: () => void
}

const MODE_CHOICES: { value: LearnKeyMode; label: string }[] = [
  { value: 'random', label: 'Aléatoire' },
  { value: 'fixed', label: 'Une armure' },
]
const CHANGE_CHOICES: { value: LearnKeyChange; label: string }[] = [
  { value: 'short', label: '4–5 notes' },
  { value: '10', label: '10 notes' },
  { value: '20', label: '20 notes' },
  { value: 'never', label: 'Jamais' },
]
const CLEF_NAMES: Record<Clef, string> = { treble: 'Sol', bass: 'Fa', alto: 'Ut 3' }
const TICK_MS = 8

function chipLabel(fifths: number): string {
  return fifths === 0 ? 'Do' : `${signatureLabel(fifths)} · ${keyTonicName(fifths, 'major')}`
}

export function createLearnStart({ settings: initial, onChange, onPlay, onOpenSettings }: LearnStartOptions): HTMLElement {
  let settings = initial
  const element = el('section', 'screen panel learn-start')

  function update(patch: Partial<Settings>): void {
    settings = { ...settings, ...patch }
    onChange(patch)
  }

  function segmented<T extends string>(
    choices: { value: T; label: string }[],
    current: T,
    onPick: (value: T) => void,
  ): HTMLElement {
    const options = choices.map(({ value, label }) => {
      const option = button('segment', label, () => onPick(value))
      option.classList.toggle('active', value === current)
      return option
    })
    return el('div', 'segmented', ...options)
  }

  function centerOn(strip: HTMLElement, chip: HTMLElement): void {
    strip.scrollLeft = chip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2
  }

  function picker(): HTMLElement {
    const strip = el('div', 'key-strip')
    strip.setAttribute('role', 'listbox')
    strip.setAttribute('aria-label', 'Armure')
    const chips = new Map<number, HTMLElement>()
    for (const fifths of ALL_FIFTHS) {
      const chip = el('button', 'key-chip', renderKeySignatureStaff('treble', fifths), el('span', 'key-chip-label', chipLabel(fifths)))
      chip.type = 'button'
      chip.setAttribute('role', 'option')
      chip.classList.toggle('active', fifths === settings.learnFixedFifths)
      chip.addEventListener('click', () => {
        update({ learnFixedFifths: fifths })
        vibrate(TICK_MS)
        for (const [other, node] of chips) {
          node.classList.toggle('active', other === fifths)
          node.setAttribute('aria-selected', String(other === fifths))
        }
        chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      })
      chips.set(fifths, chip)
      strip.append(chip)
    }
    requestAnimationFrame(() => {
      const selected = chips.get(settings.learnFixedFifths)
      if (selected) centerOn(strip, selected)
    })
    return strip
  }

  function render(): void {
    const fixed = settings.learnKeyMode === 'fixed'
    const clefNames = settings.clefs.map((clef) => CLEF_NAMES[clef]).join(', ')
    element.classList.toggle('is-fixed', fixed)
    element.replaceChildren(
      el('h1', 'learn-title', 'Apprendre'),
      levelPill(settings.level, onOpenSettings),
      el(
        'div',
        'setting learn-mode',
        el('h2', '', 'Armure'),
        segmented(MODE_CHOICES, settings.learnKeyMode, (value) => {
          update({ learnKeyMode: value })
          render()
        }),
      ),
      ...(fixed
        ? [el('div', 'setting learn-picker', picker())]
        : [
            el(
              'div',
              'setting learn-change',
              el('h2', '', 'Changement d’armure'),
              segmented(CHANGE_CHOICES, settings.learnKeyChange, (value) => {
                update({ learnKeyChange: value })
                render()
              }),
            ),
          ]),
      el('p', 'learn-clefs', `Clés : ${clefNames} `, button('link-button', 'Modifier', onOpenSettings)),
      button('primary learn-play', 'Jouer', onPlay),
    )
  }

  render()
  return element
}
