import type { HeroChallenge } from '../hero/challenge'
import { t, type MessageKey } from '../i18n'
import type { Clef } from '../music/notes'
import { button, el } from './dom'

const CLEF_KEYS = { treble: 'hero.clef.treble', bass: 'hero.clef.bass', alto: 'hero.clef.alto' } satisfies Record<Clef, MessageKey>

export interface HeroChallengeIntroOptions {
  challenge: HeroChallenge
  onStart: () => void
}

export function createHeroChallengeIntro({ challenge, onStart }: HeroChallengeIntroOptions): HTMLElement {
  const { config, target } = challenge
  const headline = target ? t('hero.intro.headlineWithTarget', { percent: target.percent, score: target.score }) : t('hero.intro.headline')
  const chips = [
    ...config.clefs.map((clef) => t(CLEF_KEYS[clef])),
    config.armures ? t('hero.intro.keys') : t('hero.intro.noKeys'),
    t('hero.intro.bpm', { bpm: config.bpm }),
    t('hero.intro.bars', { count: config.bars }),
    t('hero.intro.level', { level: config.difficulty }),
  ]
  return el(
    'section',
    'screen panel challenge-intro',
    el('h1', '', t('hero.intro.title')),
    el('p', 'challenge-headline', headline),
    el('div', 'chips', ...chips.map((chip) => el('span', 'chip', chip))),
    button('primary big', t('hero.intro.start'), onStart),
  )
}
