import type { Difficulty } from '../music/generator'

export const MAX_LIVES = 3
export const SURVIVAL_DELAYS = [3, 5] as const
export type SurvivalDelay = (typeof SURVIVAL_DELAYS)[number]
export const DEFAULT_SURVIVAL_DELAY: SurvivalDelay = 5

export const NOTES_PER_LEVEL = 20
export const MAX_DIFFICULTY = 5

export interface SurvivalState {
  lives: number
  score: number
  /** Notes shown so far, hit, missed or timed out. */
  played: number
}

export const INITIAL_SURVIVAL: SurvivalState = { lives: MAX_LIVES, score: 0, played: 0 }

/** Difficulty of the note shown at rank `index`, whatever the player hit before. */
export function difficultyFor(index: number): Difficulty {
  return Math.min(MAX_DIFFICULTY, 1 + Math.floor(index / NOTES_PER_LEVEL)) as Difficulty
}

export function isOver({ lives }: SurvivalState): boolean {
  return lives <= 0
}

export function resolveNote(state: SurvivalState, correct: boolean): SurvivalState {
  return {
    lives: correct ? state.lives : state.lives - 1,
    score: state.score + (correct ? 1 : 0),
    played: state.played + 1,
  }
}

export function timeOut(state: SurvivalState): SurvivalState {
  return resolveNote(state, false)
}

export function isNoteExpired(elapsedMs: number, delayS: SurvivalDelay): boolean {
  return elapsedMs >= delayS * 1000
}

export function remainingShare(elapsedMs: number, delayS: SurvivalDelay): number {
  return Math.min(1, Math.max(0, 1 - elapsedMs / (delayS * 1000)))
}

/** Share of played notes that were hit, as a whole percentage. */
export function precision({ score, played }: SurvivalState): number {
  return played === 0 ? 0 : Math.round((score / played) * 100)
}
