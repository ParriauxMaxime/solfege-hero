import { t, type MessageKey } from '../i18n'
import { resolveNaming } from '../i18n/naming'
import { tierName } from '../level/level'
import type { DictationChallenge } from '../dictation/challenge'
import { pitchClassLabel, type Clef } from '../music/notes'
import { formatTenths } from '../series/share'
import type { Settings } from '../storage'
import { button, el } from './dom'
import { levelPill } from './levelPill'

const CLEF_NAME_KEYS = { treble: 'learn.clefName.treble', bass: 'learn.clefName.bass', alto: 'learn.clefName.alto' } satisfies Record<Clef, MessageKey>
const CLEF_LABEL_KEYS = { treble: 'learn.clefLabel.treble', bass: 'learn.clefLabel.bass', alto: 'learn.clefLabel.alto' } satisfies Record<Clef, MessageKey>

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

function howItWorks(): HTMLElement {
  return el('p', 'dictation-how', el('strong', '', t('dictation.howTitle')), ` ${t('dictation.how')}`)
}

function referenceRow(settings: Settings, onToggle: (next: boolean) => void): HTMLElement {
  const reference = settings.dictationReference
  const toggle = button('toggle', '', () => onToggle(!reference))
  toggle.setAttribute('role', 'switch')
  toggle.setAttribute('aria-checked', String(reference))
  toggle.setAttribute('aria-label', t('dictation.reference'))
  const hint = t('dictation.referenceHint', { note: pitchClassLabel(0, resolveNaming(settings.naming)) })
  const label = el('span', 'settings-label', t('dictation.reference'), el('small', 'settings-hint', hint))
  return el('div', 'settings-row dictation-reference', label, toggle)
}

export function createDictationStart({ settings: initial, onChange, onPlay, onOpenSettings }: DictationStartOptions): HTMLElement {
  let settings = initial
  const element = el('section', 'screen panel learn-start dictation-start')

  function render(): void {
    const clefNames = settings.clefs.map((clef) => t(CLEF_NAME_KEYS[clef])).join(', ')
    element.replaceChildren(
      el('h1', 'learn-title', t('dictation.title')),
      levelPill(settings.level, onOpenSettings),
      howItWorks(),
      referenceRow(settings, (dictationReference) => {
        settings = { ...settings, dictationReference }
        onChange({ dictationReference })
        render()
      }),
      el('p', 'learn-clefs', `${t('learn.clefs', { names: clefNames })} `, button('link-button', t('learn.edit'), onOpenSettings)),
      button('primary learn-play', t('dictation.play'), onPlay),
    )
  }

  render()
  return element
}

export function createDictationChallengeIntro({ challenge, settings: initial, onChange, onStart }: DictationChallengeIntroOptions): HTMLElement {
  let settings = initial
  const { config, timeS } = challenge
  const element = el('section', 'screen panel challenge-intro dictation-start')

  function render(): void {
    const headline = timeS === null ? t('dictation.open') : t('dictation.friendTime', { time: formatTenths(timeS * 1000) })
    const chips = [t(CLEF_LABEL_KEYS[config.clef]), t('dictation.levelChip', { level: config.level, tier: tierName(config.level) })]
    element.replaceChildren(
      el('h1', '', t('dictation.challengeTitle')),
      el('p', 'challenge-headline', headline),
      el('div', 'chips', ...chips.map((chip) => el('span', 'chip', chip))),
      howItWorks(),
      referenceRow(settings, (dictationReference) => {
        settings = { ...settings, dictationReference }
        onChange({ dictationReference })
        render()
      }),
      button('primary big', t('dictation.start'), onStart),
    )
  }

  render()
  return element
}
