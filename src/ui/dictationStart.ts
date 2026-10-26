import { tierName } from '../level/level'
import type { DictationChallenge } from '../dictation/challenge'
import type { Clef } from '../music/notes'
import { formatTenths } from '../series/share'
import type { Settings } from '../storage'
import { button, el } from './dom'
import { levelPill } from './levelPill'

const CLEF_NAMES: Record<Clef, string> = { treble: 'Sol', bass: 'Fa', alto: 'Ut 3' }
const CLEF_LABELS: Record<Clef, string> = { treble: 'Clé de sol', bass: 'Clé de fa', alto: 'Clé d’ut 3' }
const HOW_IT_WORKS = 'Écoute chaque note et trouve-la sur le clavier. Les notes sont cachées, +5 s par erreur.'

export interface DictationStartOptions {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onPlay: () => void
  onOpenSettings: () => void
}

export interface DictationChallengeIntroOptions {
  challenge: DictationChallenge
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onStart: () => void
}

function referenceRow(reference: boolean, onToggle: (next: boolean) => void): HTMLElement {
  const toggle = button('toggle', '', () => onToggle(!reference))
  toggle.setAttribute('role', 'switch')
  toggle.setAttribute('aria-checked', String(reference))
  toggle.setAttribute('aria-label', 'Note de référence')
  const label = el('span', 'settings-label', 'Note de référence', el('small', 'settings-hint', 'Do joué deux fois avant la première note'))
  return el('div', 'settings-row dictation-reference', label, toggle)
}

export function createDictationStart({ settings: initial, onChange, onPlay, onOpenSettings }: DictationStartOptions): HTMLElement {
  let settings = initial
  const element = el('section', 'screen panel learn-start dictation-start')

  function render(): void {
    const clefNames = settings.clefs.map((clef) => CLEF_NAMES[clef]).join(', ')
    element.replaceChildren(
      el('h1', 'learn-title', 'Dictée'),
      levelPill(settings.level, onOpenSettings),
      el('p', 'dictation-how', el('strong', '', 'Comment ça marche'), ` ${HOW_IT_WORKS}`),
      referenceRow(settings.dictationReference, (dictationReference) => {
        settings = { ...settings, dictationReference }
        onChange({ dictationReference })
        render()
      }),
      el('p', 'learn-clefs', `Clés : ${clefNames} `, button('link-button', 'Modifier', onOpenSettings)),
      button('primary learn-play', 'Jouer', onPlay),
    )
  }

  render()
  return element
}

export function createDictationChallengeIntro({ challenge, settings: initial, onChange, onStart }: DictationChallengeIntroOptions): HTMLElement {
  let settings = initial
  const { config, timeS } = challenge
  const element = el('section', 'screen panel challenge-intro dictation-start')
  const headline = timeS === null ? 'Relève le défi !' : `Ton ami a fait ${formatTenths(timeS * 1000)}, à toi !`
  const chips = [CLEF_LABELS[config.clef], `Niveau ${config.level} · ${tierName(config.level)}`]

  function render(): void {
    element.replaceChildren(
      el('h1', '', 'Défi Dictée'),
      el('p', 'challenge-headline', headline),
      el('div', 'chips', ...chips.map((chip) => el('span', 'chip', chip))),
      el('p', 'dictation-how', el('strong', '', 'Comment ça marche'), ` ${HOW_IT_WORKS}`),
      referenceRow(settings.dictationReference, (dictationReference) => {
        settings = { ...settings, dictationReference }
        onChange({ dictationReference })
        render()
      }),
      button('primary big', 'Commencer', onStart),
    )
  }

  render()
  return element
}
