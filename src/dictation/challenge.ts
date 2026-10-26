import { clampLevel, parseLevelParam } from '../level/level'
import { encodeClefs, parseClefs, parseTimeS } from '../series/challenge'
import { landingUrl } from '../share/links'
import type { DictationConfig } from './sequence'

export interface DictationChallenge {
  config: DictationConfig
  timeS: number | null
}

const WHOLE_NUMBER = /^\d+$/
/** Parameters of the other links (Séries `s`, hero `h`, Survie `v` and `n`, score, daily): any of them means it is not a dictation. */
const FOREIGN_PARAMS = ['s', 'h', 'v', 'n', 'score', 'daily']

/** `d=<seed>&c=<clef>&l=<level>`, plus `k=0` without armures and `t=<seconds>` for a time to beat. */
export function encodeDictationChallenge({ config, timeS }: DictationChallenge): string {
  const params = new URLSearchParams({
    d: String(config.seed),
    c: encodeClefs([config.clef]),
    l: String(clampLevel(config.level)),
  })
  if (!config.armures) params.set('k', '0')
  if (timeS !== null) params.set('t', String(Math.round(timeS * 10) / 10))
  return params.toString()
}

/** Séries links also carry `d=` (their difficulty) but always an `s=`; a dictation link has `d=<seed>` and no `s`. */
export function parseDictationChallenge(hash: string): DictationChallenge | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  if (FOREIGN_PARAMS.some((name) => params.has(name))) return null

  const seed = params.get('d') ?? ''
  const clefs = parseClefs(params.get('c') ?? '')
  const [clef] = clefs
  if (!WHOLE_NUMBER.test(seed) || clefs.length !== 1 || !clef) return null

  return {
    config: { seed: Number(seed), clef, level: parseLevelParam(params.get('l')), armures: params.get('k') !== '0' },
    timeS: parseTimeS(params.get('t') ?? ''),
  }
}

export function dictationChallengeUrl(base: string, challenge: DictationChallenge): string {
  return landingUrl(base, 'dictee', encodeDictationChallenge(challenge))
}
