import type { Score } from '../hero/types'
import { t, type MessageKey } from '../i18n'
import type { Clef } from '../music/notes'
import { formatTenths } from '../series/share'
import { button, el } from './dom'

const CLEF_KEYS = { treble: 'hero.clef.treble', bass: 'hero.clef.bass', alto: 'hero.clef.alto' } satisfies Record<Clef, MessageKey>

type ReceivedScore = Pick<Score, 'name' | 'clef' | 'key' | 'timeSignature' | 'notes'>

export function describeScore(score: ReceivedScore): string[] {
  const key = score.key === 0 ? t('library.noKey') : score.key > 0 ? `${score.key}♯` : `${-score.key}♭`
  return [t(CLEF_KEYS[score.clef]), key, `${score.timeSignature.beats}/${score.timeSignature.beatType}`]
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
    el('h1', '', t('library.received.title')),
    el('p', 'challenge-headline', t('library.received.headline', { name: score.name, count: pitchedCount(score) })),
    el('div', 'chips', ...describeScore(score).map((chip) => el('span', 'chip', chip))),
    button('primary big', t('library.received.play'), onPlay),
    button('segment-button', t('library.received.add'), onAdd),
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
    el('h1', '', t('library.received.challengeTitle')),
    el('p', 'challenge-headline', t('library.received.challengeHeadline', { time: formatTenths(timeS * 1000), name: score.name })),
    el('div', 'chips', ...describeScore(score).map((chip) => el('span', 'chip', chip))),
    button('primary big', t('library.received.start'), onStart),
  )
}
