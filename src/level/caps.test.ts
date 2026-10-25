import { describe, expect, it } from 'vitest'
import { createKeysSampler } from '../game/keysSampler'
import { learnKeyPlan } from '../game/learnKey'
import { createLearnSampler, writeInKey } from '../game/runs'
import { buildPool } from '../game/sampler'
import { INITIAL_DIFFICULTY, onJudgement } from '../hero/difficulty'
import { encodeHeroChallenge, parseHeroChallenge, type HeroChallenge } from '../hero/challenge'
import { generatedSource } from '../hero/sources'
import { generateMelody } from '../music/generator'
import { CLEFS, midi, staffStep, type Clef } from '../music/notes'
import { seededRandom } from '../random'
import { encodeChallenge, parseChallenge, type Challenge } from '../series/challenge'
import { DAILY_LEVEL, dailyConfig } from '../series/daily'
import { generateSeries, type RandomSeriesConfig, type SeriesItem } from '../series/series'
import { encodeSurvivalChallenge, parseSurvivalChallenge, type SurvivalChallenge } from '../survival/challenge'
import { createSurvivalSequence } from '../survival/sequence'
import { capsFor } from './level'

const SEEDS = Array.from({ length: 100 }, (_, index) => 1000 + index * 37)

function stepOf(item: Pick<SeriesItem, 'note' | 'clef'>): number {
  return staffStep(item.note, item.clef)
}

describe('learn sampler caps', () => {
  const clefs: readonly Clef[] = CLEFS

  it('level 0 writes only natural notes without key signature within the staff', () => {
    const sampler = createLearnSampler(clefs, true, seededRandom(3), undefined, capsFor(0))
    const pool = buildPool(clefs, true)
    for (let i = 0; i < 300; i++) {
      const { fifths, note, prompt } = sampler.next(pool, {})
      expect(fifths).toBe(0)
      expect(note.alter).toBe(0)
      expect(midi(note)).toBe(prompt.pitch)
      expect(staffStep(note, prompt.clef)).toBeGreaterThanOrEqual(-1)
      expect(staffStep(note, prompt.clef)).toBeLessThanOrEqual(9)
    }
  })

  it('level 0 stays natural when key signatures are off too', () => {
    const sampler = createLearnSampler(clefs, false, seededRandom(4), undefined, capsFor(0))
    const pool = buildPool(clefs, true)
    for (let i = 0; i < 300; i++) {
      const { note, prompt } = sampler.next(pool, {})
      expect(note.alter).toBe(0)
      expect(staffStep(note, prompt.clef)).toBeGreaterThanOrEqual(-1)
      expect(staffStep(note, prompt.clef)).toBeLessThanOrEqual(9)
    }
  })

  it('level 20 draws signatures within one sharp or flat', () => {
    const sampler = createLearnSampler(clefs, true, seededRandom(5), undefined, capsFor(20))
    const pool = buildPool(clefs, true)
    const seen = new Set<number>()
    for (let i = 0; i < 400; i++) {
      const { fifths, note, prompt } = sampler.next(pool, {})
      seen.add(fifths)
      expect(Math.abs(fifths)).toBeLessThanOrEqual(1)
      expect(writeInKey(prompt.pitch, prompt.clef, fifths, 0)).toEqual(note)
    }
    expect(seen).toEqual(new Set([-1, 0, 1]))
  })

  it('a fixed plan overrides the key cap', () => {
    const sampler = createLearnSampler(clefs, true, seededRandom(6), { mode: 'fixed', fifths: 5 }, capsFor(0))
    const pool = buildPool(clefs, true)
    for (let i = 0; i < 50; i++) expect(sampler.next(pool, {}).fifths).toBe(5)
  })

  it('the never-change plan respects the cap', () => {
    const settings = { learnKeyMode: 'random', learnFixedFifths: 0, learnKeyChange: 'never' } as const
    for (let seed = 1; seed < 60; seed++) {
      const plan = learnKeyPlan(settings, seededRandom(seed), 2)
      expect(plan.mode === 'fixed' && Math.abs(plan.fifths) <= 2).toBe(true)
    }
  })

  it('level 100 caps behave like no caps', () => {
    const pool = buildPool(clefs, true)
    const plain = createLearnSampler(clefs, true, seededRandom(8))
    const capped = createLearnSampler(clefs, true, seededRandom(8), undefined, capsFor(100))
    for (let i = 0; i < 300; i++) expect(capped.next(pool, {})).toEqual(plain.next(pool, {}))
  })
})

describe('keys sampler cap', () => {
  it('limits signatures and never repeats one', () => {
    const sampler = createKeysSampler(['treble'], 'major', seededRandom(2), 2)
    let previous: number | null = null
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) {
      const { fifths } = sampler.next({})
      expect(Math.abs(fifths)).toBeLessThanOrEqual(2)
      expect(fifths).not.toBe(previous)
      seen.add(fifths)
      previous = fifths
    }
    expect(seen).toEqual(new Set([-2, -1, 0, 1, 2]))
  })

  it('keeps at least three signatures at cap 0', () => {
    const sampler = createKeysSampler(['treble'], 'major', seededRandom(2), 0)
    const seen = new Set(Array.from({ length: 200 }, () => sampler.next({}).fifths))
    expect(seen).toEqual(new Set([-1, 0, 1]))
  })
})

describe('generator caps', () => {
  it('level 0 melodies use key 0, no ledger line and no chromatic note', () => {
    const caps = capsFor(0)
    for (const seed of Array.from({ length: 50 }, (_, index) => 2000 + index)) {
      for (const clef of CLEFS) {
        const melody = generateMelody(seed, { clef, armures: true, difficulty: 5, bars: 16, caps })
        expect(melody.key).toBe(0)
        for (const note of melody.notes) {
          if (note.pitch === null) continue
          expect(writeInKey(note.pitch, clef, 0, 0)).not.toBeNull()
        }
      }
    }
  })

  it('level 100 caps give the same melody as no caps', () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const options = { clef: 'treble', armures: true, difficulty: 4, bars: 16 } as const
      expect(generateMelody(seed, { ...options, caps: capsFor(100) })).toEqual(generateMelody(seed, options))
    }
  })

  it('keeps the drawn key within the cap', () => {
    for (const seed of SEEDS) {
      const { key } = generateMelody(seed, { clef: 'treble', armures: true, difficulty: 2, caps: capsFor(25) })
      expect(Math.abs(key)).toBeLessThanOrEqual(1)
    }
  })
})

describe('series version 4', () => {
  const base = (seed: number, clefs: Clef[], level?: number): RandomSeriesConfig => ({
    kind: 'random',
    version: 4,
    seed,
    clefs,
    armures: true,
    difficulty: 3,
    level,
  })

  it('is deterministic per seed and level, and differs between levels', () => {
    expect(generateSeries(base(4821, ['treble', 'bass'], 30))).toEqual(generateSeries(base(4821, ['treble', 'bass'], 30)))
    const differs = SEEDS.some(
      (seed) => JSON.stringify(generateSeries(base(seed, ['treble'], 0))) !== JSON.stringify(generateSeries(base(seed, ['treble'], 100))),
    )
    expect(differs).toBe(true)
  })

  it('level 0 writes natural notes in key 0 within the staff, whatever the clef', () => {
    for (const seed of SEEDS) {
      for (const items of [generateSeries(base(seed, ['treble'], 0)), generateSeries(base(seed, [...CLEFS], 0))]) {
        for (const item of items) {
          expect(item.fifths).toBe(0)
          expect(item.note.alter).toBe(0)
          expect(stepOf(item)).toBeGreaterThanOrEqual(-1)
          expect(stepOf(item)).toBeLessThanOrEqual(9)
          expect(midi(item.note)).toBe(item.pitch)
        }
      }
    }
  })

  it('level 20 keeps the signatures within one accidental and no inline accidental', () => {
    for (const seed of SEEDS) {
      for (const item of generateSeries(base(seed, [...CLEFS], 20))) {
        expect(Math.abs(item.fifths)).toBeLessThanOrEqual(1)
        expect(writeInKey(item.pitch, item.clef, item.fifths, 0)).toEqual(item.note)
      }
    }
  })

  it('level 100 equals version 3, and so does a missing level', () => {
    for (const seed of SEEDS) {
      const v3: RandomSeriesConfig = { ...base(seed, ['treble', 'bass', 'alto']), version: 3, level: undefined }
      expect(generateSeries(base(seed, ['treble', 'bass', 'alto'], 100))).toEqual(generateSeries(v3))
      expect(generateSeries(base(seed, ['treble', 'bass', 'alto']))).toEqual(generateSeries(v3))
    }
  })
})

describe('series links with a level', () => {
  const challenge: Challenge = {
    config: { kind: 'random', version: 4, seed: 4821, clefs: ['treble', 'bass'], armures: true, difficulty: 2, level: 45 },
    timeS: 47,
  }

  it('round-trips the level', () => {
    expect(encodeChallenge(challenge)).toBe('s=4821&c=sol-fa&k=1&v=4&l=45&t=47')
    expect(parseChallenge(encodeChallenge(challenge))).toEqual(challenge)
  })

  it('defaults a missing or invalid level to 100', () => {
    expect(parseChallenge('s=4821&c=sol&k=1&v=4')?.config.level).toBe(100)
    expect(parseChallenge('s=4821&c=sol&k=1&v=4&l=abc')?.config.level).toBe(100)
    expect(parseChallenge('s=4821&c=sol&k=1&v=4&l=101')?.config.level).toBe(100)
  })

  it('still reads a version 3 link as version 3 without a level', () => {
    const parsed = parseChallenge('s=4821&c=sol&k=1&v=3&t=47')
    expect(parsed?.config.version).toBe(3)
    expect(parsed?.config).not.toHaveProperty('level')
  })
})

describe('daily', () => {
  it('is version 4 at level 50 for every call', () => {
    expect(dailyConfig('20261024')).toMatchObject({ version: 4, level: DAILY_LEVEL })
    expect(dailyConfig('20261024')).toEqual(dailyConfig('20261024'))
    expect(DAILY_LEVEL).toBe(50)
  })
})

describe('survival with a level', () => {
  const challenge: SurvivalChallenge = {
    config: { seed: 1234, clefs: ['treble', 'bass'], armures: true, delayS: 5, level: 30 },
    score: 12,
  }

  it('round-trips the level and omits it at 100', () => {
    expect(encodeSurvivalChallenge(challenge)).toBe('v=1234&c=sol-fa&k=1&d=5&n=12&l=30')
    expect(parseSurvivalChallenge(encodeSurvivalChallenge(challenge))).toEqual(challenge)
    const uncapped = { ...challenge, config: { ...challenge.config, level: 100 } }
    expect(encodeSurvivalChallenge(uncapped)).not.toContain('l=')
    expect(parseSurvivalChallenge('v=1234&c=sol&k=1&d=3&n=47')?.config.level ?? 100).toBe(100)
  })

  it('generates capped blocks', () => {
    const sequence = createSurvivalSequence({ seed: 77, clefs: ['treble'], armures: true, level: 0 })
    for (let index = 0; index < 60; index++) {
      const item = sequence.noteAt(index)
      expect(item.fifths).toBe(0)
      expect(stepOf(item)).toBeGreaterThanOrEqual(-1)
      expect(stepOf(item)).toBeLessThanOrEqual(9)
    }
  })

  it('level 100 is the uncapped sequence', () => {
    const capped = createSurvivalSequence({ seed: 77, clefs: ['treble'], armures: true, level: 100 })
    const plain = createSurvivalSequence({ seed: 77, clefs: ['treble'], armures: true })
    for (let index = 0; index < 60; index++) expect(capped.noteAt(index)).toEqual(plain.noteAt(index))
  })
})

describe('hero with a level', () => {
  const challenge: HeroChallenge = {
    config: { seed: 1234, clefs: ['treble'], armures: true, bpm: 72, difficulty: 3, bars: 16, level: 40 },
    target: null,
  }

  it('round-trips the level and reads an old link as 100', () => {
    expect(encodeHeroChallenge(challenge)).toContain('l=40')
    expect(parseHeroChallenge(encodeHeroChallenge(challenge))).toEqual(challenge)
    expect(parseHeroChallenge('h=1234&c=sol&k=1&b=72&d=3&m=16')?.config.level).toBe(100)
    expect(encodeHeroChallenge({ ...challenge, config: { ...challenge.config, level: 100 } })).not.toContain('l=')
  })

  it('passes caps to the generated source', () => {
    const { key, source } = generatedSource(9, { clef: 'treble', armures: true, caps: capsFor(0) }, () => 3)
    expect(key).toBe(0)
    for (let i = 0; i < 20; i++) {
      for (const spec of source.nextBar() ?? []) {
        if (spec.pitch !== null) expect(writeInKey(spec.pitch, 'treble', 0, 0)).not.toBeNull()
      }
    }
  })
})

describe('onJudgement cap', () => {
  it('never rises above the max level', () => {
    let state = INITIAL_DIFFICULTY
    for (let i = 0; i < 200; i++) state = onJudgement(state, true, 0, 2)
    expect(state.level).toBe(2)
    for (let i = 0; i < 200; i++) state = onJudgement(state, true, 0)
    expect(state.level).toBe(5)
  })
})
