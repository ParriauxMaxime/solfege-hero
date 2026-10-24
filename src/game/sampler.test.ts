import { describe, expect, it } from 'vitest'
import { isNatural, pitchClass } from '../music/notes'
import { seededRandom } from '../testing/seededRandom'
import {
  accuracy,
  buildPool,
  noteWeight,
  pickPrompt,
  promptId,
  recordAnswer,
  type NoteRecord,
  type NoteStats,
  type Prompt,
} from './sampler'

describe('promptId', () => {
  it('joins clef and MIDI pitch', () => {
    expect(promptId({ clef: 'treble', pitch: 61 })).toBe('treble:61')
  })
})

describe('buildPool', () => {
  it('covers every selected clef', () => {
    const pool = buildPool(['treble', 'bass'], false)
    expect(pool.filter((prompt) => prompt.clef === 'treble')).toHaveLength(17)
    expect(pool.some((prompt) => prompt.clef === 'bass')).toBe(true)
    expect(pool.some((prompt) => prompt.clef === 'alto')).toBe(false)
  })

  it('only holds naturals unless accidentals are on', () => {
    expect(buildPool(['treble'], false).every((prompt) => isNatural(prompt.pitch))).toBe(true)
    expect(buildPool(['treble'], true)).toHaveLength(28)
  })
})

describe('recordAnswer', () => {
  it('starts a record from the first answer', () => {
    expect(recordAnswer({}, 'a', true, 800)).toEqual({
      a: { attempts: 1, correct: 1, misses: 0, avgMs: 800 },
    })
  })

  it('counts misses and lets correct answers recover half a miss', () => {
    let stats: NoteStats = {}
    stats = recordAnswer(stats, 'a', false, 1000)
    stats = recordAnswer(stats, 'a', false, 1000)
    expect(stats.a?.misses).toBe(2)
    stats = recordAnswer(stats, 'a', true, 1000)
    expect(stats.a).toMatchObject({ attempts: 3, correct: 1, misses: 1.5 })
  })

  it('never lets misses go below zero', () => {
    expect(recordAnswer({}, 'a', true, 500).a?.misses).toBe(0)
  })

  it('smooths the average time with alpha 0.3', () => {
    const stats = recordAnswer(recordAnswer({}, 'a', true, 1000), 'a', false, 2000)
    expect(stats.a?.avgMs).toBeCloseTo(1300)
  })

  it('returns a new object and leaves the input untouched', () => {
    const stats: NoteStats = {}
    const next = recordAnswer(stats, 'a', true, 100)
    expect(next).not.toBe(stats)
    expect(stats).toEqual({})
  })
})

describe('noteWeight', () => {
  const record = (overrides: Partial<NoteRecord>): NoteRecord => ({
    attempts: 1,
    correct: 1,
    misses: 0,
    avgMs: 1000,
    ...overrides,
  })

  it('weighs unseen and fast clean notes as 1', () => {
    expect(noteWeight(undefined)).toBe(1)
    expect(noteWeight(record({}))).toBe(1)
  })

  it('adds two per miss', () => {
    expect(noteWeight(record({ misses: 3 }))).toBe(7)
  })

  it('adds slowness past 1.5 s, capped at 3', () => {
    expect(noteWeight(record({ avgMs: 2500 }))).toBe(2)
    expect(noteWeight(record({ avgMs: 60000 }))).toBe(4)
  })
})

describe('accuracy', () => {
  it('is null without attempts and a ratio otherwise', () => {
    expect(accuracy(undefined)).toBeNull()
    expect(accuracy({ attempts: 0, correct: 0, misses: 0, avgMs: 0 })).toBeNull()
    expect(accuracy({ attempts: 4, correct: 3, misses: 1, avgMs: 900 })).toBe(0.75)
  })
})

describe('pickPrompt', () => {
  const pool: Prompt[] = [
    { clef: 'treble', pitch: 60 },
    { clef: 'treble', pitch: 62 },
    { clef: 'treble', pitch: 64 },
  ]

  it('throws on an empty pool', () => {
    expect(() => pickPrompt([], {}, null)).toThrow()
  })

  it('never repeats the previous prompt when others exist', () => {
    const random = seededRandom(1)
    for (let i = 0; i < 200; i++) {
      expect(promptId(pickPrompt(pool, {}, 'treble:62', random))).not.toBe('treble:62')
    }
  })

  it('returns the only prompt of a single-entry pool even if it repeats', () => {
    const only = pool[0] as Prompt
    expect(pickPrompt([only], {}, promptId(only))).toBe(only)
  })

  it('picks a heavily missed note far more often', () => {
    const stats: NoteStats = {
      'treble:64': { attempts: 10, correct: 2, misses: 8, avgMs: 3000 },
    }
    const random = seededRandom(42)
    const counts: Record<string, number> = {}
    for (let i = 0; i < 2000; i++) {
      const id = promptId(pickPrompt(pool, stats, null, random))
      counts[id] = (counts[id] ?? 0) + 1
    }
    expect(counts['treble:64']).toBeGreaterThan(3 * (counts['treble:60'] ?? 0))
  })

  it('draws altered pitch classes about 5/12 of the time when accidentals are on', () => {
    const accidentalPool = buildPool(['treble'], true)
    const random = seededRandom(7)
    const draws = 6000
    let altered = 0
    for (let i = 0; i < draws; i++) {
      if (!isNatural(pickPrompt(accidentalPool, {}, null, random).pitch)) altered++
    }
    expect(altered / draws).toBeCloseTo(5 / 12, 1)
  })

  it('weighs every pitch class equally across octaves', () => {
    const accidentalPool = buildPool(['treble'], true)
    const random = seededRandom(11)
    const counts = new Map<number, number>()
    const draws = 12000
    for (let i = 0; i < draws; i++) {
      const pc = pitchClass(pickPrompt(accidentalPool, {}, null, random).pitch)
      counts.set(pc, (counts.get(pc) ?? 0) + 1)
    }
    for (let pc = 0; pc < 12; pc++) {
      expect((counts.get(pc) ?? 0) / draws).toBeCloseTo(1 / 12, 1)
    }
  })
})
