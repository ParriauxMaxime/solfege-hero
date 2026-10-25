import type { Difficulty } from '../music/generator'

/** Fastest automatic tempo for each difficulty level. */
export const TEMPO_CAP: Record<Difficulty, number> = { 1: 72, 2: 90, 3: 110, 4: 140, 5: 200 }

const CLEAN_NOTES_PER_LEVEL = 16
const MISSES_PER_DROP = 3
const MIN_LEVEL = 1
const MAX_LEVEL = 5

export interface DifficultyState {
  level: Difficulty
  /** Consecutive notes hit since the last miss or level change. */
  cleanRun: number
  /** Misses in the bar `bar`. */
  missesInBar: number
  bar: number
}

export const INITIAL_DIFFICULTY: DifficultyState = { level: 1, cleanRun: 0, missesInBar: 0, bar: -1 }

const clampLevel = (level: number) => Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level)) as Difficulty

/** Rising stops at `maxLevel` (the player level's cap); a miss streak still lowers the level. */
export function onJudgement(
  state: DifficultyState,
  hit: boolean,
  bar: number,
  maxLevel: Difficulty = 5,
): DifficultyState {
  const missesInBar = bar === state.bar ? state.missesInBar : 0

  if (hit) {
    const cleanRun = state.cleanRun + 1
    if (cleanRun < CLEAN_NOTES_PER_LEVEL) return { ...state, cleanRun, missesInBar, bar }
    const risen = Math.min(clampLevel(state.level + 1), Math.max(maxLevel, state.level)) as Difficulty
    return { level: risen, cleanRun: 0, missesInBar, bar }
  }

  const misses = missesInBar + 1
  if (misses < MISSES_PER_DROP) return { ...state, cleanRun: 0, missesInBar: misses, bar }
  return { level: clampLevel(state.level - 1), cleanRun: 0, missesInBar: 0, bar }
}
