import { MAX_LIVES } from './game'

const HEART_KEPT = '❤️'
const HEART_LOST = '🖤'

export function heartsText(lives: number): string {
  const kept = Math.min(MAX_LIVES, Math.max(0, lives))
  return HEART_KEPT.repeat(kept) + HEART_LOST.repeat(MAX_LIVES - kept)
}

export function noteCount(count: number): string {
  return `${count} note${count > 1 ? 's' : ''}`
}

export function survivalShareText(input: { seed: number; score: number; lives: number; url: string; callToAction?: string }): string {
  return [
    `Solfège hero · Survie #${input.seed} · 🎯 ${noteCount(input.score)} · ${heartsText(input.lives)}`,
    `${input.callToAction ?? 'Bats-moi'} : ${input.url}`,
  ].join('\n')
}
