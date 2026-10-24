export const STREAK_MILESTONES = [5, 10, 25, 50] as const

export interface ScoreState {
  score: number
  streak: number
  bestStreak: number
  correct: number
  answered: number
}

export const INITIAL_SCORE: ScoreState = {
  score: 0,
  streak: 0,
  bestStreak: 0,
  correct: 0,
  answered: 0,
}

const POINTS_PER_ANSWER = 10
const STREAK_PER_MULTIPLIER = 5
const MAX_MULTIPLIER = 5
const FAST_MS = 1000
const QUICK_MS = 2000

export function multiplier(streak: number): number {
  return Math.min(MAX_MULTIPLIER, 1 + Math.floor(streak / STREAK_PER_MULTIPLIER))
}

export function speedFactor(ms: number): number {
  if (ms < FAST_MS) return 2
  if (ms < QUICK_MS) return 1.5
  return 1
}

export interface AnswerOutcome {
  state: ScoreState
  gained: number
  speedFactor: number
  milestone: number | null
  brokenStreak: number
}

export function applyAnswer(state: ScoreState, correct: boolean, ms: number): AnswerOutcome {
  const answered = state.answered + 1
  if (!correct) {
    return {
      state: { ...state, streak: 0, answered },
      gained: 0,
      speedFactor: 1,
      milestone: null,
      brokenStreak: state.streak,
    }
  }

  const streak = state.streak + 1
  const bonus = speedFactor(ms)
  const gained = Math.round(POINTS_PER_ANSWER * multiplier(streak) * bonus)
  return {
    state: {
      score: state.score + gained,
      streak,
      bestStreak: Math.max(state.bestStreak, streak),
      correct: state.correct + 1,
      answered,
    },
    gained,
    speedFactor: bonus,
    milestone: STREAK_MILESTONES.find((milestone) => milestone === streak) ?? null,
    brokenStreak: 0,
  }
}
