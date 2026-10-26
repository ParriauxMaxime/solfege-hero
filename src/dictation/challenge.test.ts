import { describe, expect, it } from 'vitest'
import { parseHeroChallenge, encodeHeroChallenge } from '../hero/challenge'
import { encodeChallenge, parseChallenge } from '../series/challenge'
import { encodeDailyHash, parseDailyHash } from '../series/daily'
import { encodeSurvivalChallenge, parseSurvivalChallenge } from '../survival/challenge'
import {
  dictationChallengeUrl,
  encodeDictationChallenge,
  parseDictationChallenge,
  type DictationChallenge,
} from './challenge'

const challenge: DictationChallenge = {
  config: { seed: 4821, clef: 'bass', level: 35, armures: true },
  timeS: 62.4,
}

describe('dictation challenge link', () => {
  it('encodes the seed as d, the clef, the level and the time', () => {
    expect(encodeDictationChallenge(challenge)).toBe('d=4821&c=fa&l=35&t=62.4')
  })

  it('round-trips with and without a time and armures', () => {
    for (const timeS of [62.4, 100, null]) {
      for (const armures of [true, false]) {
        for (const clef of ['treble', 'bass', 'alto'] as const) {
          const original = { config: { seed: 1000, clef, level: 0, armures }, timeS }
          expect(parseDictationChallenge(`#${encodeDictationChallenge(original)}`)).toEqual(original)
        }
      }
    }
  })

  it('reads a link with or without the leading hash', () => {
    expect(parseDictationChallenge('d=4821&c=fa&l=35&t=62.4')).toEqual(challenge)
  })

  it('treats a missing level as uncapped', () => {
    expect(parseDictationChallenge('#d=4821&c=sol')?.config.level).toBe(100)
  })

  it('rejects malformed links', () => {
    expect(parseDictationChallenge('#d=abc&c=sol&l=10')).toBeNull()
    expect(parseDictationChallenge('#d=4821&l=10')).toBeNull()
    expect(parseDictationChallenge('#d=4821&c=sol-fa&l=10')).toBeNull()
    expect(parseDictationChallenge('#c=sol&l=10')).toBeNull()
    expect(parseDictationChallenge('')).toBeNull()
  })

  it('points at the dictee landing page', () => {
    expect(dictationChallengeUrl('https://x.test/app/', challenge)).toBe('https://x.test/app/dictee/#d=4821&c=fa&l=35&t=62.4')
  })

  it('does not take a Séries link, even one with a difficulty d', () => {
    const series = encodeChallenge({
      config: { kind: 'random', version: 4, seed: 4821, clefs: ['treble'], armures: true, difficulty: 3, level: 50 },
      timeS: 41.2,
    })
    expect(series).toContain('d=3')
    expect(parseDictationChallenge(`#${series}`)).toBeNull()
    expect(parseChallenge(`#${series}`)).not.toBeNull()
  })

  it('is not taken for a Séries link', () => {
    expect(parseChallenge(`#${encodeDictationChallenge(challenge)}`)).toBeNull()
  })

  it('does not take Survie, hero or daily links, nor they take it', () => {
    const survival = encodeSurvivalChallenge({
      config: { seed: 4821, clefs: ['treble'], armures: true, delayS: 3 },
      score: 12,
    })
    const hero = encodeHeroChallenge({
      config: { seed: 4821, clefs: ['treble'], armures: true, bpm: 60, difficulty: 2, bars: 16, level: 100 },
      target: null,
    })
    const dictation = encodeDictationChallenge(challenge)
    expect(parseDictationChallenge(`#${survival}`)).toBeNull()
    expect(parseDictationChallenge(`#${hero}`)).toBeNull()
    expect(parseDictationChallenge(`#${encodeDailyHash('20261026')}`)).toBeNull()
    expect(parseSurvivalChallenge(`#${dictation}`)).toBeNull()
    expect(parseHeroChallenge(`#${dictation}`)).toBeNull()
    expect(parseDailyHash(`#${dictation}`)).toBeNull()
  })
})
