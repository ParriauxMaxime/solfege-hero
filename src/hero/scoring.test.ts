import { describe, expect, it } from 'vitest'
import { INITIAL_HERO_SCORE, applyJudgement, heroSummary, type HeroScore } from './scoring'
import type { Judgement } from './types'

describe('heroSummary', () => {
  it('reports the totals and the share of perfect hits', () => {
    const state: HeroScore = { score: 340, streak: 0, bestStreak: 9, hits: 8, misses: 2, perfects: 6 }
    expect(heroSummary(state)).toEqual({ score: 340, hits: 8, misses: 2, perfects: 6, parfaitRatio: 0.75 })
  })

  it('has a zero ratio when nothing was hit', () => {
    expect(heroSummary({ ...INITIAL_HERO_SCORE, misses: 3 }).parfaitRatio).toBe(0)
  })
})

function judgeAll(judgement: Judgement, count: number, state: HeroScore = INITIAL_HERO_SCORE) {
  let outcome = applyJudgement(state, judgement)
  for (let i = 1; i < count; i++) outcome = applyJudgement(outcome.state, judgement)
  return outcome
}

describe('applyJudgement', () => {
  it('awards 10 for a bien and 20 for a parfait', () => {
    expect(applyJudgement(INITIAL_HERO_SCORE, 'bien').gained).toBe(10)
    expect(applyJudgement(INITIAL_HERO_SCORE, 'parfait').gained).toBe(20)
  })

  it('tracks hits, perfects and the streak', () => {
    const { state } = judgeAll('parfait', 2, applyJudgement(INITIAL_HERO_SCORE, 'bien').state)
    expect(state).toMatchObject({ hits: 3, perfects: 2, streak: 3, bestStreak: 3, misses: 0 })
    expect(state.score).toBe(10 + 20 + 20)
  })

  it('multiplies by the multiplier of the new streak', () => {
    const outcome = judgeAll('bien', 5)
    expect(outcome.gained).toBe(20)
    expect(judgeAll('parfait', 5).gained).toBe(40)
  })

  it('reports milestones only when reached', () => {
    expect(judgeAll('bien', 4).milestone).toBeNull()
    expect(judgeAll('bien', 5).milestone).toBe(5)
  })

  it('breaks the streak on a rate and reports it', () => {
    const { state } = judgeAll('bien', 7)
    const outcome = applyJudgement(state, 'rate')
    expect(outcome.gained).toBe(0)
    expect(outcome.brokenStreak).toBe(7)
    expect(outcome.milestone).toBeNull()
    expect(outcome.state).toEqual({ ...state, streak: 0, misses: 1 })
  })

  it('keeps the best streak after a rate', () => {
    const rate = applyJudgement(judgeAll('bien', 6).state, 'rate')
    expect(applyJudgement(rate.state, 'bien').state.bestStreak).toBe(6)
  })
})
