import { describe, expect, it } from 'vitest'
import { BEATS_PER_BAR, HIGHEST_STEP, LOWEST_STEP, MAX_MISS_GAP, MIN_MISS_GAP, createLogoScore, type LogoNote } from './logoScore'

const take = (seed: number, count: number): LogoNote[] => {
  const next = createLogoScore(seed)
  return Array.from({ length: count }, next)
}

const SEEDS = Array.from({ length: 200 }, (_, seed) => seed * 7919 + 1)
const BEATS = 600
const WINDOW = 12
const MAX_ECHO = 5
const REST_BEATS = 2000
const REST_RATIO = 0.2
const REST_RATIO_TOLERANCE = 0.03

const playedOf = (seed: number, count = BEATS) => take(seed, count).filter(({ rest }) => !rest)
const stepsOf = (seed: number) => playedOf(seed).map(({ step }) => step)

/** Longest run of notes that repeat the note a period earlier: a loop spans that run plus one period. */
function longestEcho(steps: number[], period: number): number {
  let run = 0
  let longest = 0
  for (let position = period; position < steps.length; position++) {
    run = steps[position] === steps[position - period] ? run + 1 : 0
    longest = Math.max(longest, run)
  }
  return longest
}

describe('logo score', () => {
  it('keeps every note on the staff without ledger lines', () => {
    for (const seed of SEEDS) {
      for (const step of stepsOf(seed)) {
        expect(step).toBeGreaterThanOrEqual(LOWEST_STEP)
        expect(step).toBeLessThanOrEqual(HIGHEST_STEP)
        expect(Number.isInteger(step)).toBe(true)
      }
    }
  })

  it('is deterministic for a seed and differs between seeds', () => {
    expect(take(7, 120)).toEqual(take(7, 120))
    expect(stepsOf(7)).not.toEqual(stepsOf(8))
  })

  it('moves mostly by step and never repeats a pitch more than twice in a row', () => {
    let small = 0
    let total = 0
    for (const seed of SEEDS) {
      const steps = stepsOf(seed)
      steps.forEach((step, position) => {
        if (position < 2) return
        expect(step === steps[position - 1] && step === steps[position - 2]).toBe(false)
        total++
        if (Math.abs(step - (steps[position - 1] as number)) <= 2) small++
      })
    }
    expect(small / total).toBeGreaterThan(0.8)
  })

  it('never plays the same 12 notes twice over hundreds of notes', () => {
    for (const seed of SEEDS) {
      const steps = stepsOf(seed)
      const seen = new Set<string>()
      for (let start = 0; start + WINDOW <= steps.length; start++) {
        const window = steps.slice(start, start + WINDOW).join(',')
        expect(seen.has(window)).toBe(false)
        seen.add(window)
      }
    }
  })

  it('never settles into a short loop', () => {
    for (const seed of SEEDS) {
      const steps = stepsOf(seed)
      for (let period = 2; period <= 8; period++) expect(longestEcho(steps, period)).toBeLessThanOrEqual(MAX_ECHO)
    }
  })

  it('numbers every beat and starts a bar every four beats', () => {
    const beats = take(5, 40)
    expect(BEATS_PER_BAR).toBe(4)
    expect(beats.map(({ index }) => index)).toEqual(beats.map((_, position) => position))
    for (const { index, barStart } of beats) expect(barStart).toBe(index % BEATS_PER_BAR === 0)
  })

  it('points stems up below the middle line and down from it', () => {
    for (const { step, stemUp } of playedOf(11, 200)) expect(stemUp).toBe(step < 4)
  })

  describe('rests', () => {
    it('fill about one beat in five', () => {
      let rests = 0
      let beats = 0
      for (const seed of SEEDS.slice(0, 20)) {
        for (const { rest } of take(seed, REST_BEATS)) {
          beats++
          if (rest) rests++
        }
      }
      expect(Math.abs(rests / beats - REST_RATIO)).toBeLessThan(REST_RATIO_TOLERANCE)
    })

    it('never come twice in a row nor fill a whole bar', () => {
      for (const seed of SEEDS) {
        const beats = take(seed, BEATS)
        beats.forEach(({ rest }, position) => expect(rest && beats[position - 1]?.rest).toBeFalsy())
        for (let start = 0; start < BEATS; start += BEATS_PER_BAR) {
          expect(beats.slice(start, start + BEATS_PER_BAR).every(({ rest }) => rest)).toBe(false)
        }
      }
    })

    it('are never missed, burn nothing and leave the streak as it was', () => {
      for (const seed of SEEDS) {
        const beats = take(seed, BEATS)
        beats.forEach((beat, position) => {
          if (!beat.rest) return
          expect(beat.miss).toBe(false)
          expect(beat.streak).toBe(beats[position - 1]?.streak ?? 0)
        })
        expect(beats.some(({ rest }) => rest)).toBe(true)
      }
    })

    it('do not shift the notes: the same seed gives the same tonal walk whatever the rests', () => {
      const notes = playedOf(9, 300).map(({ step }) => step)
      const next = createLogoScore(9)
      const steps: number[] = []
      while (steps.length < notes.length) {
        const beat = next()
        if (!beat.rest) steps.push(beat.step)
      }
      expect(steps).toEqual(notes)
    })
  })

  it('misses every 12 to 30 notes, rests not counted, the first miss included', () => {
    for (const seed of SEEDS) {
      const played = playedOf(seed)
      const misses = played.map((beat, ordinal) => (beat.miss ? ordinal : -1)).filter((ordinal) => ordinal >= 0)
      expect(misses.length).toBeGreaterThan(12)
      misses.forEach((ordinal, position) => {
        const gap = ordinal - (misses[position - 1] ?? 0)
        expect(gap).toBeGreaterThanOrEqual(MIN_MISS_GAP)
        expect(gap).toBeLessThanOrEqual(MAX_MISS_GAP)
      })
    }
  })

  it('resets the streak on a miss and builds it again with the next hits', () => {
    for (const seed of SEEDS) {
      const played = playedOf(seed)
      played.forEach((note, position) => {
        const previous = played[position - 1]?.streak ?? 0
        expect(note.streak).toBe(note.miss ? 0 : previous + 1)
      })
      expect(played.some(({ miss }) => miss)).toBe(true)
    }
  })

  it('tells each beat which miss puts the fire out', () => {
    const beats = take(4, 300)
    beats.forEach(({ index, snuffIndex }) => {
      const next = beats.find((other) => other.miss && other.index > index)
      if (next) expect(snuffIndex).toBe(next.index)
    })
  })
})
