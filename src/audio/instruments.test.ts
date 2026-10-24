import { describe, expect, it } from 'vitest'
import { pluckSamples } from './instruments'

function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

function rms(samples: Float32Array, from: number, to: number): number {
  let sum = 0
  for (let i = from; i < to; i++) sum += (samples[i] as number) ** 2
  return Math.sqrt(sum / (to - from))
}

describe('pluckSamples', () => {
  it('has the requested length, capped at 2 seconds', () => {
    expect(pluckSamples(261.63, 8000, 1).length).toBe(8000)
    expect(pluckSamples(261.63, 8000, 10).length).toBe(16000)
  })

  it('decays toward zero', () => {
    const samples = pluckSamples(261.63, 22050, 2, seeded(1))
    const tenth = Math.floor(samples.length / 10)
    expect(rms(samples, 0, tenth)).toBeGreaterThan(0.05)
    expect(rms(samples, samples.length - tenth, samples.length)).toBeLessThan(rms(samples, 0, tenth) * 0.2)
    expect(Math.abs(samples[samples.length - 1] as number)).toBeLessThan(1e-3)
  })

  it('is deterministic with a seeded noise source', () => {
    expect(pluckSamples(440, 8000, 0.5, seeded(7))).toEqual(pluckSamples(440, 8000, 0.5, seeded(7)))
    expect(pluckSamples(440, 8000, 0.5, seeded(7))).not.toEqual(pluckSamples(440, 8000, 0.5, seeded(8)))
  })
})
