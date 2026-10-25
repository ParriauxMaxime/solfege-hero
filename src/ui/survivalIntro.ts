import type { Clef } from '../music/notes'
import type { SurvivalChallenge } from '../survival/challenge'
import { noteCount } from '../survival/share'
import { button, el } from './dom'

const CLEF_LABELS: Record<Clef, string> = { treble: 'Clé de sol', bass: 'Clé de fa', alto: 'Clé d’ut 3' }

export interface SurvivalIntroOptions {
  challenge: SurvivalChallenge
  onStart: () => void
}

export function createSurvivalIntro({ challenge, onStart }: SurvivalIntroOptions): HTMLElement {
  const { config, score } = challenge
  const headline = score === 0 ? 'Relève le défi !' : `Ton ami a tenu ${noteCount(score)}, à toi !`
  const chips = [
    ...config.clefs.map((clef) => CLEF_LABELS[clef]),
    config.armures ? 'Armures' : 'Sans armure',
    `${config.delayS} s par note`,
    '3 vies',
  ]
  return el(
    'section',
    'screen panel challenge-intro',
    el('h1', '', 'Défi Survie'),
    el('p', 'challenge-headline', headline),
    el('div', 'chips', ...chips.map((chip) => el('span', 'chip', chip))),
    button('primary big', 'Commencer', onStart),
  )
}
