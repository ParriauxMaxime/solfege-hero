import { MAX_FIFTHS, keyTonicPitchClass, type KeyQuality } from '../music/keySignature'
import type { Clef } from '../music/notes'
import { signatureWeight } from '../level/level'
import { noteWeight, type NoteStats } from './sampler'

export const KEYS_MODES = ['major', 'minor', 'both'] as const
export type KeysMode = (typeof KEYS_MODES)[number]

export const ALL_SIGNATURES: readonly number[] = Array.from({ length: 2 * MAX_FIFTHS + 1 }, (_, index) => MAX_FIFTHS - index)

const MIN_KEYS_REACH = 1

export interface KeyPrompt {
  fifths: number
  clef: Clef
  ask: KeyQuality
}

export interface KeysSampler {
  next: (stats: NoteStats) => KeyPrompt
}

export function keyStatsId(fifths: number): string {
  return String(fifths)
}

export function keyAnswerPitchClass(prompt: KeyPrompt): number {
  return keyTonicPitchClass(prompt.fifths, prompt.ask)
}

function pickAsk(mode: KeysMode, random: () => number): KeyQuality {
  if (mode !== 'both') return mode
  return random() < 0.5 ? 'major' : 'minor'
}

/** Adaptive: a signature is as likely as its misses and slowness make it, and never comes twice in a row. */
export function createKeysSampler(
  clefs: readonly Clef[],
  mode: KeysMode,
  random: () => number = Math.random,
  maxFifths: number = MAX_FIFTHS,
): KeysSampler {
  let previous: number | null = null
  const capped = maxFifths < MAX_FIFTHS
  const reach = Math.max(MIN_KEYS_REACH, maxFifths)
  const signatures = capped ? ALL_SIGNATURES.filter((fifths) => Math.abs(fifths) <= reach) : ALL_SIGNATURES
  return {
    next(stats) {
      const others = signatures.filter((fifths) => fifths !== previous)
      const candidates = others.length > 0 ? others : signatures
      const weights = candidates.map(
        (fifths) => noteWeight(stats[keyStatsId(fifths)]) * (capped ? signatureWeight(fifths, reach) : 1),
      )
      let threshold = random() * weights.reduce((sum, weight) => sum + weight, 0)
      let fifths = candidates[candidates.length - 1] as number
      for (const [index, candidate] of candidates.entries()) {
        threshold -= weights[index] ?? 0
        if (threshold < 0) {
          fifths = candidate
          break
        }
      }
      previous = fifths
      return {
        fifths,
        clef: clefs[Math.floor(random() * clefs.length)] as Clef,
        ask: pickAsk(mode, random),
      }
    },
  }
}
