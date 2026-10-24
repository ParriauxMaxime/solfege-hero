import { describe, expect, it } from 'vitest'
import { barLength, specBeats } from '../hero/meter'
import type { NoteSpec } from '../hero/types'
import {
  generateMelody,
  generateMelodyWithPlan,
  type BarKind,
  type Difficulty,
  type GeneratedMelody,
  type GeneratorOptions,
} from './generator'
import { spellInKey } from './keySignature'
import { MELODIES } from './melodies'
import { CLEFS, pitchClass, pitchesInRange } from './notes'
import { intervalProfile } from './profile'

const DIFFICULTIES: Difficulty[] = [1, 2, 3, 4, 5]
const SEEDS = Array.from({ length: 200 }, (_, index) => 1000 + index)

function pitchesOf(notes: readonly NoteSpec[]): number[] {
  return notes.map((spec) => spec.pitch as number)
}

function everyMelody(
  check: (result: GeneratedMelody, options: GeneratorOptions) => void,
  extra: Partial<GeneratorOptions> = {},
): void {
  for (const clef of CLEFS) {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS.slice(0, 60)) {
        const options: GeneratorOptions = { clef, armures: true, difficulty, ...extra }
        check(generateMelodyWithPlan(seed, options), options)
      }
    }
  }
}

describe('generateMelody determinism', () => {
  const options: GeneratorOptions = { clef: 'treble', armures: true, difficulty: 3 }

  it('gives the same melody for the same seed and options', () => {
    expect(generateMelody(4821, options)).toEqual(generateMelody(4821, options))
  })

  it('gives different melodies for different seeds', () => {
    const melodies = new Set(SEEDS.map((seed) => JSON.stringify(generateMelody(seed, options).notes)))
    expect(melodies.size).toBeGreaterThan(SEEDS.length * 0.95)
  })

  it('depends on the options', () => {
    expect(generateMelody(4821, { ...options, difficulty: 1 })).not.toEqual(generateMelody(4821, options))
  })
})

describe('generateMelody structure', () => {
  it('fills whole bars without any symbol crossing a bar line', () => {
    everyMelody(({ melody }) => {
      const length = barLength(melody.timeSignature)
      let beat = 0
      for (const spec of melody.notes) {
        const duration = specBeats(spec)
        expect((beat % length) + duration).toBeLessThanOrEqual(length + 1e-9)
        beat += duration
      }
      expect(beat).toBeCloseTo(8 * length, 9)
    })
  })

  it('composes the requested number of bars with a motif first and a cadence last', () => {
    for (const bars of [2, 4, 8, 16]) {
      const { plan } = generateMelodyWithPlan(77, { clef: 'treble', armures: true, difficulty: 2, bars })
      expect(plan).toHaveLength(bars)
      expect(plan[0]?.kind).toBe('motif')
      expect(plan[bars - 1]?.kind).toBe('cadence')
    }
  })

  it('has no rests', () => {
    everyMelody(({ melody }) => expect(melody.notes.every((spec) => spec.pitch !== null)).toBe(true))
  })

  it('writes 4/4 about 70% of the time and 3/4 otherwise', () => {
    const waltzes = SEEDS.filter(
      (seed) => generateMelody(seed, { clef: 'treble', armures: true, difficulty: 2 }).timeSignature.beats === 3,
    )
    expect(waltzes.length / SEEDS.length).toBeGreaterThan(0.2)
    expect(waltzes.length / SEEDS.length).toBeLessThan(0.4)
  })

  it('honours a requested time signature, key and mode', () => {
    const { melody, mode, tonic } = generateMelodyWithPlan(5, {
      clef: 'treble',
      armures: true,
      difficulty: 2,
      time: { beats: 3, beatType: 4 },
      key: 2,
      mode: 'minor',
    })
    expect(melody.timeSignature).toEqual({ beats: 3, beatType: 4 })
    expect(melody.key).toBe(2)
    expect(mode).toBe('minor')
    expect(tonic).toBe(11)
    expect(barLength(melody.timeSignature)).toBe(3)
  })
})

describe('generateMelody tonality', () => {
  it('keeps key 0 without armures and favours keys near 0 with them', () => {
    for (const seed of SEEDS) {
      expect(generateMelody(seed, { clef: 'treble', armures: false, difficulty: 3 }).key).toBe(0)
    }
    const keys = SEEDS.map((seed) => generateMelody(seed, { clef: 'treble', armures: true, difficulty: 3 }).key)
    expect(keys.every((key) => Math.abs(key) <= 4)).toBe(true)
    const share = (wanted: (key: number) => boolean) => keys.filter(wanted).length / keys.length
    expect(share((key) => key >= 0 && key <= 2)).toBeGreaterThan(0.45)
    expect(share((key) => Math.abs(key) >= 3)).toBeLessThan(0.25)
  })

  it('writes about 70% major and 30% minor', () => {
    const minors = SEEDS.filter(
      (seed) => generateMelodyWithPlan(seed, { clef: 'treble', armures: true, difficulty: 2 }).mode === 'minor',
    )
    expect(minors.length / SEEDS.length).toBeGreaterThan(0.2)
    expect(minors.length / SEEDS.length).toBeLessThan(0.4)
  })

  it('starts on the tonic or the dominant and ends on the tonic', () => {
    everyMelody(({ melody, tonic }) => {
      const pitches = pitchesOf(melody.notes)
      expect([tonic, (tonic + 7) % 12]).toContain(pitchClass(pitches[0] as number))
      expect(pitchClass(pitches[pitches.length - 1] as number)).toBe(tonic)
    })
  })

  it('ends on a long note: the longest of the last bar', () => {
    everyMelody(({ melody }) => {
      const length = barLength(melody.timeSignature)
      const beats = melody.notes.map(specBeats)
      const lastBar: number[] = []
      let total = 0
      for (let i = beats.length - 1; total < length - 1e-9; i--) {
        lastBar.unshift(beats[i] as number)
        total += beats[i] as number
      }
      expect(lastBar[lastBar.length - 1]).toBe(Math.max(...lastBar))
    })
  })

  it('never writes 4 or more identical pitches in a row', () => {
    everyMelody(({ melody }) => {
      const pitches = pitchesOf(melody.notes)
      for (let i = 3; i < pitches.length; i++) {
        const run = pitches.slice(i - 3, i + 1)
        expect(run.every((pitch) => pitch === run[0])).toBe(false)
      }
    })
  })

  it('answers every leap with a step the other way', () => {
    everyMelody(({ melody }) => {
      const pitches = pitchesOf(melody.notes)
      for (let i = 2; i < pitches.length; i++) {
        const leap = (pitches[i - 1] as number) - (pitches[i - 2] as number)
        if (Math.abs(leap) < 5) continue
        const next = (pitches[i] as number) - (pitches[i - 1] as number)
        expect(Math.abs(next)).toBeGreaterThan(0)
        expect(Math.abs(next)).toBeLessThanOrEqual(2)
        expect(Math.sign(next)).toBe(-Math.sign(leap))
      }
    })
  })

  it('repeats or sequences an earlier bar in at least half of the bars', () => {
    const counting: BarKind[] = ['repeat', 'sequence']
    for (const bars of [8, 16]) {
      everyMelody(
        ({ plan }) => {
          const repeated = plan.filter((entry) => counting.includes(entry.kind)).length
          expect(repeated / plan.length).toBeGreaterThanOrEqual(0.5)
        },
        { bars },
      )
    }
  })

  it('varies the answering phrase while keeping its rhythm', () => {
    let shared = 0
    let total = 0
    for (const seed of SEEDS) {
      const result = generateMelodyWithPlan(seed, { clef: 'treble', armures: false, difficulty: 2, bars: 8 })
      const pitches = pitchesOf(result.melody.notes)
      const perBar: number[][] = []
      let beat = 0
      const length = barLength(result.melody.timeSignature)
      result.melody.notes.forEach((spec, index) => {
        const bar = Math.floor((beat + 1e-9) / length)
        ;(perBar[bar] ??= []).push(pitches[index] as number)
        beat += specBeats(spec)
      })
      result.plan.forEach((entry, bar) => {
        if (entry.kind !== 'variation' || entry.source === null) return
        const source = perBar[entry.source] as number[]
        const varied = perBar[bar] as number[]
        expect(varied).toHaveLength(source.length)
        shared += varied.filter((pitch, index) => pitch === source[index]).length
        total += varied.length
      })
    }
    expect(total).toBeGreaterThan(0)
    expect(shared / total).toBeGreaterThan(0.3)
    expect(shared / total).toBeLessThan(0.8)
  })
})

describe('generateMelody difficulty', () => {
  const MAX_SEMITONES: Record<Difficulty, number> = { 1: 2, 2: 4, 3: 5, 4: 9, 5: 12 }
  const MAX_SPREAD: Record<Difficulty, number> = { 1: 7, 2: 12, 3: 14, 4: 19, 5: Infinity }
  const VOCABULARY: Record<Difficulty, string[]> = {
    1: ['quarter0', 'half0'],
    2: ['quarter0', 'half0', 'whole0', 'half1'],
    3: ['quarter0', 'half0', 'whole0', 'half1', 'eighth0'],
    4: ['quarter0', 'half0', 'whole0', 'half1', 'eighth0', 'quarter1'],
    5: ['quarter0', 'half0', 'whole0', 'half1', 'eighth0', 'quarter1', 'sixteenth0'],
  }

  it('stays inside the clef range at every level', () => {
    everyMelody(({ melody }, options) => {
      const allowed = new Set(pitchesInRange(options.clef, true))
      expect(pitchesOf(melody.notes).every((pitch) => allowed.has(pitch))).toBe(true)
    })
  })

  it('narrows the pitch range at low levels', () => {
    everyMelody(({ melody }, options) => {
      const pitches = pitchesOf(melody.notes)
      const spread = Math.max(...pitches) - Math.min(...pitches)
      expect(spread).toBeLessThanOrEqual(MAX_SPREAD[options.difficulty])
    })
  })

  it('caps the melodic interval per level', () => {
    everyMelody(({ melody }, options) => {
      const pitches = pitchesOf(melody.notes)
      for (let i = 1; i < pitches.length; i++) {
        const size = Math.abs((pitches[i] as number) - (pitches[i - 1] as number))
        expect(size).toBeLessThanOrEqual(MAX_SEMITONES[options.difficulty])
        expect(size).not.toBe(6)
      }
    })
  })

  it('draws rhythms from the level vocabulary', () => {
    everyMelody(({ melody }, options) => {
      for (const spec of melody.notes) {
        expect(VOCABULARY[options.difficulty]).toContain(`${spec.duration}${spec.dots ?? 0}`)
      }
    })
  })

  it('uses richer rhythms as the level rises', () => {
    const used = (difficulty: Difficulty) =>
      new Set(
        SEEDS.flatMap((seed) =>
          generateMelody(seed, { clef: 'treble', armures: true, difficulty }).notes.map(
            (spec) => `${spec.duration}${spec.dots ?? 0}`,
          ),
        ),
      )
    expect(used(1).size).toBe(2)
    expect(used(3).has('eighth0')).toBe(true)
    expect(used(4).has('quarter1')).toBe(true)
    expect(used(5).has('sixteenth0')).toBe(true)
  })

  it('stays in the key below level 3 and never without armures', () => {
    everyMelody(({ melody }, options) => {
      if (options.difficulty >= 3) return
      expect(pitchesOf(melody.notes).every((pitch) => spellInKey(pitch, melody.key) !== null)).toBe(true)
    })
    everyMelody(({ melody }) => {
      expect(pitchesOf(melody.notes).every((pitch) => spellInKey(pitch, melody.key) !== null)).toBe(true)
    }, { armures: false })
  })

  it('adds a few chromatic passing tones from level 3 with armures, at most 5%', () => {
    let chromatic = 0
    for (const difficulty of [3, 4, 5] as Difficulty[]) {
      for (const seed of SEEDS) {
        const { notes, key } = generateMelody(seed, { clef: 'treble', armures: true, difficulty, bars: 16 })
        const outside = pitchesOf(notes).filter((pitch) => spellInKey(pitch, key) === null).length
        expect(outside / notes.length).toBeLessThanOrEqual(0.05)
        chromatic += outside
      }
    }
    expect(chromatic).toBeGreaterThan(0)
  })
})

describe('generateMelody calibration against the corpus', () => {
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
  const corpus = MELODIES.map((melody) => intervalProfile(melody.notes))
  const generated = SEEDS.map((seed) =>
    intervalProfile(generateMelody(seed, { clef: 'treble', armures: true, difficulty: 3 }).notes),
  )
  const ratios = (profiles: typeof corpus) => ({
    repeats: mean(profiles.map((profile) => profile.repeats)),
    steps: mean(profiles.map((profile) => profile.steps)),
    thirds: mean(profiles.map((profile) => profile.thirds)),
    leaps: mean(profiles.map((profile) => profile.leaps)),
  })
  const reference = ratios(corpus)
  const measured = ratios(generated)

  it('reports both profiles', () => {
    const format = (profile: typeof reference) =>
      Object.entries(profile)
        .map(([name, value]) => `${name} ${value.toFixed(3)}`)
        .join(', ')
    console.info(`Corpus (${MELODIES.length} melodies): ${format(reference)}`)
    console.info(`Generator, difficulty 3 (${SEEDS.length} seeds): ${format(measured)}`)
    expect(corpus.length).toBeGreaterThan(0)
  })

  it('moves by step about as often as the corpus', () => {
    expect(Math.abs(measured.steps - reference.steps)).toBeLessThanOrEqual(0.15)
  })

  it('leaps no more than the corpus plus 5 points', () => {
    expect(measured.leaps).toBeLessThanOrEqual(reference.leaps + 0.05)
  })

  it('repeats notes about as often as the corpus', () => {
    expect(Math.abs(measured.repeats - reference.repeats)).toBeLessThanOrEqual(0.12)
  })
})
