import { dailyLabel, type DailyKey } from '../series/daily'
import { formatTenthsUp } from '../series/share'
import { button, el } from './dom'
import { icon } from './icons'

export interface DailyIntroOptions {
  key: DailyKey
  /** True when the key is today's, so the first attempt counts. */
  ranked: boolean
  /** Time of today's counted attempt, if any. */
  attemptMs: number | null
  onStart: () => void
}

export function createDailyIntro({ key, ranked, attemptMs, onStart }: DailyIntroOptions): HTMLElement {
  const label = dailyLabel(key)
  const headline = ranked ? label : `Défi du ${label} (hors délai)`
  const details = ranked ? '20 notes, clé de sol, armures' : 'Entraînement, non compté dans ton score'
  const played = ranked && attemptMs !== null
  return el(
    'section',
    'screen panel challenge-intro',
    el('h1', '', 'Défi du jour'),
    el('p', 'challenge-headline', headline),
    el('p', 'result-best', details),
    el('p', 'result-best', 'Niveau 50 pour tout le monde'),
    played ? el('p', 'result-record inline-icon', icon('check'), `Ton score du jour : ${formatTenthsUp(attemptMs)}`) : '',
    button('primary big', played ? 'Rejouer (entraînement)' : 'Jouer', onStart),
  )
}
