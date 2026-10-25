import { describe, expect, it } from 'vitest'
import { seededRandom } from '../random'
import { ALL_SIGNATURES, createKeysSampler, keyAnswerPitchClass } from './keysSampler'
import { recordAnswer, type NoteStats } from './sampler'

describe('createKeysSampler', () => {
  it('never shows the same signature twice in a row', () => {
    const sampler = createKeysSampler(['treble', 'bass'], 'both', seededRandom(5))
    let previous: number | null = null
    for (let i = 0; i < 2000; i++) {
      const { fifths } = sampler.next({})
      expect(fifths).not.toBe(previous)
      previous = fifths
    }
  })

  it('reaches all 15 signatures, the selected clefs and both questions', () => {
    const sampler = createKeysSampler(['treble', 'alto'], 'both', seededRandom(9))
    const prompts = Array.from({ length: 1000 }, () => sampler.next({}))
    expect(new Set(prompts.map((prompt) => prompt.fifths))).toEqual(new Set(ALL_SIGNATURES))
    expect(new Set(prompts.map((prompt) => prompt.clef))).toEqual(new Set(['treble', 'alto']))
    expect(new Set(prompts.map((prompt) => prompt.ask))).toEqual(new Set(['major', 'minor']))
  })

  it('asks only what the mode says', () => {
    const major = createKeysSampler(['treble'], 'major', seededRandom(1))
    const minor = createKeysSampler(['treble'], 'minor', seededRandom(1))
    for (let i = 0; i < 50; i++) {
      expect(major.next({}).ask).toBe('major')
      expect(minor.next({}).ask).toBe('minor')
    }
  })

  it('favours missed signatures', () => {
    let stats: NoteStats = {}
    for (let i = 0; i < 3; i++) stats = recordAnswer(stats, '4', false, 2000)
    const sampler = createKeysSampler(['treble'], 'major', seededRandom(2))
    const counts = new Map<number, number>()
    for (let i = 0; i < 3000; i++) {
      const { fifths } = sampler.next(stats)
      counts.set(fifths, (counts.get(fifths) ?? 0) + 1)
    }
    expect(counts.get(4)).toBeGreaterThan(2 * (counts.get(-4) ?? 1))
  })

  it('answers with the tonic pitch class of the asked quality', () => {
    expect(keyAnswerPitchClass({ fifths: 1, clef: 'treble', ask: 'major' })).toBe(7)
    expect(keyAnswerPitchClass({ fifths: 1, clef: 'treble', ask: 'minor' })).toBe(4)
  })
})
