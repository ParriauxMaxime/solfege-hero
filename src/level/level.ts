import { t } from '../i18n'
import type { Difficulty } from '../music/generator'
import { ledgerStepRange } from '../music/notes'
import type { SurvivalDelay } from '../survival/game'

export { ledgerStepRange }

export const MAX_LEVEL = 100
export const ALL_KEYS_FIFTHS = 7

export interface LevelCaps {
  maxFifths: number
  ledgerLines: number
  inlineAccidentals: boolean
  heroMaxDifficulty: Difficulty
  heroTempoCap: number
  survivalDefaultDelay: SurvivalDelay
}

export type NoteCaps = Pick<LevelCaps, 'maxFifths' | 'ledgerLines' | 'inlineAccidentals'>

export function clampLevel(n: number): number {
  return Math.min(MAX_LEVEL, Math.max(0, Math.round(n)))
}

const LEVEL_PARAM = /^\d{1,3}$/

/** The level of a link parameter: an integer 0 to 100, else 100 (links without a level are uncapped). */
export function parseLevelParam(text: string | null): number {
  if (text === null || !LEVEL_PARAM.test(text)) return MAX_LEVEL
  const level = Number(text)
  return level <= MAX_LEVEL ? level : MAX_LEVEL
}

export function isUncapped(level: number): boolean {
  return level >= MAX_LEVEL
}

function maxFifthsFor(level: number): number {
  if (level < 20) return 0
  if (level < 40) return 1
  if (level < 60) return 2
  if (level < 80) return 4
  if (level < 100) return 6
  return ALL_KEYS_FIFTHS
}

function ledgerLinesFor(level: number): number {
  if (level < 35) return 0
  return level < 70 ? 1 : 2
}

export function capsFor(level: number): LevelCaps {
  return {
    maxFifths: maxFifthsFor(level),
    ledgerLines: ledgerLinesFor(level),
    inlineAccidentals: level >= 30,
    heroMaxDifficulty: Math.min(5, 1 + Math.floor(level / 25)) as Difficulty,
    heroTempoCap: 60 + Math.round(1.4 * level),
    survivalDefaultDelay: level < 50 ? 5 : 3,
  }
}

export function tierName(level: number): string {
  if (level < 25) return t('level.tier.beginner')
  if (level < 50) return t('level.tier.apprentice')
  if (level < 75) return t('level.tier.reader')
  return t('level.tier.virtuoso')
}

function describeKeys(maxFifths: number): string {
  if (maxFifths === 0) return t('level.caps.noKeys')
  if (maxFifths >= ALL_KEYS_FIFTHS) return t('level.caps.allKeys')
  return t('level.caps.keysUpTo', { count: maxFifths })
}

function describeLedgerLines(ledgerLines: number): string {
  if (ledgerLines === 0) return t('level.caps.noLedger')
  return t('level.caps.ledger', { count: ledgerLines })
}

export function describeCaps(caps: NoteCaps): string {
  return [
    describeKeys(caps.maxFifths),
    describeLedgerLines(caps.ledgerLines),
    caps.inlineAccidentals ? t('level.caps.accidentals') : t('level.caps.noAccidentals'),
  ].join(' · ')
}

const NEAR_CAP_BONUS = 2

/** Keys near the cap weigh most: the cap itself 3, one below 2, the rest 1. */
export function signatureWeight(fifths: number, maxFifths: number): number {
  const distance = Math.abs(fifths)
  if (distance > maxFifths) return 0
  return 1 + Math.max(0, NEAR_CAP_BONUS - (maxFifths - distance))
}

/** One `random()` call; avoids `exclude` unless it is the only signature left. */
export function pickCappedSignature(maxFifths: number, random: () => number, exclude: number | null = null): number {
  const all = Array.from({ length: 2 * maxFifths + 1 }, (_, index) => index - maxFifths)
  const others = all.filter((fifths) => fifths !== exclude)
  const candidates = others.length > 0 ? others : all
  const weights = candidates.map((fifths) => signatureWeight(fifths, maxFifths))
  let threshold = random() * weights.reduce((sum, weight) => sum + weight, 0)
  for (const [index, fifths] of candidates.entries()) {
    threshold -= weights[index] as number
    if (threshold < 0) return fifths
  }
  return candidates[candidates.length - 1] as number
}
