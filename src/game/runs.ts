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

export interface LearnRun {
  clef: Clef
  fifths: number
  remaining: number
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

/**
 * One-note sampler for Apprendre: clef and key signature hold for 4 or 5 prompts,
 * and the sounding pitch class never repeats, whatever the clef or the spelling.
 */
export function createLearnSampler(
  clefs: readonly Clef[],
  armures: boolean,
  random: () => number = Math.random,
): LearnSampler {
  let run: LearnRun | null = null
  let previous: Prompt | null = null

  function startRun(): LearnRun {
    const clef = clefs[Math.floor(random() * clefs.length)] as Clef
    let fifths = 0
    if (armures) {
      do fifths = randomKey(random)
      while (fifths === run?.fifths)
    }
    return { clef, fifths, remaining: runLength(random) }
  }

  return {
    next(pool, stats) {
      const keyBefore: number | null = run?.fifths ?? null
      if (!run || run.remaining === 0) run = startRun()
      const current = run
      const writable = pool.filter(
        (prompt) => prompt.clef === current.clef && (!armures || writeInKey(prompt.pitch, prompt.clef, current.fifths)),
      )
      const usable = writable.length > 0 ? writable : pool
      const fresh = usable.filter(
        (prompt) => previous === null || pitchClass(prompt.pitch) !== pitchClass(previous.pitch),
      )
      const prompt = pickPrompt(fresh.length > 0 ? fresh : usable, stats, null, random)
      const note = armures
        ? (writeInKey(prompt.pitch, prompt.clef, current.fifths) ?? spell(prompt.pitch, current.fifths < 0))
        : spell(prompt.pitch, false)
      run = { ...current, remaining: current.remaining - 1 }
      previous = prompt
      return {
        prompt,
        note,
        fifths: armures ? current.fifths : 0,
        keyChanged: keyBefore !== null && keyBefore !== current.fifths,
      }
    },
  }
}
