import { describe, expect, it } from 'vitest'
import { buildPool } from '../game/sampler'
import type { Score } from '../hero/types'
import { generateMelody } from '../music/generator'
import { midi, pitchClass, type Clef, type Note } from '../music/notes'
import { seededRandom } from '../random'
import {
  INITIAL_RUN,
  PENALTY_MS,
  SERIES_LENGTH,
  answerItem,
  firstTryResults,
  generateSeries,
  newSeed,
  penaltyMs,
  scoreSeries,
  type RandomSeriesConfig,
  type SeriesRun,
} from './series'

const config: RandomSeriesConfig = {
  kind: 'random',
  version: 1,
  seed: 4821,
  clefs: ['treble', 'bass'],
  armures: true,
  difficulty: 2,
}

const V1_GOLDEN_PITCHES = [68, 72, 47, 66, 36, 76, 58, 61, 45, 39, 75, 62, 68, 60, 82, 64, 40, 60, 64, 61]

describe('generateSeries version 2', () => {
  const v2: RandomSeriesConfig = { ...config, version: 2 }

  it('plays the first twenty notes of a generated melody in its key', () => {
    const items = generateSeries(v2)
    const clef = v2.clefs[v2.seed % v2.clefs.length] as Clef
    const melody = generateMelody(v2.seed, { clef, armures: true, difficulty: 2, bars: 16 })
    expect(items).toHaveLength(SERIES_LENGTH)
    expect(items.map((item) => item.pitch)).toEqual(
      melody.notes.slice(0, SERIES_LENGTH).map((spec) => spec.pitch),
    )
    expect(items.every((item) => item.clef === clef && item.fifths === melody.key)).toBe(true)
    for (const item of items) expect(midi(item.note)).toBe(item.pitch)
  })

  it('picks the clef from the seed', () => {
    const clefs = new Set(
      Array.from({ length: 10 }, (_, offset) =>
        generateSeries({ ...v2, seed: 4000 + offset })[0]?.clef,
      ),
    )
    expect(clefs).toEqual(new Set(['treble', 'bass']))
  })

  it('is deterministic and differs from version 1', () => {
    expect(generateSeries(v2)).toEqual(generateSeries({ ...v2 }))
    expect(generateSeries(v2)).not.toEqual(generateSeries(config))
    expect(generateSeries({ ...v2, seed: 4822 })).not.toEqual(generateSeries(v2))
  })

  it('changes with the settings', () => {
    const seeds = Array.from({ length: 20 }, (_, offset) => 4000 + offset)
    const differs = (change: Partial<RandomSeriesConfig>) =>
      seeds.filter(
        (seed) =>
          JSON.stringify(generateSeries({ ...v2, ...change, seed })) !==
          JSON.stringify(generateSeries({ ...v2, seed })),
      ).length
    expect(differs({ armures: false })).toBeGreaterThan(10)
    expect(differs({ clefs: ['treble'] })).toBeGreaterThan(5)
  })

  it('keeps version 1 series exactly as old links produced them', () => {
    expect(generateSeries(config).map((item) => item.pitch)).toEqual(V1_GOLDEN_PITCHES)
  })

  it('fails without any clef', () => {
    expect(() => generateSeries({ ...v2, clefs: [] })).toThrow()
  })
})

describe('newSeed', () => {
  it('draws an integer from 1000 to 9999', () => {
    expect(newSeed(() => 0)).toBe(1000)
    expect(newSeed(() => 0.999999)).toBe(9999)
    const random = seededRandom(1)
    for (let i = 0; i < 200; i++) expect(Number.isInteger(newSeed(random))).toBe(true)
  })
})

describe('generateSeries', () => {
  it('yields twenty items', () => {
    expect(generateSeries(config)).toHaveLength(SERIES_LENGTH)
  })

  it('is deterministic for the same config', () => {
    expect(generateSeries(config)).toEqual(generateSeries({ ...config }))
  })

  it('changes with the seed', () => {
    expect(generateSeries({ ...config, seed: 4822 })).not.toEqual(generateSeries(config))
  })

  it('changes with the settings', () => {
    expect(generateSeries({ ...config, armures: false })).not.toEqual(generateSeries(config))
    expect(generateSeries({ ...config, clefs: ['treble'] })).not.toEqual(generateSeries(config))
  })

  it('only uses pitches of the chosen clefs', () => {
    for (const seed of [1000, 2345, 9999]) {
      for (const armures of [true, false]) {
        const settings: RandomSeriesConfig = { kind: 'random', version: 1, seed, clefs: ['treble', 'alto'], armures, difficulty: 2 }
        const pool = new Set(buildPool(settings.clefs, armures).map((p) => `${p.clef}:${p.pitch}`))
        for (const item of generateSeries(settings)) {
          expect(pool.has(`${item.clef}:${item.pitch}`)).toBe(true)
        }
      }
    }
  })

  it('never repeats the same clef and pitch back to back', () => {
    for (let seed = 1000; seed < 1200; seed++) {
      const items = generateSeries({ ...config, seed })
      items.slice(1).forEach((item, index) => {
        const before = items[index]
        expect(item.clef === before?.clef && item.pitch === before.pitch).toBe(false)
      })
    }
  })

  it('writes each note so it sounds the item pitch', () => {
    for (const item of generateSeries(config)) expect(midi(item.note)).toBe(item.pitch)
  })

  it('keeps C major without armures', () => {
    const items = generateSeries({ ...config, armures: false })
    expect(items.every((item) => item.fifths === 0 && item.note.alter === 0)).toBe(true)
  })

  it('covers every pitch class over many seeds when armures are on', () => {
    const classes = new Set<number>()
    for (let seed = 1000; seed < 1100; seed++) {
      for (const item of generateSeries({ ...config, seed })) classes.add(pitchClass(item.pitch))
    }
    expect(classes.size).toBe(12)
  })

  it('throws without any clef', () => {
    expect(() => generateSeries({ ...config, clefs: [] })).toThrow()
  })
})

describe('answerItem', () => {
  const items = generateSeries(config)
  const rightAnswer = (index: number) => pitchClass(items[index]?.pitch ?? 0)
  const wrongAnswer = (index: number) => (rightAnswer(index) + 1) % 12

  it('advances on a correct answer', () => {
    const result = answerItem(INITIAL_RUN, items, rightAnswer(0))
    expect(result).toMatchObject({ correct: true, finished: false })
    expect(result.run.index).toBe(1)
  })

  it('stays on the item and counts a mistake on a wrong answer', () => {
    const result = answerItem(INITIAL_RUN, items, wrongAnswer(0))
    expect(result).toMatchObject({ correct: false, finished: false })
    expect(result.run.index).toBe(0)
    expect(result.run.mistakes[0]).toBe(1)
  })

  it('accumulates mistakes on the same item', () => {
    const first = answerItem(INITIAL_RUN, items, wrongAnswer(0))
    const second = answerItem(first.run, items, wrongAnswer(0))
    expect(second.run.mistakes[0]).toBe(2)
  })

  it('finishes after the last correct answer', () => {
    let run: SeriesRun = INITIAL_RUN
    let finished = false
    for (let i = 0; i < items.length; i++) {
      const result = answerItem(run, items, rightAnswer(i))
      expect(result.finished).toBe(i === items.length - 1)
      run = result.run
      finished = result.finished
    }
    expect(finished).toBe(true)
    expect(run.index).toBe(items.length)
  })

  it('does not mutate the previous run', () => {
    const run: SeriesRun = { index: 0, mistakes: [] }
    answerItem(run, items, wrongAnswer(0))
    expect(run).toEqual({ index: 0, mistakes: [] })
  })
})

describe('penaltyMs and firstTryResults', () => {
  const items = generateSeries(config)
  const pc = (index: number) => pitchClass(items[index]?.pitch ?? 0)

  function play(wrongOn: Record<number, number>): SeriesRun {
    let run: SeriesRun = INITIAL_RUN
    for (let i = 0; i < items.length; i++) {
      for (let k = 0; k < (wrongOn[i] ?? 0); k++) run = answerItem(run, items, (pc(i) + 1) % 12).run
      run = answerItem(run, items, pc(i)).run
    }
    return run
  }

  it('charges five seconds per wrong tap', () => {
    expect(penaltyMs(INITIAL_RUN)).toBe(0)
    expect(penaltyMs(play({ 2: 1, 7: 2 }))).toBe(3 * PENALTY_MS)
  })

  it('marks only items answered without a mistake', () => {
    const results = firstTryResults(play({ 2: 1, 7: 2 }))
    expect(results).toHaveLength(SERIES_LENGTH)
    expect(results.filter((ok) => !ok)).toHaveLength(2)
    expect(results[2]).toBe(false)
    expect(results[7]).toBe(false)
    expect(results[0]).toBe(true)
  })

  it('treats unanswered items as clean and honours a custom length', () => {
    expect(firstTryResults(INITIAL_RUN, 5)).toEqual([true, true, true, true, true])
  })
})

describe('scoreSeries', () => {
  const score: Score = {
    id: 'abc',
    name: 'Test',
    clef: 'bass',
    key: -1,
    tempo: 80,
    timeSignature: { beats: 4, beatType: 4 },
    source: 'file',
    importedAt: 0,
    notes: [
      { pitch: 46, duration: 'quarter' },
      { pitch: null, duration: 'quarter' },
      { pitch: 48, duration: 'half' },
      { pitch: 49, duration: 'whole' },
    ],
  }

  it('lists the pitched notes in order and skips rests', () => {
    expect(scoreSeries(score).map((item) => item.pitch)).toEqual([46, 48, 49])
  })

  it('uses the score clef and key, writing notes in that key', () => {
    const [flat, natural, outside] = scoreSeries(score)
    expect(flat).toMatchObject({ clef: 'bass', fifths: -1, note: { letter: 'B', octave: 2, alter: -1 } })
    expect(natural?.note).toEqual({ letter: 'C', octave: 3, alter: 0 })
    expect(midi(outside?.note as Note)).toBe(49)
    expect(outside?.note.alter).toBe(-1)
  })

  it('plays through answerItem whatever the length, with exact penalties', () => {
    const items = scoreSeries(score)
    let run: SeriesRun = INITIAL_RUN
    run = answerItem(run, items, (pitchClass(46) + 1) % 12).run
    for (const item of items) {
      const result = answerItem(run, items, pitchClass(item.pitch))
      run = result.run
      expect(result.finished).toBe(item === items[items.length - 1])
    }
    expect(run.index).toBe(3)
    expect(penaltyMs(run)).toBe(PENALTY_MS)
    expect(firstTryResults(run, items.length)).toEqual([false, true, true])
  })
})
