import { pickPrompt, type NoteStats, type Prompt } from './sampler'
import { ledgerStepRange, pitchClass, spell, staffStep, type Clef, type Note } from '../music/notes'
import { randomKey, spellInKey } from '../music/keySignature'
import { ALL_KEYS_FIFTHS, pickCappedSignature, type NoteCaps } from '../level/level'

export const RUN_LENGTHS: readonly number[] = [4, 5]

/** How many prompts a clef and key signature stay put: 4 or 5. */
export function runLength(random: () => number): number {
  return RUN_LENGTHS[Math.floor(random() * RUN_LENGTHS.length)] as number
}

/** The note as written under `fifths` on the clef's staff, or null when that key cannot write it there. */
export function writeInKey(pitch: number, clef: Clef, fifths: number, ledgerLines = 2): Note | null {
  const note = spellInKey(pitch, fifths)
  if (!note) return null
  const [lowest, highest] = ledgerStepRange(ledgerLines)
  const step = staffStep(note, clef)
  return step >= lowest && step <= highest ? note : null
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
 * repeats, whatever the clef or the spelling. Level caps limit the random keys, the
 * ledger lines and the inline accidentals; a fixed plan keeps its own key.
 */
export function createLearnSampler(
  clefs: readonly Clef[],
  armures: boolean,
  random: () => number = Math.random,
  plan: LearnKeyPlan = DEFAULT_KEY_PLAN,
  caps?: NoteCaps,
): LearnSampler {
  let clefRun: { clef: Clef; remaining: number } | null = null
  let keyRun: { fifths: number; remaining: number } | null = null
  let previous: Prompt | null = null
  const withKeys = armures || plan.mode === 'fixed'
  const ledgerLines = caps?.ledgerLines ?? 2
  const [lowestStep, highestStep] = ledgerStepRange(ledgerLines)
  const restrictsSpelling = caps !== undefined && (!caps.inlineAccidentals || ledgerLines < 2)

  function drawKey(): number {
    if (caps && caps.maxFifths < ALL_KEYS_FIFTHS) {
      return pickCappedSignature(caps.maxFifths, random, keyRun?.fifths ?? null)
    }
    let fifths: number
    do fifths = randomKey(random)
    while (fifths === keyRun?.fifths)
    return fifths
  }

  function isInStepRange(prompt: Prompt): boolean {
    const step = staffStep(spell(prompt.pitch, false), prompt.clef)
    return step >= lowestStep && step <= highestStep
  }

  function isPlainNatural(prompt: Prompt): boolean {
    return spell(prompt.pitch, false).alter === 0 && isInStepRange(prompt)
  }

  function isWritable(prompt: Prompt, fifths: number): boolean {
    if (withKeys) return writeInKey(prompt.pitch, prompt.clef, fifths, ledgerLines) !== null
    if (!restrictsSpelling) return true
    return caps?.inlineAccidentals ? isInStepRange(prompt) : isPlainNatural(prompt)
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
      const writable = pool.filter((prompt) => prompt.clef === clef && isWritable(prompt, fifths))
      const naturals =
        restrictsSpelling && writable.length === 0
          ? pool.filter((prompt) => prompt.clef === clef && isPlainNatural(prompt))
          : []
      const naturalFallback = naturals.length > 0
      const usable = writable.length > 0 ? writable : naturalFallback ? naturals : pool
      const fresh = usable.filter(
        (prompt) => previous === null || pitchClass(prompt.pitch) !== pitchClass(previous.pitch),
      )
      const prompt = pickPrompt(fresh.length > 0 ? fresh : usable, stats, null, random)
      const note = naturalFallback
        ? spell(prompt.pitch, false)
        : withKeys
          ? (writeInKey(prompt.pitch, prompt.clef, fifths) ?? spell(prompt.pitch, fifths < 0))
          : spell(prompt.pitch, false)
      clefRun = { clef, remaining: clefRun.remaining - 1 }
      keyRun = { fifths, remaining: keyRun.remaining - 1 }
      previous = prompt
      return {
        prompt,
        note,
        fifths: withKeys && !naturalFallback ? fifths : 0,
        keyChanged: keyBefore !== null && keyBefore !== fifths,
      }
    },
  }
}
