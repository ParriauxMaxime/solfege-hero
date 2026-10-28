import { describe, expect, it } from 'vitest'
import { BEATS_PER_BAR, HIGHEST_STEP, LOWEST_STEP, MAX_MISS_GAP, MIN_MISS_GAP, createLogoScore, flameScale, type LogoNote } from './logoScore'

const take = (seed: number, count: number): LogoNote[] => {
  const next = createLogoScore(seed)
  return Array.from({ length: count }, next)
}

const SEEDS = Array.from({ length: 200 }, (_, seed) => seed * 7919 + 1)
const NOTES = 600
const WINDOW = 12
const MAX_ECHO = 5

const stepsOf = (seed: number) => take(seed, NOTES).map(({ step }) => step)

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

  it('numbers notes and starts a bar every four beats', () => {
    const notes = take(5, 40)
    expect(notes.map(({ index }) => index)).toEqual(notes.map((_, position) => position))
    for (const { index, barStart } of notes) expect(barStart).toBe(index % BEATS_PER_BAR === 0)
  })

  it('points stems up below the middle line and down from it', () => {
    for (const { step, stemUp } of take(11, 200)) expect(stemUp).toBe(step < 4)
  })

  it('misses every 12 to 30 notes, the first one included', () => {
    for (const seed of SEEDS) {
      const misses = take(seed, NOTES).filter(({ miss }) => miss).map(({ index }) => index)
      expect(misses.length).toBeGreaterThan(15)
      misses.forEach((index, position) => {
        const gap = index - (misses[position - 1] ?? 0)
        expect(gap).toBeGreaterThanOrEqual(MIN_MISS_GAP)
        expect(gap).toBeLessThanOrEqual(MAX_MISS_GAP)
      })
    }
  })

  it('resets the streak on a miss and builds it again with the next hits', () => {
    for (const seed of SEEDS) {
      const notes = take(seed, NOTES)
      notes.forEach((note, position) => {
        const previous = notes[position - 1]?.streak ?? 0
        expect(note.streak).toBe(note.miss ? 0 : previous + 1)
      })
      expect(notes.some(({ miss }) => miss)).toBe(true)
    }
  })

  it('tells each note which miss puts its flame out', () => {
    const notes = take(4, 300)
    notes.forEach(({ index, snuffIndex }) => {
      const next = notes.find((other) => other.miss && other.index > index)
      if (next) expect(snuffIndex).toBe(next.index)
    })
  })

  it('grows flames with the streak up to a cap', () => {
    expect(flameScale(1)).toBeCloseTo(0.75)
    expect(flameScale(5)).toBeGreaterThan(flameScale(2))
    expect(flameScale(10)).toBeCloseTo(1.05)
    expect(flameScale(40)).toBeCloseTo(1.05)
  })
})
