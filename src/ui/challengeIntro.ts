import type { Clef } from '../music/notes'
import type { Challenge } from '../series/challenge'
import { formatTenths } from '../series/share'
import { button, el } from './dom'

const CLEF_LABELS: Record<Clef, string> = { treble: 'Clé de sol', bass: 'Clé de fa', alto: "Clé d'ut 3" }

export interface ChallengeIntroOptions {
  challenge: Challenge
  onStart: () => void
}

export function createChallengeIntro({ challenge, onStart }: ChallengeIntroOptions): HTMLElement {
  const { config, timeS } = challenge
  const headline = timeS === null ? 'Relève le défi !' : `Ton ami a fait ${formatTenths(timeS * 1000)}, à toi !`
  const chips = [...config.clefs.map((clef) => CLEF_LABELS[clef]), config.armures ? 'Armures' : 'Sans armure']
  return el(
    'section',
    'screen panel challenge-intro',
    el('h1', '', 'Défi'),
    el('p', 'challenge-headline', headline),
    el('div', 'chips', ...chips.map((chip) => el('span', 'chip', chip))),
    button('primary big', 'Commencer', onStart),
  )
}
