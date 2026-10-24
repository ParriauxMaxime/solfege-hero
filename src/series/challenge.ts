import { CLEFS, type Clef } from '../music/notes'
import type { SeriesConfig } from './series'

export interface Challenge {
  config: SeriesConfig
  timeS: number | null
}

const CLEF_CODES: Record<Clef, string> = { treble: 'sol', bass: 'fa', alto: 'ut' }
const CODE_SEPARATOR = '-'
const WHOLE_NUMBER = /^\d+$/
const SECONDS_WITH_TENTH = /^\d+(\.\d)?$/
const MAX_TIME_S = 5999.9
const MS_PER_TENTH = 100

/** Rounds up to a tenth of a second so a sharer never looks faster than they were. */
export function challengeTimeS(totalMs: number): number {
  return Math.ceil(totalMs / MS_PER_TENTH) / 10
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
    config: { seed: Number(seed), clefs, armures: params.get('k') === '1' },
    timeS: parseTimeS(params.get('t') ?? ''),
  }
}

export function challengeUrl(base: string, challenge: Challenge): string {
  return `${base}#${encodeChallenge(challenge)}`
}
