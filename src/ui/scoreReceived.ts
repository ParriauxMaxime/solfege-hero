import type { Score } from '../hero/types'
import type { Clef } from '../music/notes'
import { formatTenths } from '../series/share'
import { button, el } from './dom'

const CLEF_LABELS: Record<Clef, string> = { treble: 'Clé de sol', bass: 'Clé de fa', alto: 'Clé d’ut 3' }

type ReceivedScore = Pick<Score, 'name' | 'clef' | 'key' | 'timeSignature' | 'notes'>

export function describeScore(score: ReceivedScore): string[] {
  const key = score.key === 0 ? 'Sans armure' : score.key > 0 ? `${score.key}♯` : `${-score.key}♭`
  return [CLEF_LABELS[score.clef], key, `${score.timeSignature.beats}/${score.timeSignature.beatType}`]
}

function pitchedCount(score: ReceivedScore): number {
  return score.notes.filter((note) => note.pitch !== null).length
}

export interface ScoreReceivedOptions {
  score: ReceivedScore
  onAdd: () => void
  onPlay: () => void
}

export function createScoreReceived({ score, onAdd, onPlay }: ScoreReceivedOptions): HTMLElement {
  return el(
    'section',
    'screen panel challenge-intro',
    el('h1', '', 'Partition reçue'),
    el('p', 'challenge-headline', `${score.name}, ${pitchedCount(score)} notes`),
    el('div', 'chips', ...describeScore(score).map((chip) => el('span', 'chip', chip))),
    button('primary big', 'Jouer', onPlay),
    button('segment-button', 'Ajouter à ma bibliothèque', onAdd),
  )
}

export interface ScoreChallengeIntroOptions {
  score: ReceivedScore
  timeS: number
  onStart: () => void
}

export function createScoreChallengeIntro({ score, timeS, onStart }: ScoreChallengeIntroOptions): HTMLElement {
  return el(
    'section',
    'screen panel challenge-intro',
    el('h1', '', 'Défi'),
    el('p', 'challenge-headline', `Ton ami a fait ${formatTenths(timeS * 1000)} sur « ${score.name} », à toi !`),
    el('div', 'chips', ...describeScore(score).map((chip) => el('span', 'chip', chip))),
    button('primary big', 'Commencer', onStart),
  )
}
