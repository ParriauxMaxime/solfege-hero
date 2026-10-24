import { describe, expect, it } from 'vitest'
import { MAX_BPM, MIN_BPM, adaptTempo, type TempoState } from './tempo'

function hitTimes(state: TempoState, count: number): TempoState {
  let next = state
  for (let i = 0; i < count; i++) next = adaptTempo(next, true)
  return next
}

describe('adaptTempo with a cap', () => {
  const eightHits = (state: TempoState, cap: number) => {
    let next = state
    for (let i = 0; i < 8; i++) next = adaptTempo(next, true, cap)
    return next
  }

  it('speeds up until the cap and no further', () => {
    expect(eightHits({ bpm: 70, hitsInRow: 0 }, 72)).toEqual({ bpm: 72, hitsInRow: 0 })
    expect(eightHits({ bpm: 72, hitsInRow: 0 }, 72)).toEqual({ bpm: 72, hitsInRow: 0 })
    expect(eightHits({ bpm: 71, hitsInRow: 0 }, 72).bpm).toBe(72)
  })

  it('leaves a tempo above the cap alone instead of pulling it down', () => {
    expect(eightHits({ bpm: 120, hitsInRow: 0 }, 72).bpm).toBe(120)
  })

  it('still slows down on misses whatever the cap', () => {
    expect(adaptTempo({ bpm: 120, hitsInRow: 3 }, false, 72)).toEqual({ bpm: 116, hitsInRow: 0 })
  })
})

describe('adaptTempo', () => {
  it('counts hits without changing tempo before the eighth', () => {
    expect(hitTimes({ bpm: 60, hitsInRow: 0 }, 7)).toEqual({ bpm: 60, hitsInRow: 7 })
  })

  it('speeds up by 2 BPM every 8 consecutive hits', () => {
    expect(hitTimes({ bpm: 60, hitsInRow: 0 }, 8)).toEqual({ bpm: 62, hitsInRow: 0 })
    expect(hitTimes({ bpm: 60, hitsInRow: 0 }, 16)).toEqual({ bpm: 64, hitsInRow: 0 })
  })

  it('slows down by 4 BPM on a miss and resets the run', () => {
    expect(adaptTempo({ bpm: 60, hitsInRow: 5 }, false)).toEqual({ bpm: 56, hitsInRow: 0 })
  })

  it('stays within the tempo bounds', () => {
    expect(adaptTempo({ bpm: MAX_BPM, hitsInRow: 7 }, true).bpm).toBe(MAX_BPM)
    expect(adaptTempo({ bpm: MIN_BPM + 1, hitsInRow: 0 }, false).bpm).toBe(MIN_BPM)
  })
})
