import { describe, expect, it } from 'vitest'
import { BEATS_PER_BAR, DURATION_BEATS } from '../hero/types'
import { MELODIES } from './melodies'
import { pitchesInRange } from './notes'

describe('MELODIES', () => {
  it('has unique names', () => {
    const names = MELODIES.map((melody) => melody.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('includes the five requested tunes', () => {
    const names = MELODIES.map((melody) => melody.name)
    for (const name of [
      'Frère Jacques',
      'Au clair de la lune',
      'Ode à la joie',
      'À la claire fontaine',
      'Vive le vent',
    ]) {
      expect(names).toContain(name)
    }
  })

  it('has at least one bass clef melody', () => {
    expect(MELODIES.some((melody) => melody.clef === 'bass')).toBe(true)
  })

  it.each(MELODIES)('$name fills whole bars without any symbol crossing a bar line', (melody) => {
    let beat = 0
    for (const { duration } of melody.notes) {
      const length = DURATION_BEATS[duration]
      expect((beat % BEATS_PER_BAR) + length).toBeLessThanOrEqual(BEATS_PER_BAR)
      beat += length
    }
    expect(beat % BEATS_PER_BAR).toBe(0)
  })

  it.each(MELODIES)('$name stays inside its clef range', (melody) => {
    const allowed = new Set(pitchesInRange(melody.clef, true))
    for (const { pitch } of melody.notes) expect(allowed.has(pitch as number)).toBe(true)
  })

  it.each(MELODIES)('$name only rests on quarters and has a sensible tempo', (melody) => {
    for (const spec of melody.notes) if (spec.pitch === null) expect(spec.duration).toBe('quarter')
    expect(melody.tempo).toBeGreaterThanOrEqual(40)
    expect(melody.tempo).toBeLessThanOrEqual(160)
  })

  it('writes Frère Jacques as C D E C', () => {
    const treble = MELODIES.find((melody) => melody.name === 'Frère Jacques')
    expect(treble?.notes.slice(0, 4).map((spec) => spec.pitch)).toEqual([72, 74, 76, 72])
  })
})
