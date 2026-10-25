import { learnKeyChipLabel, learnKeyPlan } from '../game/learnKey'
import { createLearnSampler, type LearnKeyPlan } from '../game/runs'
import { buildPool, promptId, recordAnswer } from '../game/sampler'
import { isCorrectAnswer, recordExactPitch } from '../game/strictOctave'
import { midi, noteName } from '../music/notes'
import type { Settings } from '../storage'
import { createDrillGame, type Drill, type DrillOptions, type Game } from './drillGame'
import { renderStaff } from './staff'

const NEXT_DELAY_WRONG_MS = 900

export interface GameOptions extends DrillOptions {
  /** The key chip was tapped; the flag says whether a chrono is running. */
  onEditKey: (chronoRunning: boolean) => void
}
export type { Game }

function learnDrill(settings: Settings, plan: LearnKeyPlan, onEditKey: GameOptions['onEditKey']): Drill {
  const pool = buildPool(settings.clefs, settings.accidentals)
  const sampler = createLearnSampler(settings.clefs, settings.accidentals, Math.random, plan)
  return {
    hudChip: { label: learnKeyChipLabel(plan), onTap: onEditKey },
    strictOctave: settings.strictOctave,
    wrongDelayMs: NEXT_DELAY_WRONG_MS,
    bestTimed: (progress) => progress.bestTimed,
    withBestTimed: (correct) => ({ bestTimed: correct }),
    next(progress) {
      const { prompt, note, fifths, keyChanged } = sampler.next(pool, progress.notes)
      const staff = renderStaff(prompt.clef, note, fifths)
      if (keyChanged) staff.classList.add('key-changed')
      return {
        staff,
        padTarget: { clef: prompt.clef, pitch: prompt.pitch },
        keyPitch: midi(note),
        isCorrect: (chosen) => isCorrectAnswer(prompt.pitch, chosen),
        sounding: note,
        correctText: noteName(note, settings.naming),
        wrongText: `C’était ${noteName(note, settings.naming)}`,
        record: (current, correct, elapsed) => ({
          notes: recordAnswer(current.notes, promptId(prompt), correct, elapsed),
          pitches: recordExactPitch(current.pitches, prompt.pitch, correct, settings.strictOctave),
        }),
      }
    },
  }
}

export function createGame(options: GameOptions): Game {
  return createDrillGame(options, learnDrill(options.settings, learnKeyPlan(options.settings), options.onEditKey))
}
