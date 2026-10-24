import { CLEFS, type Clef } from '../music/notes'
import type { SeriesConfig } from './series'

export interface Challenge {
  config: SeriesConfig
  timeS: number | null
}

const CLEF_CODES: Record<Clef, string> = { treble: 'sol', bass: 'fa', alto: 'ut' }
const CODE_SEPARATOR = '-'
const WHOLE_NUMBER = /^\d+$/

export function encodeChallenge({ config, timeS }: Challenge): string {
  const clefs = CLEFS.filter((clef) => config.clefs.includes(clef))
    .map((clef) => CLEF_CODES[clef])
    .join(CODE_SEPARATOR)
  const params = new URLSearchParams({
    s: String(config.seed),
    c: clefs,
    k: config.armures ? '1' : '0',
  })
  if (timeS !== null) params.set('t', String(Math.round(timeS)))
  return params.toString()
}

export function parseChallenge(hash: string): Challenge | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const seed = params.get('s') ?? ''
  if (!WHOLE_NUMBER.test(seed)) return null

  const codes = (params.get('c') ?? '').split(CODE_SEPARATOR)
  const clefs = CLEFS.filter((clef) => codes.includes(CLEF_CODES[clef]))
  if (clefs.length === 0) return null

  const time = params.get('t') ?? ''
  return {
    config: { seed: Number(seed), clefs, armures: params.get('k') === '1' },
    timeS: WHOLE_NUMBER.test(time) ? Number(time) : null,
  }
}

export function challengeUrl(base: string, challenge: Challenge): string {
  return `${base}#${encodeChallenge(challenge)}`
}
