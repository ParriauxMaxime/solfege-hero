import { t, type MessageKey } from '../i18n'
import type { Clef } from '../music/notes'
import type { Challenge } from '../series/challenge'
import { formatTenths } from '../series/share'
import { button, el } from './dom'

const CLEF_LABEL_KEYS = { treble: 'learn.clefLabel.treble', bass: 'learn.clefLabel.bass', alto: 'learn.clefLabel.alto' } satisfies Record<Clef, MessageKey>

export interface ChallengeIntroOptions {
  challenge: Challenge
  onStart: () => void
}

export function createChallengeIntro({ challenge, onStart }: ChallengeIntroOptions): HTMLElement {
  const { config, timeS } = challenge
  const headline = timeS === null ? t('series.challenge.open') : t('series.challenge.friendTime', { time: formatTenths(timeS * 1000) })
  const chips = [
    ...config.clefs.map((clef) => t(CLEF_LABEL_KEYS[clef])),
    config.armures ? t('series.challenge.withKeys') : t('series.challenge.noKeys'),
    ...(config.version === 2 ? [t('series.challenge.difficulty', { level: config.difficulty })] : []),
  ]
  return el(
    'section',
    'screen panel challenge-intro',
    el('h1', '', t('series.challenge.title')),
    el('p', 'challenge-headline', headline),
    el('div', 'chips', ...chips.map((chip) => el('span', 'chip', chip))),
    button('primary big', t('series.challenge.start'), onStart),
  )
}
