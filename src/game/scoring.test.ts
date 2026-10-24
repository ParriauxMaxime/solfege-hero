import { describe, expect, it } from 'vitest'
import { INITIAL_SCORE, applyAnswer, multiplier, speedFactor, type ScoreState } from './scoring'

const SLOW = 3000

function answerAll(count: number, ms = SLOW, state: ScoreState = INITIAL_SCORE) {
  let outcome = applyAnswer(state, true, ms)
  for (let i = 1; i < count; i++) outcome = applyAnswer(outcome.state, true, ms)
  return outcome
}

describe('multiplier', () => {
  it('grows every five in a row and caps at five', () => {
    expect([0, 4, 5, 9, 10, 19, 20, 100].map(multiplier)).toEqual([1, 1, 2, 2, 3, 4, 5, 5])
  })
})

describe('speedFactor', () => {
  it('doubles under a second, adds half under two seconds, else nothing', () => {
    expect([0, 999, 1000, 1999, 2000, 9000].map(speedFactor)).toEqual([2, 2, 1.5, 1.5, 1, 1])
  })
})

describe('applyAnswer', () => {
  it('awards ten points for a slow first correct answer', () => {
    const outcome = applyAnswer(INITIAL_SCORE, true, SLOW)
    expect(outcome.gained).toBe(10)
    expect(outcome.speedFactor).toBe(1)
    expect(outcome.state).toEqual({ score: 10, streak: 1, bestStreak: 1, correct: 1, answered: 1 })
    expect(outcome.milestone).toBeNull()
    expect(outcome.brokenStreak).toBe(0)
  })

  it('applies the speed factor to the gain', () => {
    expect(applyAnswer(INITIAL_SCORE, true, 500)).toMatchObject({ gained: 20, speedFactor: 2 })
    expect(applyAnswer(INITIAL_SCORE, true, 1500)).toMatchObject({ gained: 15, speedFactor: 1.5 })
  })

  it('applies the multiplier of the new streak', () => {
    const outcome = answerAll(5)
    expect(outcome.gained).toBe(20)
    expect(outcome.state.score).toBe(4 * 10 + 20)
  })

  it('combines streak multiplier and speed factor', () => {
    expect(answerAll(5, 500).gained).toBe(40)
  })

  it('reports streak milestones only when reached', () => {
    expect(answerAll(4).milestone).toBeNull()
    expect(answerAll(5).milestone).toBe(5)
    expect(answerAll(6).milestone).toBeNull()
    expect(answerAll(10).milestone).toBe(10)
  })

  it('resets the streak on a wrong answer without a speed bonus', () => {
    const { state } = answerAll(7)
    const outcome = applyAnswer(state, false, 100)
    expect(outcome.gained).toBe(0)
    expect(outcome.speedFactor).toBe(1)
    expect(outcome.brokenStreak).toBe(7)
    expect(outcome.milestone).toBeNull()
    expect(outcome.state).toEqual({ ...state, streak: 0, answered: 8 })
  })

  it('keeps the best streak after a miss', () => {
    const missed = applyAnswer(answerAll(6).state, false, SLOW)
    expect(applyAnswer(missed.state, true, SLOW).state.bestStreak).toBe(6)
  })

  it('does not mutate the previous state', () => {
    const before = { ...INITIAL_SCORE }
    applyAnswer(INITIAL_SCORE, true, SLOW)
    expect(INITIAL_SCORE).toEqual(before)
  })
})
