import { describe, expect, it } from 'vitest'
import { parseSurvivalChallenge } from '../survival/challenge'
import { parseChallenge } from '../series/challenge'
import { parseDailyHash } from '../series/daily'
import { parseScoreHash } from '../scores/link'
import {
  challengeClef,
  describeGap,
  encodeHeroChallenge,
  heroChallengeUrl,
  heroChallengeWon,
  heroShareText,
  limitedSource,
  parseHeroChallenge,
  successPercent,
  type HeroChallenge,
} from './challenge'
import { generatedSource, type NoteSource } from './sources'

const challenge: HeroChallenge = {
  config: { seed: 1234, clefs: ['treble', 'bass'], armures: true, bpm: 72, difficulty: 3, bars: 16, level: 100 },
  target: { percent: 87, score: 1240 },
}

describe('encoding', () => {
  it('writes every field', () => {
    expect(encodeHeroChallenge(challenge)).toBe('h=1234&c=sol-fa&k=1&b=72&d=3&m=16&p=87&s=1240')
  })

  it('omits the sender result when there is none', () => {
    expect(encodeHeroChallenge({ ...challenge, target: null })).toBe('h=1234&c=sol-fa&k=1&b=72&d=3&m=16')
  })

  it('round-trips with and without a result', () => {
    expect(parseHeroChallenge(encodeHeroChallenge(challenge))).toEqual(challenge)
    const bare = { ...challenge, target: null }
    expect(parseHeroChallenge(`#${encodeHeroChallenge(bare)}`)).toEqual(bare)
  })

  it('builds the url from a base', () => {
    expect(heroChallengeUrl('https://x.test/solfege/', challenge)).toBe(`https://x.test/solfege/#${encodeHeroChallenge(challenge)}`)
  })
})

describe('parseHeroChallenge', () => {
  const valid = 'h=1234&c=sol&k=0&b=72&d=3&m=16'

  it('reads armures off', () => {
    expect(parseHeroChallenge(valid)?.config.armures).toBe(false)
  })

  it.each([
    ['no seed', 'c=sol&k=0&b=72&d=3&m=16'],
    ['bad seed', 'h=abc&c=sol&k=0&b=72&d=3&m=16'],
    ['no clef', 'h=1234&c=&k=0&b=72&d=3&m=16'],
    ['tempo too low', 'h=1234&c=sol&k=0&b=10&d=3&m=16'],
    ['tempo too high', 'h=1234&c=sol&k=0&b=300&d=3&m=16'],
    ['difficulty 0', 'h=1234&c=sol&k=0&b=72&d=0&m=16'],
    ['difficulty 6', 'h=1234&c=sol&k=0&b=72&d=6&m=16'],
    ['no bars', 'h=1234&c=sol&k=0&b=72&d=3'],
    ['too many bars', 'h=1234&c=sol&k=0&b=72&d=3&m=500'],
    ['percent without score', `${valid}&p=80`],
    ['score without percent', `${valid}&s=80`],
    ['percent over 100', `${valid}&p=101&s=10`],
    ['decimal percent', `${valid}&p=8.5&s=10`],
    ['negative score', `${valid}&p=80&s=-3`],
  ])('rejects %s', (_, hash) => {
    expect(parseHeroChallenge(hash)).toBeNull()
  })
})

describe('links of other modes', () => {
  const hero = encodeHeroChallenge(challenge)
  const series = 's=4821&c=sol-fa&k=1&t=47'
  const survival = 'v=4821&c=sol&k=1&d=5&n=12'

  it('a hero link is not taken for Séries, Survie, daily or a score', () => {
    expect(parseChallenge(hero)).toBeNull()
    expect(parseSurvivalChallenge(hero)).toBeNull()
    expect(parseDailyHash(hero)).toBeNull()
    expect(parseScoreHash(hero)).toBeNull()
  })

  it('a hero link carrying a Survie seed key is still not Survie', () => {
    expect(parseSurvivalChallenge(`${hero}&v=4821&n=3`)).toBeNull()
    expect(parseChallenge(`${hero}&t=47`)).toBeNull()
  })

  it('other links are not taken for hero', () => {
    expect(parseHeroChallenge(series)).toBeNull()
    expect(parseHeroChallenge(survival)).toBeNull()
    expect(parseHeroChallenge('daily=20261024')).toBeNull()
    expect(parseHeroChallenge('score=abc')).toBeNull()
  })
})

describe('successPercent', () => {
  it('rounds the share of hits', () => {
    expect(successPercent(87, 13)).toBe(87)
    expect(successPercent(2, 1)).toBe(67)
    expect(successPercent(0, 5)).toBe(0)
  })

  it('is 0 when nothing was judged', () => {
    expect(successPercent(0, 0)).toBe(0)
  })
})

describe('heroChallengeWon', () => {
  const target = { percent: 80, score: 1000 }

  it('compares the percentage first', () => {
    expect(heroChallengeWon({ percent: 81, score: 10 }, target)).toBe(true)
    expect(heroChallengeWon({ percent: 79, score: 9999 }, target)).toBe(false)
  })

  it('falls back to points on equal percentage', () => {
    expect(heroChallengeWon({ percent: 80, score: 1001 }, target)).toBe(true)
    expect(heroChallengeWon({ percent: 80, score: 999 }, target)).toBe(false)
  })

  it('loses a full tie', () => {
    expect(heroChallengeWon(target, target)).toBe(false)
  })
})

describe('describeGap', () => {
  const target = { percent: 80, score: 1000 }

  it('names the percentage gap, then the points gap', () => {
    expect(describeGap({ percent: 62, score: 5000 }, { percent: 87, score: 1000 })).toBe('62 % contre 87 %')
    expect(describeGap({ percent: 80, score: 990 }, target)).toBe('990 pts contre 1000 pts')
    expect(describeGap(target, target)).toBe('à égalité, il en faut plus')
  })
})

describe('heroShareText', () => {
  const url = 'https://x.test/#h=1234'

  it('lists percentage, points and tempo with non-breaking spaces', () => {
    const text = heroShareText({ config: challenge.config, result: { percent: 87, score: 1240 }, url })
    expect(text).toBe(
      `Solfège hero · Défi hero #1234 · ✅ 87 % · ⭐ 1240 pts · 🎵 72 BPM\nBats-moi : ${url}`,
    )
  })

  it('shares only the settings when there is no result', () => {
    const text = heroShareText({ config: challenge.config, result: null, url })
    expect(text).toBe(`Solfège hero · Défi hero #1234 · 🎵 72 BPM\nRelève le défi : ${url}`)
  })
})

describe('challengeClef', () => {
  it('picks the clef from the seed', () => {
    expect(challengeClef({ seed: 1234, clefs: ['treble', 'bass'] })).toBe('treble')
    expect(challengeClef({ seed: 1235, clefs: ['treble', 'bass'] })).toBe('bass')
  })
})

describe('same melody for the same challenge', () => {
  function playedBars(config: HeroChallenge['config']) {
    const clef = challengeClef(config)
    const { source } = generatedSource(config.seed, { clef, armures: config.armures }, () => config.difficulty)
    const limited = limitedSource(source, config.bars)
    const bars = []
    for (let bar = limited.nextBar(); bar !== null; bar = limited.nextBar()) bars.push(bar)
    return bars
  }

  it('is identical on both phones and exactly 16 bars long', () => {
    const bars = playedBars(challenge.config)
    expect(bars).toHaveLength(16)
    expect(playedBars(challenge.config)).toEqual(bars)
  })

  it('differs with another seed', () => {
    expect(playedBars({ ...challenge.config, seed: 1235 })).not.toEqual(playedBars(challenge.config))
  })
})

describe('limitedSource', () => {
  function counting(): NoteSource {
    let bar = 0
    return { nextBar: () => [{ pitch: 60 + bar++, duration: 'whole' }] }
  }

  it('ends after exactly the requested number of bars', () => {
    const source = limitedSource(counting(), 3)
    expect(source.nextBar()).toEqual([{ pitch: 60, duration: 'whole' }])
    expect(source.nextBar()).toEqual([{ pitch: 61, duration: 'whole' }])
    expect(source.nextBar()).toEqual([{ pitch: 62, duration: 'whole' }])
    expect(source.nextBar()).toBeNull()
    expect(source.nextBar()).toBeNull()
  })
})
