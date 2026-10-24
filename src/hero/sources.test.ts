import { describe, expect, it } from 'vitest'
import { buildPool, promptId, type NoteStats, type Prompt } from '../game/sampler'
import type { Difficulty } from '../music/generator'
import { spellInKey } from '../music/keySignature'
import { seededRandom } from '../random'
import { barLength, specBeats } from './meter'
import { generatedSource, melodySource, placeNotes, randomSource, type NoteSource } from './sources'
import { BEATS_PER_BAR, DURATION_BEATS, type Melody, type NoteSpec } from './types'

const barBeats = (bar: NoteSpec[]) => bar.reduce((sum, spec) => sum + DURATION_BEATS[spec.duration], 0)
const nextBar = (source: NoteSource) => source.nextBar() as NoteSpec[]
const nextPitches = (source: NoteSource) => nextBar(source).map((spec) => spec.pitch)

describe('randomSource', () => {
  const pool = buildPool(['treble'], true)

  it('fills every bar with pitches from the pool', () => {
    const source = randomSource(pool, () => ({}), seededRandom(3))
    const pitches = new Set(pool.map((prompt) => prompt.pitch))
    for (let i = 0; i < 50; i++) {
      const bar = nextBar(source)
      expect(barBeats(bar)).toBe(BEATS_PER_BAR)
      for (const spec of bar) if (spec.pitch !== null) expect(pitches.has(spec.pitch)).toBe(true)
    }
  })

  it('never repeats a pitch back to back, across bars too', () => {
    const source = randomSource(pool, () => ({}), seededRandom(9))
    const pitches = Array.from({ length: 100 }, () => nextBar(source))
      .flat()
      .filter((spec) => spec.pitch !== null)
      .map((spec) => spec.pitch)
    pitches.slice(1).forEach((pitch, index) => expect(pitch).not.toBe(pitches[index]))
  })

  it('favours pitches the player misses, reading stats on every bar', () => {
    const small = buildPool(['treble'], false).slice(0, 4)
    const missed = small[0] as Prompt
    let stats: NoteStats = {}
    const source = randomSource(small, () => stats, seededRandom(4))
    stats = { [promptId(missed)]: { attempts: 9, correct: 1, misses: 8, avgMs: 3000 } }
    const pitches = Array.from({ length: 300 }, () => nextBar(source))
      .flat()
      .map((spec) => spec.pitch)
    const share = (pitch: number) => pitches.filter((p) => p === pitch).length
    expect(share(missed.pitch)).toBeGreaterThan(2 * share((small[1] as Prompt).pitch))
  })
})

describe('melodySource', () => {
  const melody: Melody = {
    name: 'test',
    clef: 'treble',
    key: 0,
    tempo: 80,
    notes: [
      { pitch: 60, duration: 'quarter' },
      { pitch: 62, duration: 'quarter' },
      { pitch: 64, duration: 'half' },
      { pitch: 65, duration: 'whole' },
    ],
  }

  it('loops the melody bar by bar on request', () => {
    const source = melodySource(melody, { loop: true })
    const first = nextBar(source)
    expect(first.map((spec) => spec.pitch)).toEqual([60, 62, 64])
    expect(nextPitches(source)).toEqual([65])
    expect(source.nextBar()).toEqual(first)
  })

  it('ends after the last bar by default', () => {
    const source = melodySource(melody)
    expect(nextPitches(source)).toEqual([60, 62, 64])
    expect(nextPitches(source)).toEqual([65])
    expect(source.nextBar()).toBeNull()
    expect(source.nextBar()).toBeNull()
  })

  it('never ends for a random source', () => {
    const source = randomSource(buildPool(['treble'], false), () => ({}), seededRandom(2))
    for (let i = 0; i < 200; i++) expect(source.nextBar()).not.toBeNull()
  })
})

describe('generatedSource', () => {
  const settings = { clef: 'treble' as const, armures: true }

  it('fixes key and time from the first chunk and never ends', () => {
    const { key, time, source } = generatedSource(4821, settings, () => 2)
    const length = barLength(time)
    for (let i = 0; i < 40; i++) {
      const bar = nextBar(source)
      expect(bar.reduce((sum, spec) => sum + specBeats(spec), 0)).toBeCloseTo(length, 9)
      expect(bar.every((spec) => spec.pitch !== null && spellInKey(spec.pitch, key) !== null)).toBe(true)
    }
  })

  it('is deterministic from the seed', () => {
    const play = () => {
      const { key, source } = generatedSource(77, settings, () => 3)
      return { key, bars: Array.from({ length: 20 }, () => source.nextBar()) }
    }
    expect(play()).toEqual(play())
  })

  it('reads the difficulty when each 8-bar chunk starts', () => {
    let level: Difficulty = 1
    const reads: Difficulty[] = []
    const { source } = generatedSource(9, settings, () => {
      reads.push(level)
      return level
    })
    const firstChunk = Array.from({ length: 8 }, () => nextBar(source)).flat()
    expect(firstChunk.every((spec) => ['quarter', 'half'].includes(spec.duration) && !spec.dots)).toBe(true)

    level = 5
    const later = Array.from({ length: 8 * 20 }, () => nextBar(source)).flat()
    expect(reads.slice(0, 2)).toEqual([1, 5])
    expect(later.some((spec) => ['eighth', 'sixteenth'].includes(spec.duration) || spec.dots === 1)).toBe(true)
  })

  it('keeps the same time signature and tonic across chunks', () => {
    const { time, source } = generatedSource(1234, { clef: 'bass', armures: true }, () => 2)
    const bars = Array.from({ length: 24 }, () => nextBar(source))
    const length = barLength(time)
    for (const bar of bars) {
      expect(bar.reduce((sum, spec) => sum + specBeats(spec), 0)).toBeCloseTo(length, 9)
    }
    const finals = bars.filter((_, index) => index % 8 === 7).map((bar) => bar[bar.length - 1]?.pitch as number)
    expect(new Set(finals.map((pitch) => pitch % 12)).size).toBe(1)
  })
})

describe('melodySource with other meters', () => {
  const waltz: Melody = {
    name: 'waltz',
    clef: 'treble',
    key: 0,
    tempo: 90,
    timeSignature: { beats: 3, beatType: 4 },
    notes: [
      { pitch: 60, duration: 'half', dots: 1 },
      { pitch: 62, duration: 'quarter', dots: 1 },
      { pitch: 64, duration: 'eighth' },
      { pitch: 65, duration: 'eighth', beats: 1 / 3 },
      { pitch: 67, duration: 'eighth', beats: 1 / 3 },
      { pitch: 69, duration: 'eighth', beats: 1 / 3 },
      { pitch: null, duration: 'half', dots: 1 },
    ],
  }

  it('splits bars by the time signature and the exact note lengths', () => {
    const source = melodySource(waltz, { loop: true })
    expect(nextPitches(source)).toEqual([60])
    expect(nextPitches(source)).toEqual([62, 64, 65, 67, 69])
    expect(nextPitches(source)).toEqual([null])
    expect(nextPitches(source)).toEqual([60])
  })

  it('keeps dots and tuplet lengths on the yielded specs', () => {
    const [first] = nextBar(melodySource(waltz))
    expect(first).toEqual({ pitch: 60, duration: 'half', dots: 1 })
  })
})

describe('melodySource with a note across a bar line', () => {
  it('realigns the next chunk on the real bar lines', () => {
    const quarter = (pitch: number): NoteSpec => ({ pitch, duration: 'quarter' })
    const source = melodySource({
      name: 'tie',
      clef: 'treble',
      key: 0,
      tempo: 90,
      timeSignature: { beats: 3, beatType: 4 },
      notes: [
        { pitch: 60, duration: 'half', dots: 1 },
        quarter(61),
        quarter(62),
        { pitch: 63, duration: 'half' },
        quarter(64),
        quarter(65),
      ],
    })
    expect(nextPitches(source)).toEqual([60])
    expect(nextPitches(source)).toEqual([61, 62, 63])
    expect(nextPitches(source)).toEqual([64, 65])
    expect(source.nextBar()).toBeNull()
  })
})

describe('placeNotes with dots and tuplets', () => {
  it('advances by the played length and copies dots', () => {
    const placed = placeNotes(
      [
        { pitch: 60, duration: 'quarter', dots: 1 },
        { pitch: 62, duration: 'eighth', beats: 1 / 3 },
        { pitch: 64, duration: 'quarter' },
      ],
      0,
      0,
      0,
      0,
    )
    expect(placed.map((note) => note.beat)).toEqual([0, 1.5, 1.5 + 1 / 3])
    expect(placed.map((note) => note.dots)).toEqual([1, 0, 0])
  })
})

describe('placeNotes', () => {
  const specs: NoteSpec[] = [
    { pitch: 61, duration: 'quarter' },
    { pitch: null, duration: 'quarter' },
    { pitch: 60, duration: 'half' },
  ]

  it('assigns consecutive beats and ids from the starting point', () => {
    const placed = placeNotes(specs, 4, 10, 0, 0)
    expect(placed.map((note) => note.beat)).toEqual([4, 5, 6])
    expect(placed.map((note) => note.id)).toEqual([10, 11, 12])
  })

  it('writes pitches in the key and leaves rests empty', () => {
    const inD = placeNotes([{ pitch: 66, duration: 'quarter' }, specs[1] as NoteSpec], 0, 0, 2, 0)
    expect(inD[0]?.note).toEqual({ letter: 'F', octave: 4, alter: 1 })
    expect(inD[0]?.pitch).toBe(66)
    expect(inD[1]).toMatchObject({ pitch: null, note: null })
  })

  it('falls back to a sharp or flat spelling for pitches outside the key', () => {
    expect(placeNotes(specs.slice(0, 1), 0, 0, 0, 0)[0]?.note?.alter).toBe(1)
    expect(placeNotes(specs.slice(0, 1), 0, 0, -1, 0)[0]?.note?.alter).toBe(-1)
  })

  it('never adds inline accidentals with a zero chance', () => {
    const bar: NoteSpec[] = Array.from({ length: 50 }, () => ({ pitch: 60, duration: 'quarter' }))
    const placed = placeNotes(bar, 0, 0, 0, 0, seededRandom(1))
    expect(placed.every((note) => note.pitch === 60)).toBe(true)
  })

  it('changes the sounding pitch when an inline accidental is added', () => {
    const [sharpened] = placeNotes(specs.slice(2), 0, 0, 0, 1, () => 0)
    expect(sharpened?.note).toEqual({ letter: 'C', octave: 4, alter: 1 })
    expect(sharpened?.pitch).toBe(61)
    const [naturalised] = placeNotes([{ pitch: 66, duration: 'quarter' }], 0, 0, 1, 1)
    expect(naturalised?.note).toEqual({ letter: 'F', octave: 4, alter: 0 })
    expect(naturalised?.pitch).toBe(65)
  })

  it('adds inline accidentals at about the requested rate', () => {
    const bar: NoteSpec[] = Array.from({ length: 2000 }, () => ({ pitch: 60, duration: 'quarter' }))
    const altered = placeNotes(bar, 0, 0, 0, 0.1, seededRandom(5)).filter((note) => note.pitch !== 60)
    expect(altered.length / 2000).toBeCloseTo(0.1, 1)
  })
})
