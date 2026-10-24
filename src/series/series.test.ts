import { describe, expect, it } from 'vitest'
import { buildPool } from '../game/sampler'
import { midi, pitchClass } from '../music/notes'
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
  type SeriesConfig,
  type SeriesRun,
} from './series'

const config: SeriesConfig = { seed: 4821, clefs: ['treble', 'bass'], armures: true }

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
        const settings: SeriesConfig = { seed, clefs: ['treble', 'alto'], armures }
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
