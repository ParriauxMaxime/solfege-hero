import { describe, expect, it } from 'vitest'
import { MAX_BPM, MIN_BPM, adaptTempo, type TempoState } from './tempo'

function hitTimes(state: TempoState, count: number): TempoState {
  let next = state
  for (let i = 0; i < count; i++) next = adaptTempo(next, true)
  return next
}

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
