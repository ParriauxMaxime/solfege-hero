import { CLEFS, type Clef } from '../music/notes'
import type { RandomSeriesConfig } from './series'
import { ceilToTenth } from './share'

export interface Challenge {
  config: RandomSeriesConfig
  timeS: number | null
}

const CLEF_CODES: Record<Clef, string> = { treble: 'sol', bass: 'fa', alto: 'ut' }
const CODE_SEPARATOR = '-'
const WHOLE_NUMBER = /^\d+$/
const SECONDS_WITH_TENTH = /^\d+(\.\d)?$/
const MAX_TIME_S = 5999.9
const MS_PER_SECOND = 1000

export function challengeTimeS(totalMs: number): number {
  return ceilToTenth(totalMs) / MS_PER_SECOND
}

export function challengeWon(totalMs: number, timeS: number): boolean {
  return totalMs <= timeS * 1000
}

function parseTimeS(text: string): number | null {
  if (!SECONDS_WITH_TENTH.test(text)) return null
  const timeS = Number(text)
  return timeS > 0 && timeS <= MAX_TIME_S ? timeS : null
}

export function encodeChallenge({ config, timeS }: Challenge): string {
  const clefs = CLEFS.filter((clef) => config.clefs.includes(clef))
    .map((clef) => CLEF_CODES[clef])
    .join(CODE_SEPARATOR)
  const params = new URLSearchParams({
    s: String(config.seed),
    c: clefs,
    k: config.armures ? '1' : '0',
  })
  if (config.version === 2) params.set('v', '2')
  if (timeS !== null) params.set('t', String(Math.round(timeS * 10) / 10))
  return params.toString()
}

export function parseChallenge(hash: string): Challenge | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const seed = params.get('s') ?? ''
  if (!WHOLE_NUMBER.test(seed)) return null

  const codes = (params.get('c') ?? '').split(CODE_SEPARATOR)
  const clefs = CLEFS.filter((clef) => codes.includes(CLEF_CODES[clef]))
  if (clefs.length === 0) return null

  return {
    config: {
      kind: 'random',
      version: params.get('v') === '2' ? 2 : 1,
      seed: Number(seed),
      clefs,
      armures: params.get('k') === '1',
    },
    timeS: parseTimeS(params.get('t') ?? ''),
  }
}

export function challengeUrl(base: string, challenge: Challenge): string {
  return `${base}#${encodeChallenge(challenge)}`
}
