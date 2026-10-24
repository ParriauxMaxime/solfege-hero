import { describe, expect, it } from 'vitest'
import { createBeatClock } from './clock'
import {
  GOOD_WINDOW_MS,
  PERFECT_WINDOW_MS,
  expiredNotes,
  noteInWindow,
  timingJudgement,
} from './judgement'
import type { HeroNote } from './types'

const clock = createBeatClock(0, 0, 60)

const heroNote = (id: number, beat: number, pitch: number | null = 60): HeroNote => ({
  id,
  beat,
  duration: 'quarter',
  pitch,
  note: null,
})

describe('timingJudgement', () => {
  it('is parfait within the tight window, early or late', () => {
    expect(timingJudgement(0)).toBe('parfait')
    expect(timingJudgement(PERFECT_WINDOW_MS)).toBe('parfait')
    expect(timingJudgement(-PERFECT_WINDOW_MS)).toBe('parfait')
  })

  it('is bien within the wide window', () => {
    expect(timingJudgement(PERFECT_WINDOW_MS + 1)).toBe('bien')
    expect(timingJudgement(-GOOD_WINDOW_MS)).toBe('bien')
  })

  it('is null beyond the wide window', () => {
    expect(timingJudgement(GOOD_WINDOW_MS + 1)).toBeNull()
    expect(timingJudgement(-GOOD_WINDOW_MS - 1)).toBeNull()
  })
})

describe('noteInWindow', () => {
  const notes = [heroNote(1, 1), heroNote(2, 2), heroNote(3, 3, null)]

  it('finds the note being played now', () => {
    expect(noteInWindow(notes, new Set(), 2.1, clock)?.id).toBe(2)
  })

  it('accepts both early and late presses inside the window', () => {
    expect(noteInWindow(notes, new Set(), 1.8, clock)?.id).toBe(2)
    expect(noteInWindow(notes, new Set(), 2.15, clock)?.id).toBe(2)
  })

  it('finds nothing between notes', () => {
    expect(noteInWindow(notes, new Set(), 1.5, clock)).toBeNull()
  })

  it('skips judged notes and rests', () => {
    expect(noteInWindow(notes, new Set([2]), 2, clock)).toBeNull()
    expect(noteInWindow(notes, new Set(), 3, clock)).toBeNull()
  })

  it('picks the earliest when windows overlap at a fast tempo', () => {
    const fast = createBeatClock(0, 0, 240)
    const close = [heroNote(1, 1), heroNote(2, 1.5)]
    expect(noteInWindow(close, new Set(), 1.25, fast)?.id).toBe(1)
  })

  it('scales the window with the tempo', () => {
    const slow = createBeatClock(0, 0, 30)
    expect(noteInWindow([heroNote(1, 1)], new Set(), 1.2, slow)).toBeNull()
  })
})

describe('expiredNotes', () => {
  const notes = [heroNote(1, 1), heroNote(2, 2), heroNote(3, 3, null)]

  it('lists unjudged notes whose window has closed', () => {
    expect(expiredNotes(notes, new Set(), 2.15, clock).map((note) => note.id)).toEqual([1])
  })

  it('keeps a note until its window is over', () => {
    expect(expiredNotes(notes, new Set(), 1.2, clock)).toEqual([])
  })

  it('ignores judged notes and rests', () => {
    expect(expiredNotes(notes, new Set([1]), 5, clock).map((note) => note.id)).toEqual([2])
  })
})
