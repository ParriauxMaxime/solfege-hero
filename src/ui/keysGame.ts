import { createKeysSampler, keyAnswerPitchClass, keyStatsId, type KeyPrompt } from '../game/keysSampler'
import { recordAnswer } from '../game/sampler'
import { keyFullName, keyMnemonic, type KeyQuality } from '../music/keySignature'
import type { Settings } from '../storage'
import { createDrillGame, type Drill, type DrillOptions, type DrillRound, type Game } from './drillGame'
import { renderKeySignatureStaff } from './staff'

const WRONG_DELAY_MS = 2600

const QUESTIONS: Record<KeyQuality, string> = { major: 'Gamme majeure ?', minor: 'Relatif mineur ?' }

type Naming = Settings['naming']

/** What the player should have answered, the relative minor too when both are in play. */
function revealText({ fifths, ask }: KeyPrompt, mode: Settings['keysMode'], naming: Naming): string {
  const major = keyFullName(fifths, 'major', naming)
  const minor = keyFullName(fifths, 'minor', naming)
  if (mode === 'both') return ask === 'major' ? `${major} · relatif ${minor}` : `${minor} · relatif de ${major}`
  return ask === 'major' ? major : minor
}

function hintText({ fifths, ask }: KeyPrompt, naming: Naming): string {
  const mnemonic = keyMnemonic(fifths, naming)
  return ask === 'major' ? mnemonic : `${keyFullName(fifths, 'major', naming)} : ${mnemonic}`
}

function keysDrill(settings: Settings): Drill {
  const sampler = createKeysSampler(settings.clefs, settings.keysMode)
  return {
    strictOctave: false,
    screenClass: 'keys-game',
    wrongDelayMs: WRONG_DELAY_MS,
    bestTimed: (progress) => progress.keysBestTimed,
    withBestTimed: (correct) => ({ keysBestTimed: correct }),
    next(progress): DrillRound {
      const prompt = sampler.next(progress.keys)
      const answer = keyAnswerPitchClass(prompt)
      return {
        staff: renderKeySignatureStaff(prompt.clef, prompt.fifths),
        padTarget: null,
        keyPitch: answer,
        isCorrect: (chosen) => chosen.pitchClass === answer,
        sounding: null,
        question: QUESTIONS[prompt.ask],
        correctText: keyFullName(prompt.fifths, prompt.ask, settings.naming),
        wrongText: revealText(prompt, settings.keysMode, settings.naming),
        hint: hintText(prompt, settings.naming),
        record: (current, correct, elapsed) => ({
          keys: recordAnswer(current.keys, keyStatsId(prompt.fifths), correct, elapsed),
        }),
      }
    },
  }
}

export function createKeysGame(options: DrillOptions): Game {
  return createDrillGame(options, keysDrill(options.settings))
}
