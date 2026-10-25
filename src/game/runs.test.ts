import { describe, expect, it } from 'vitest'
import { inlineAccidental } from '../music/keySignature'
import { pitchClass } from '../music/notes'
import { seededRandom } from '../random'
import { createLearnSampler, runLength } from './runs'
import { buildPool } from './sampler'

describe('runLength', () => {
  it('is 4 or 5', () => {
    const random = seededRandom(3)
    const seen = new Set(Array.from({ length: 200 }, () => runLength(random)))
    expect(seen).toEqual(new Set([4, 5]))
  })
})

describe('createLearnSampler', () => {
  it('never repeats a pitch class over 2000 prompts, all clefs and accidentals', () => {
    const clefs = ['treble', 'bass', 'alto'] as const
    const random = seededRandom(7)
    const sampler = createLearnSampler(clefs, true, random)
    const pool = buildPool(clefs, true)
    let previous = -1
    for (let i = 0; i < 2000; i++) {
      const { prompt } = sampler.next(pool, {})
      expect(pitchClass(prompt.pitch)).not.toBe(previous)
      previous = pitchClass(prompt.pitch)
    }
  })

  it('keeps clef and key signature for 4 or 5 prompts', () => {
    const clefs = ['treble', 'bass'] as const
    const sampler = createLearnSampler(clefs, true, seededRandom(11))
    const pool = buildPool(clefs, true)
    const runs: number[] = []
    let current = ''
    let length = 0
    for (let i = 0; i < 400; i++) {
      const { prompt, fifths } = sampler.next(pool, {})
      const header = `${prompt.clef}:${fifths}`
      if (header === current) {
        length++
        continue
      }
      if (length > 0) runs.push(length)
      current = header
      length = 1
    }
    expect(runs.length).toBeGreaterThan(20)
    for (const run of runs) expect(run).toBeGreaterThanOrEqual(4)
  })

  it('writes the note under the shown key signature', () => {
    const sampler = createLearnSampler(['treble'], true, seededRandom(5))
    const pool = buildPool(['treble'], true)
    const fifths = new Set<number>()
    for (let i = 0; i < 300; i++) fifths.add(sampler.next(pool, {}).fifths)
    expect(fifths.size).toBeGreaterThan(3)
  })

  it('flags key changes only at run boundaries', () => {
    const sampler = createLearnSampler(['treble'], true, seededRandom(2))
    const pool = buildPool(['treble'], true)
    let changes = 0
    let previousFifths: number | null = null
    for (let i = 0; i < 200; i++) {
      const { fifths, keyChanged } = sampler.next(pool, {})
      expect(keyChanged).toBe(previousFifths !== null && previousFifths !== fifths)
      if (keyChanged) changes++
      previousFifths = fifths
    }
    expect(changes).toBeGreaterThan(10)
  })

  it('stays in C major without armures', () => {
    const sampler = createLearnSampler(['treble'], false, seededRandom(1))
    const pool = buildPool(['treble'], false)
    for (let i = 0; i < 50; i++) expect(sampler.next(pool, {}).fifths).toBe(0)
  })

  it('fixed mode keeps one key, only diatonic notes, no repeated pitch class', () => {
    const clefs = ['treble', 'bass', 'alto'] as const
    const pool = buildPool(clefs, true)
    for (const fifths of [-7, -3, 0, 4, 7]) {
      const sampler = createLearnSampler(clefs, true, seededRandom(5), { mode: 'fixed', fifths })
      let previous = -1
      for (let i = 0; i < 300; i++) {
        const result = sampler.next(pool, {})
        expect(result.fifths).toBe(fifths)
        expect(result.keyChanged).toBe(false)
        expect(inlineAccidental(result.note, fifths)).toBeNull()
        expect(pitchClass(result.prompt.pitch)).not.toBe(previous)
        previous = pitchClass(result.prompt.pitch)
      }
    }
  })

  it('fixed mode ignores the armures setting', () => {
    const sampler = createLearnSampler(['treble'], false, seededRandom(2), { mode: 'fixed', fifths: 2 })
    const pool = buildPool(['treble'], false)
    expect(sampler.next(pool, {}).fifths).toBe(2)
  })

  it.each([10, 20])('random mode with run length %i changes key every that many prompts while clefs still rotate', (length) => {
    const clefs = ['treble', 'bass'] as const
    const sampler = createLearnSampler(clefs, true, seededRandom(9), { mode: 'random', runLength: length })
    const pool = buildPool(clefs, true)
    const runs: number[] = []
    const seenClefs = new Set<string>()
    let current: number | null = null
    let count = 0
    for (let i = 0; i < length * 8; i++) {
      const { fifths, prompt } = sampler.next(pool, {})
      seenClefs.add(prompt.clef)
      if (fifths === current) count++
      else {
        if (current !== null) runs.push(count)
        current = fifths
        count = 1
      }
    }
    expect(runs.length).toBeGreaterThan(3)
    expect(runs.every((run) => run === length)).toBe(true)
    expect(seenClefs.size).toBe(2)
  })

  it('infinite run length never changes the key', () => {
    const sampler = createLearnSampler(['treble'], true, seededRandom(4), { mode: 'random', runLength: Infinity })
    const pool = buildPool(['treble'], true)
    const first = sampler.next(pool, {}).fifths
    for (let i = 0; i < 100; i++) expect(sampler.next(pool, {}).fifths).toBe(first)
  })
})
