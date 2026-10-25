import type { HeroChallenge } from '../hero/challenge'
import type { Clef } from '../music/notes'
import { button, el } from './dom'

const CLEF_LABELS: Record<Clef, string> = { treble: 'Clé de sol', bass: 'Clé de fa', alto: 'Clé d’ut 3' }
const NBSP = ' '

export interface HeroChallengeIntroOptions {
  challenge: HeroChallenge
  onStart: () => void
}

export function createHeroChallengeIntro({ challenge, onStart }: HeroChallengeIntroOptions): HTMLElement {
  const { config, target } = challenge
  const headline = target
    ? `Ton ami a fait ${target.percent}${NBSP}% et ${target.score}${NBSP}pts, à toi${NBSP}!`
    : `Relève le défi${NBSP}!`
  const chips = [
    ...config.clefs.map((clef) => CLEF_LABELS[clef]),
    config.armures ? 'Armures' : 'Sans armure',
    `${config.bpm}${NBSP}BPM`,
    `${config.bars}${NBSP}mesures`,
    `Niveau${NBSP}${config.difficulty}`,
  ]
  return el(
    'section',
    'screen panel challenge-intro',
    el('h1', '', 'Défi hero'),
    el('p', 'challenge-headline', headline),
    el('div', 'chips', ...chips.map((chip) => el('span', 'chip', chip))),
    button('primary big', 'Commencer', onStart),
  )
}
