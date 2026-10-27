import { t } from '../i18n'
import { clampLevel, isUncapped, parseLevelParam } from '../level/level'
import type { Difficulty } from '../music/generator'
import type { Clef } from '../music/notes'
import { encodeClefs, parseClefs } from '../series/challenge'
import { landingUrl } from '../share/links'
import type { NoteSource } from './sources'
import { START_BPM_MAX, START_BPM_MIN } from './tempo'

export const CHALLENGE_BARS = 16

export interface HeroChallengeConfig {
  seed: number
  clefs: Clef[]
  armures: boolean
  bpm: number
  difficulty: Difficulty
  bars: number
  /** Player level capping the notes, 100 when uncapped. */
  level: number
}

export interface HeroResult {
  /** Share of judged notes that were hit, 0 to 100. */
  percent: number
  score: number
}

export interface HeroChallenge {
  config: HeroChallengeConfig
  /** The sender's result, null when the link only carries the settings. */
  target: HeroResult | null
}

const WHOLE_NUMBER = /^\d+$/
const MIN_BARS = 4
const MAX_BARS = 64
const MAX_PERCENT = 100
const MAX_SCORE = 999999
const MIN_DIFFICULTY = 1
const MAX_DIFFICULTY = 5

export function successPercent(hits: number, misses: number): number {
  const judged = hits + misses
  return judged === 0 ? 0 : Math.round((hits / judged) * 100)
}

export function challengeClef(config: Pick<HeroChallengeConfig, 'seed' | 'clefs'>): Clef {
  const clef = config.clefs[config.seed % config.clefs.length]
  if (!clef) throw new Error('A hero challenge needs a clef')
  return clef
}

/** Higher success percentage wins; equal percentages are decided by points; a full tie is lost. */
export function heroChallengeWon(mine: HeroResult, target: HeroResult): boolean {
  if (mine.percent !== target.percent) return mine.percent > target.percent
  return mine.score > target.score
}

export function describeGap(mine: HeroResult, target: HeroResult): string {
  if (mine.percent !== target.percent) return t('hero.gap.percent', { mine: mine.percent, target: target.percent })
  if (mine.score === target.score) return t('hero.gap.tie')
  return t('hero.gap.points', { mine: mine.score, target: target.score })
}

/** The first `bars` bars of `source`, then exhausted. */
export function limitedSource(source: NoteSource, bars: number): NoteSource {
  let given = 0
  return {
    nextBar() {
      if (given >= bars) return null
      given++
      return source.nextBar()
    },
  }
}

export function encodeHeroChallenge({ config, target }: HeroChallenge): string {
  const params = new URLSearchParams({
    h: String(config.seed),
    c: encodeClefs(config.clefs),
    k: config.armures ? '1' : '0',
    b: String(config.bpm),
    d: String(config.difficulty),
    m: String(config.bars),
  })
  if (!isUncapped(config.level)) params.set('l', String(clampLevel(config.level)))
  if (target) {
    params.set('p', String(target.percent))
    params.set('s', String(target.score))
  }
  return params.toString()
}

function parseBounded(text: string | null, min: number, max: number): number | null {
  if (text === null || !WHOLE_NUMBER.test(text)) return null
  const value = Number(text)
  return value >= min && value <= max ? value : null
}

export function parseHeroChallenge(hash: string): HeroChallenge | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const seed = params.get('h') ?? ''
  const clefs = parseClefs(params.get('c') ?? '')
  const bpm = parseBounded(params.get('b'), START_BPM_MIN, START_BPM_MAX)
  const difficulty = parseBounded(params.get('d'), MIN_DIFFICULTY, MAX_DIFFICULTY)
  const bars = parseBounded(params.get('m'), MIN_BARS, MAX_BARS)
  if (!WHOLE_NUMBER.test(seed) || clefs.length === 0 || bpm === null || difficulty === null || bars === null) return null

  const percent = parseBounded(params.get('p'), 0, MAX_PERCENT)
  const score = parseBounded(params.get('s'), 0, MAX_SCORE)
  const hasTarget = params.has('p') || params.has('s')
  if (hasTarget && (percent === null || score === null)) return null

  return {
    config: {
      seed: Number(seed),
      clefs,
      armures: params.get('k') === '1',
      bpm,
      difficulty: difficulty as Difficulty,
      bars,
      level: parseLevelParam(params.get('l')),
    },
    target: percent !== null && score !== null ? { percent, score } : null,
  }
}

export function heroChallengeUrl(base: string, challenge: HeroChallenge): string {
  return landingUrl(base, 'hero', encodeHeroChallenge(challenge))
}

export function heroShareText(input: { config: HeroChallengeConfig; result: HeroResult | null }): string {
  const { config, result } = input
  const seed = String(config.seed)
  if (!result) return t('hero.share.withoutResult', { seed, bpm: config.bpm })
  return t('hero.share.withResult', { seed, bpm: config.bpm, percent: result.percent, score: String(result.score) })
}
