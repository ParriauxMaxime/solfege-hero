import { describe, expect, it } from 'vitest'
import { createBeatClock, withTempo } from './clock'

describe('createBeatClock', () => {
  it('advances one beat per beat length', () => {
    const clock = createBeatClock(10, -4, 120)
    expect(clock.bpm).toBe(120)
    expect(clock.beatAt(10)).toBe(-4)
    expect(clock.beatAt(12)).toBe(0)
    expect(clock.timeAt(0)).toBe(12)
    expect(clock.timeAt(-3.5)).toBeCloseTo(10.25)
  })

  it('has timeAt inverse beatAt', () => {
    const clock = createBeatClock(3.2, 1.5, 77)
    expect(clock.beatAt(clock.timeAt(9.25))).toBeCloseTo(9.25)
  })
})

describe('withTempo', () => {
  it('keeps the beat continuous at the change', () => {
    const slow = createBeatClock(0, 0, 60)
    const fast = withTempo(slow, 4, 120)
    expect(fast.bpm).toBe(120)
    expect(fast.beatAt(4)).toBe(slow.beatAt(4))
  })

  it('runs at the new tempo afterwards', () => {
    const fast = withTempo(createBeatClock(0, 0, 60), 4, 120)
    expect(fast.beatAt(5)).toBe(6)
    expect(fast.timeAt(8)).toBe(6)
  })

  it('leaves the original clock untouched', () => {
    const slow = createBeatClock(0, 0, 60)
    withTempo(slow, 4, 120)
    expect(slow.beatAt(5)).toBe(5)
  })
})

describe('pausing', () => {
  it('resumes from a frozen beat by re-anchoring', () => {
    const running = createBeatClock(0, 0, 90)
    const frozenBeat = running.beatAt(2)
    const resumed = createBeatClock(10, frozenBeat, 90)
    expect(resumed.beatAt(10)).toBe(frozenBeat)
  })
})
