import { describe, expect, it } from 'vitest'
import { pitchesInRange } from '../music/notes'
import {
  STRICT_WINDOW_SEMITONES,
  answerPitch,
  defaultWindowStart,
  exactPitchLabel,
  isCorrectAnswer,
  mostMissedPitches,
  nearestPitchInWindow,
  recordExactPitch,
  windowStartFor,
} from './strictOctave'

describe('isCorrectAnswer', () => {
  it('compares the pitch class when no exact pitch is pressed', () => {
    expect(isCorrectAnswer(61, { pitchClass: 1, pitch: null })).toBe(true)
    expect(isCorrectAnswer(73, { pitchClass: 1, pitch: null })).toBe(true)
    expect(isCorrectAnswer(61, { pitchClass: 2, pitch: null })).toBe(false)
  })

  it('demands the exact pitch in strict mode, enharmonics being the same pitch', () => {
    expect(isCorrectAnswer(61, { pitchClass: 1, pitch: 61 })).toBe(true)
    expect(isCorrectAnswer(61, { pitchClass: 1, pitch: 73 })).toBe(false)
    expect(isCorrectAnswer(61, { pitchClass: 1, pitch: 49 })).toBe(false)
  })

  it('flashes on the exact pitch when there is one, else the pitch class', () => {
    expect(answerPitch({ pitchClass: 1, pitch: 73 })).toBe(73)
    expect(answerPitch({ pitchClass: 1, pitch: null })).toBe(1)
  })
})

describe('windowStartFor', () => {
  it('starts on a Do and is the default window for notes inside it', () => {
    expect(defaultWindowStart('treble')).toBe(60)
    expect(defaultWindowStart('bass')).toBe(36)
    expect(defaultWindowStart('alto')).toBe(48)
    expect(windowStartFor('treble', 60)).toBe(60)
    expect(windowStartFor('treble', 83)).toBe(60)
  })

  it('shifts by octaves when the note falls outside the default window', () => {
    expect(windowStartFor('treble', 57)).toBe(48)
    expect(windowStartFor('treble', 84)).toBe(72)
    expect(windowStartFor('bass', 64)).toBe(48)
    expect(windowStartFor('alto', 47)).toBe(36)
    expect(windowStartFor('alto', 74)).toBe(60)
  })

  it('keeps the current window while it still shows the note', () => {
    expect(windowStartFor('treble', 70, 48)).toBe(48)
    expect(windowStartFor('treble', 72, 48)).toBe(60)
  })

  it('shows every pitch of every clef range', () => {
    for (const clef of ['treble', 'bass', 'alto'] as const) {
      for (const pitch of pitchesInRange(clef, true)) {
        const start = windowStartFor(clef, pitch)
        expect(start % 12).toBe(0)
        expect(pitch).toBeGreaterThanOrEqual(start)
        expect(pitch).toBeLessThan(start + STRICT_WINDOW_SEMITONES)
      }
    }
  })
})

describe('nearestPitchInWindow', () => {
  it('picks the octave of the window closest to the target', () => {
    expect(nearestPitchInWindow(60, 0, 62)).toBe(60)
    expect(nearestPitchInWindow(60, 0, 79)).toBe(72)
    expect(nearestPitchInWindow(60, 11, 61)).toBe(71)
    expect(nearestPitchInWindow(60, 4, 76)).toBe(76)
  })
})

describe('exactPitchLabel', () => {
  it('names the pitch with its sharp spelling and octave', () => {
    expect(exactPitchLabel(60)).toBe('Do4')
    expect(exactPitchLabel(56)).toBe('Sol#3')
    expect(exactPitchLabel(71)).toBe('Si4')
  })
})

describe('recordExactPitch', () => {
  it('leaves the stats untouched outside strict mode', () => {
    const stats = {}
    expect(recordExactPitch(stats, 60, true, false)).toBe(stats)
  })

  it('counts attempts and successes per exact pitch', () => {
    let stats = recordExactPitch({}, 60, true, true)
    stats = recordExactPitch(stats, 60, false, true)
    stats = recordExactPitch(stats, 72, true, true)
    expect(stats).toEqual({ Do4: { attempts: 2, correct: 1 }, Do5: { attempts: 1, correct: 1 } })
  })
})

describe('mostMissedPitches', () => {
  it('lists missed pitches by success rate, then by attempts', () => {
    const stats = {
      Do4: { attempts: 4, correct: 4 },
      Re4: { attempts: 4, correct: 2 },
      Mi4: { attempts: 2, correct: 1 },
      Fa4: { attempts: 5, correct: 1 },
    }
    expect(mostMissedPitches(stats, 10).map((entry) => entry.label)).toEqual(['Fa4', 'Re4', 'Mi4'])
    expect(mostMissedPitches(stats, 1)).toHaveLength(1)
  })
})
