import { pickPrompt, type NoteStats, type Prompt } from './sampler'
import { HIGHEST_STEP, LOWEST_STEP, pitchClass, spell, staffStep, type Clef, type Note } from '../music/notes'
import { randomKey, spellInKey } from '../music/keySignature'

export const RUN_LENGTHS: readonly number[] = [4, 5]

/** How many prompts a clef and key signature stay put: 4 or 5. */
export function runLength(random: () => number): number {
  return RUN_LENGTHS[Math.floor(random() * RUN_LENGTHS.length)] as number
}

/** The note as written under `fifths` on the clef's staff, or null when that key cannot write it there. */
export function writeInKey(pitch: number, clef: Clef, fifths: number): Note | null {
  const note = spellInKey(pitch, fifths)
  if (!note) return null
  const step = staffStep(note, clef)
  return step >= LOWEST_STEP && step <= HIGHEST_STEP ? note : null
}

export interface LearnPrompt {
  prompt: Prompt
  note: Note
  fifths: number
  keyChanged: boolean
}

export interface LearnSampler {
  next: (pool: Prompt[], stats: NoteStats) => LearnPrompt
}

export type LearnKeyPlan =
  | { mode: 'random'; runLength: 'short' | number }
  | { mode: 'fixed'; fifths: number }

export const DEFAULT_KEY_PLAN: LearnKeyPlan = { mode: 'random', runLength: 'short' }

/**
 * One-note sampler for Apprendre: the clef holds for 4 or 5 prompts, the key signature
 * for the plan's run length (or forever when fixed), and the sounding pitch class never
 * repeats, whatever the clef or the spelling.
 */
export function createLearnSampler(
  clefs: readonly Clef[],
  armures: boolean,
  random: () => number = Math.random,
  plan: LearnKeyPlan = DEFAULT_KEY_PLAN,
): LearnSampler {
  let clefRun: { clef: Clef; remaining: number } | null = null
  let keyRun: { fifths: number; remaining: number } | null = null
  let previous: Prompt | null = null
  const withKeys = armures || plan.mode === 'fixed'

  function drawKey(): number {
    let fifths: number
    do fifths = randomKey(random)
    while (fifths === keyRun?.fifths)
    return fifths
  }

  return {
    next(pool, stats) {
      const keyBefore = keyRun?.fifths ?? null
      const newClef = !clefRun || clefRun.remaining === 0
      if (!clefRun || newClef) {
        const clef = clefs[Math.floor(random() * clefs.length)] as Clef
        clefRun = { clef, remaining: runLength(random) }
      }
      if (plan.mode === 'fixed') keyRun = { fifths: plan.fifths, remaining: Infinity }
      else if (!armures) keyRun = { fifths: 0, remaining: Infinity }
      else if (!keyRun || keyRun.remaining <= 0 || (plan.runLength === 'short' && newClef)) {
        keyRun = { fifths: drawKey(), remaining: plan.runLength === 'short' ? clefRun.remaining : plan.runLength }
      }
      const { clef } = clefRun
      const { fifths } = keyRun
      const writable = pool.filter((prompt) => prompt.clef === clef && (!withKeys || writeInKey(prompt.pitch, prompt.clef, fifths)))
      const usable = writable.length > 0 ? writable : pool
      const fresh = usable.filter(
        (prompt) => previous === null || pitchClass(prompt.pitch) !== pitchClass(previous.pitch),
      )
      const prompt = pickPrompt(fresh.length > 0 ? fresh : usable, stats, null, random)
      const note = withKeys
        ? (writeInKey(prompt.pitch, prompt.clef, fifths) ?? spell(prompt.pitch, fifths < 0))
        : spell(prompt.pitch, false)
      clefRun = { clef, remaining: clefRun.remaining - 1 }
      keyRun = { fifths, remaining: keyRun.remaining - 1 }
      previous = prompt
      return {
        prompt,
        note,
        fifths: withKeys ? fifths : 0,
        keyChanged: keyBefore !== null && keyBefore !== fifths,
      }
    },
  }
}
