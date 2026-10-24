import { describe, expect, it } from 'vitest'
import { buildPool, promptId, type NoteStats, type Prompt } from '../game/sampler'
import { midi } from '../music/notes'
import { seededRandom } from '../testing/seededRandom'
import { melodySource, placeNotes, randomSource } from './sources'
import { BEATS_PER_BAR, DURATION_BEATS, type Melody, type NoteSpec } from './types'

const barBeats = (bar: NoteSpec[]) => bar.reduce((sum, spec) => sum + DURATION_BEATS[spec.duration], 0)

describe('randomSource', () => {
  const pool = buildPool(['treble'], true)

  it('fills every bar with pitches from the pool', () => {
    const source = randomSource(pool, () => ({}), seededRandom(3))
    const pitches = new Set(pool.map((prompt) => prompt.pitch))
    for (let i = 0; i < 50; i++) {
      const bar = source.nextBar()
      expect(barBeats(bar)).toBe(BEATS_PER_BAR)
      for (const spec of bar) if (spec.pitch !== null) expect(pitches.has(spec.pitch)).toBe(true)
    }
  })

  it('never repeats a pitch back to back, across bars too', () => {
    const source = randomSource(pool, () => ({}), seededRandom(9))
    const pitches = Array.from({ length: 100 }, () => source.nextBar())
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
    const pitches = Array.from({ length: 300 }, () => source.nextBar())
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
    tempo: 80,
    notes: [
      { pitch: 60, duration: 'quarter' },
      { pitch: 62, duration: 'quarter' },
      { pitch: 64, duration: 'half' },
      { pitch: 65, duration: 'whole' },
    ],
  }

  it('yields the melody bar by bar and loops', () => {
    const source = melodySource(melody)
    const first = source.nextBar()
    expect(first.map((spec) => spec.pitch)).toEqual([60, 62, 64])
    expect(source.nextBar().map((spec) => spec.pitch)).toEqual([65])
    expect(source.nextBar()).toEqual(first)
  })
})

describe('placeNotes', () => {
  const specs: NoteSpec[] = [
    { pitch: 61, duration: 'quarter' },
    { pitch: null, duration: 'quarter' },
    { pitch: 60, duration: 'half' },
  ]

  it('assigns consecutive beats and ids from the starting point', () => {
    const placed = placeNotes(specs, 4, 10, () => false)
    expect(placed.map((note) => note.beat)).toEqual([4, 5, 6])
    expect(placed.map((note) => note.id)).toEqual([10, 11, 12])
  })

  it('spells pitches with the requested accidental and leaves rests empty', () => {
    const sharp = placeNotes(specs, 0, 0, () => false)
    const flat = placeNotes(specs, 0, 0, () => true)
    expect(sharp[0]?.note).toEqual({ letter: 'C', octave: 4, alter: 1 })
    expect(flat[0]?.note).toEqual({ letter: 'D', octave: 4, alter: -1 })
    expect(sharp[1]).toMatchObject({ pitch: null, note: null })
    expect(sharp[2]?.note).toEqual({ letter: 'C', octave: 4, alter: 0 })
    expect(sharp.every((note) => note.note === null || midi(note.note) === note.pitch)).toBe(true)
  })
})
