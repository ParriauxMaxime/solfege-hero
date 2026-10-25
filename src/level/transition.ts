import type { Clef } from '../music/notes'
import type { SurvivalDelay } from '../survival/game'
import { capsFor } from './level'

export type ClefTip = 'bass' | 'alto'

export const CLEF_TIP_LEVELS: Record<ClefTip, number> = { bass: 50, alto: 80 }
const CLEF_TIP_ORDER: readonly ClefTip[] = ['bass', 'alto']
const TIP_CLEF: Record<ClefTip, Clef> = { bass: 'bass', alto: 'alto' }

/** The survival delay follows the level default when the default changes; otherwise the player's choice stays. */
export function survivalDelayAfterLevelChange(from: number, to: number, current: SurvivalDelay): SurvivalDelay {
  const next = capsFor(to).survivalDefaultDelay
  return capsFor(from).survivalDefaultDelay === next ? current : next
}

/** The clef worth suggesting after the level rose across its threshold, once and only if not already played. */
export function clefTipAfterLevelChange(
  from: number,
  to: number,
  clefs: readonly Clef[],
  shown: readonly ClefTip[],
): ClefTip | null {
  return (
    CLEF_TIP_ORDER.find((tip) => {
      const threshold = CLEF_TIP_LEVELS[tip]
      return from < threshold && to >= threshold && !shown.includes(tip) && !clefs.includes(TIP_CLEF[tip])
    }) ?? null
  )
}
