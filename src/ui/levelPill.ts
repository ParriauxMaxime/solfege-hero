import { tierName } from '../level/level'
import { button } from './dom'

/** Small chip showing the player level; tapping it opens the settings. */
export function levelPill(level: number, onOpenSettings: () => void): HTMLElement {
  const pill = button('level-pill', `Niveau ${level} · ${tierName(level)}`, onOpenSettings)
  pill.setAttribute('aria-label', `Niveau ${level}, ${tierName(level)}. Régler`)
  return pill
}
