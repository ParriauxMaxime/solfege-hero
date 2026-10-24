import { STREAK_MILESTONES, multiplier } from '../game/scoring'
import type { Judgement } from './types'

export interface HeroScore {
  score: number
  streak: number
  bestStreak: number
  hits: number
  misses: number
  perfects: number
}

export const INITIAL_HERO_SCORE: HeroScore = {
  score: 0,
  streak: 0,
  bestStreak: 0,
  hits: 0,
  misses: 0,
  perfects: 0,
}

const POINTS_PER_HIT = 10
const PERFECT_FACTOR = 2

export interface HeroOutcome {
  state: HeroScore
  gained: number
  milestone: number | null
  brokenStreak: number
}

export function applyJudgement(state: HeroScore, judgement: Judgement): HeroOutcome {
  if (judgement === 'rate') {
    return {
      state: { ...state, streak: 0, misses: state.misses + 1 },
      gained: 0,
      milestone: null,
      brokenStreak: state.streak,
    }
  }

  const streak = state.streak + 1
  const perfect = judgement === 'parfait'
  const gained = POINTS_PER_HIT * multiplier(streak) * (perfect ? PERFECT_FACTOR : 1)
  return {
    state: {
      score: state.score + gained,
      streak,
      bestStreak: Math.max(state.bestStreak, streak),
      hits: state.hits + 1,
      misses: state.misses,
      perfects: state.perfects + (perfect ? 1 : 0),
    },
    gained,
    milestone: STREAK_MILESTONES.find((milestone) => milestone === streak) ?? null,
    brokenStreak: 0,
  }
}
