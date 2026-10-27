import { t } from '../i18n'
import { tierName } from '../level/level'
import { button } from './dom'

/** Small chip showing the player level; tapping it opens the settings. */
export function levelPill(level: number, onOpenSettings: () => void): HTMLElement {
  const params = { level, tier: tierName(level) }
  const pill = button('level-pill', t('level.pill.label', params), onOpenSettings)
  pill.setAttribute('aria-label', t('level.pill.aria', params))
  return pill
}
