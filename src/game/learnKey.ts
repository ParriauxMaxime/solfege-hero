import { t } from '../i18n'
import { MAX_FIFTHS, randomKey, signatureLabel } from '../music/keySignature'
import { pickCappedSignature } from '../level/level'
import type { LearnKeyPlan } from './runs'

export const LEARN_KEY_MODES = ['random', 'fixed'] as const
export type LearnKeyMode = (typeof LEARN_KEY_MODES)[number]

export const LEARN_KEY_CHANGES = ['short', '10', '20', 'never'] as const
export type LearnKeyChange = (typeof LEARN_KEY_CHANGES)[number]

export const ALL_FIFTHS = Array.from({ length: 2 * MAX_FIFTHS + 1 }, (_, index) => index - MAX_FIFTHS)

const RUN_LENGTHS: Record<Exclude<LearnKeyChange, 'never'>, 'short' | number> = { short: 'short', '10': 10, '20': 20 }

export interface LearnKeySettings {
  learnKeyMode: LearnKeyMode
  learnFixedFifths: number
  learnKeyChange: LearnKeyChange
}

/** The plan a session plays: "never" draws its one signature now. */
export function learnKeyPlan(
  settings: LearnKeySettings,
  random: () => number = Math.random,
  maxFifths: number = MAX_FIFTHS,
): LearnKeyPlan {
  if (settings.learnKeyMode === 'fixed') return { mode: 'fixed', fifths: settings.learnFixedFifths }
  if (settings.learnKeyChange === 'never') {
    return { mode: 'fixed', fifths: maxFifths < MAX_FIFTHS ? pickCappedSignature(maxFifths, random) : randomKey(random) }
  }
  return { mode: 'random', runLength: RUN_LENGTHS[settings.learnKeyChange] }
}

export function learnKeyChipLabel(plan: LearnKeyPlan): string {
  return plan.mode === 'fixed' ? signatureLabel(plan.fifths) : t('learn.keyMode.random')
}
