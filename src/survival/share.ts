import { t } from '../i18n'
import { MAX_LIVES } from './game'

const HEART_KEPT = '❤️'
const HEART_LOST = '🖤'

export function heartsText(lives: number): string {
  const kept = Math.min(MAX_LIVES, Math.max(0, lives))
  return HEART_KEPT.repeat(kept) + HEART_LOST.repeat(MAX_LIVES - kept)
}

export function noteCount(count: number): string {
  return t('survival.notes', { count })
}

export function survivalShareText(input: { seed: number; score: number; lives: number; callToAction?: string }): string {
  return [
    t('share.survivalLine', { seed: String(input.seed), notes: noteCount(input.score), hearts: heartsText(input.lives) }),
    input.callToAction ?? t('share.cta'),
  ].join('\n')
}
