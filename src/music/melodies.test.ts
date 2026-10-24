import { describe, expect, it } from 'vitest'
import { barLength, specBeats } from '../hero/meter'
import { COMMON_TIME } from '../hero/types'
import { MELODIES } from './melodies'
import { spellInKey } from './keySignature'
import { pitchClass, pitchesInRange } from './notes'
import { intervalProfile } from './profile'

const EPSILON = 1e-6
const D_SHARP = 3
const G_SHARP = 8
const MINOR_ACCIDENTALS: Record<string, number[]> = {
  Greensleeves: [G_SHARP],
  'Lettre à Élise (Beethoven)': [D_SHARP, G_SHARP],
}

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
    const bar = barLength(melody.timeSignature ?? COMMON_TIME)
    let beat = 0
    for (const spec of melody.notes) {
      const length = specBeats(spec)
      expect((beat % bar) + length).toBeLessThanOrEqual(bar + EPSILON)
      beat += length
    }
    expect(Math.abs(beat / bar - Math.round(beat / bar))).toBeLessThan(EPSILON)
  })

  it.each(MELODIES)('$name stays inside its clef range', (melody) => {
    const allowed = new Set(pitchesInRange(melody.clef, true))
    for (const { pitch } of melody.notes) if (pitch !== null) expect(allowed.has(pitch)).toBe(true)
  })

  it.each(MELODIES)('$name only uses notes of its key signature (bar the minor-key leading tones)', (melody) => {
    const extras = MINOR_ACCIDENTALS[melody.name] ?? []
    for (const { pitch } of melody.notes) {
      if (pitch === null) continue
      expect(spellInKey(pitch, melody.key) !== null || extras.includes(pitchClass(pitch))).toBe(true)
    }
  })

  it.each(MELODIES)('$name has a sensible tempo', (melody) => {
    expect(melody.tempo).toBeGreaterThanOrEqual(40)
    expect(melody.tempo).toBeLessThanOrEqual(160)
  })

  it('includes the public-domain corpus', () => {
    const names = MELODIES.map((melody) => melody.name)
    for (const name of [
      'Menuet en sol (Bach)',
      'Ah ! vous dirai-je, maman',
      'Twinkle Twinkle Little Star',
      'Greensleeves',
      'Lettre à Élise (Beethoven)',
      'Canon (Pachelbel)',
      'Amazing Grace',
    ]) {
      expect(names).toContain(name)
    }
  })

  it.each(MELODIES)('$name has a coherent interval profile', (melody) => {
    const profile = intervalProfile(melody.notes)
    expect(profile.total).toBeGreaterThan(0)
    expect(profile.repeats + profile.steps + profile.thirds + profile.leaps).toBeCloseTo(1)
    expect(profile.leaps).toBeLessThan(0.5)
  })

  it('has a corpus-wide profile dominated by steps and repeats', () => {
    const profiles = MELODIES.map((melody) => intervalProfile(melody.notes))
    const average = (key: 'repeats' | 'steps' | 'thirds' | 'leaps') =>
      profiles.reduce((sum, profile) => sum + profile[key], 0) / profiles.length
    console.info('corpus interval profile', {
      repeats: average('repeats').toFixed(3),
      steps: average('steps').toFixed(3),
      thirds: average('thirds').toFixed(3),
      leaps: average('leaps').toFixed(3),
    })
    expect(average('repeats') + average('steps')).toBeGreaterThan(0.6)
  })

  it('writes dotted values and rests', () => {
    const menuet = MELODIES.find((melody) => melody.name === 'Menuet en sol (Bach)')
    expect(menuet?.notes.at(-1)).toEqual({ pitch: 69, duration: 'half', dots: 1 })
    const elise = MELODIES.find((melody) => melody.name === 'Lettre à Élise (Beethoven)')
    expect(elise?.notes[0]).toEqual({ pitch: null, duration: 'quarter' })
  })

  it('writes Frère Jacques as C D E C', () => {
    const treble = MELODIES.find((melody) => melody.name === 'Frère Jacques')
    expect(treble?.notes.slice(0, 4).map((spec) => spec.pitch)).toEqual([72, 74, 76, 72])
  })
})
