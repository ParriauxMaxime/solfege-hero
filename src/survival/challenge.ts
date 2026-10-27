import { MAX_LEVEL, clampLevel, isUncapped, parseLevelParam } from '../level/level'
import type { Clef } from '../music/notes'
import { encodeClefs, parseClefs } from '../series/challenge'
import { landingUrl } from '../share/links'
import { SURVIVAL_DELAYS, type SurvivalDelay } from './game'
import type { SurvivalSequenceConfig } from './sequence'

export interface SurvivalConfig extends SurvivalSequenceConfig {
  delayS: SurvivalDelay
}

export interface SurvivalChallenge {
  config: SurvivalConfig
  /** The sender's score, to beat. */
  score: number
}

const WHOLE_NUMBER = /^\d+$/
const MAX_SCORE = 99999

export function encodeSurvivalChallenge({ config, score }: SurvivalChallenge): string {
  const params = new URLSearchParams({
    v: String(config.seed),
    c: encodeClefs(config.clefs),
    k: config.armures ? '1' : '0',
    d: String(config.delayS),
    n: String(score),
  })
  if (!isUncapped(config.level ?? MAX_LEVEL)) params.set('l', String(clampLevel(config.level as number)))
  return params.toString()
}

/** Series links carry `s=` (and sometimes `v=2`); a Survie link has `v=<seed>` and no `s`. */
export function parseSurvivalChallenge(hash: string): SurvivalChallenge | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  if (params.has('s') || params.has('h')) return null

  const seed = params.get('v') ?? ''
  const score = params.get('n') ?? ''
  const delayS = SURVIVAL_DELAYS.find((delay) => String(delay) === params.get('d'))
  const clefs: Clef[] = parseClefs(params.get('c') ?? '')
  if (!WHOLE_NUMBER.test(seed) || !WHOLE_NUMBER.test(score) || delayS === undefined || clefs.length === 0) return null
  if (Number(score) > MAX_SCORE) return null

  const level = parseLevelParam(params.get('l'))
  return {
    config: {
      seed: Number(seed),
      clefs,
      armures: params.get('k') === '1',
      delayS,
      ...(isUncapped(level) ? {} : { level }),
    },
    score: Number(score),
  }
}

export function survivalChallengeUrl(base: string, challenge: SurvivalChallenge): string {
  return landingUrl(base, 'survival', encodeSurvivalChallenge(challenge))
}

/** Strictly more notes than the friend. */
export function survivalWon(score: number, friendScore: number): boolean {
  return score > friendScore
}
