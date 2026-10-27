import { t, type MessageKey } from '../i18n'
import type { Clef } from '../music/notes'
import type { SurvivalChallenge } from '../survival/challenge'
import { noteCount } from '../survival/share'
import { button, el } from './dom'

const CLEF_LABEL_KEYS = { treble: 'learn.clefLabel.treble', bass: 'learn.clefLabel.bass', alto: 'learn.clefLabel.alto' } satisfies Record<Clef, MessageKey>

export interface SurvivalIntroOptions {
  challenge: SurvivalChallenge
  onStart: () => void
}

export function createSurvivalIntro({ challenge, onStart }: SurvivalIntroOptions): HTMLElement {
  const { config, score } = challenge
  const headline = score === 0 ? t('survival.challenge.open') : t('survival.challenge.friendScore', { notes: noteCount(score) })
  const chips = [
    ...config.clefs.map((clef) => t(CLEF_LABEL_KEYS[clef])),
    config.armures ? t('survival.challenge.withKeys') : t('survival.challenge.noKeys'),
    t('survival.challenge.perNote', { seconds: config.delayS }),
    t('survival.challenge.lives'),
  ]
  return el(
    'section',
    'screen panel challenge-intro',
    el('h1', '', t('survival.challenge.title')),
    el('p', 'challenge-headline', headline),
    el('div', 'chips', ...chips.map((chip) => el('span', 'chip', chip))),
    button('primary big', t('survival.challenge.start'), onStart),
  )
}
