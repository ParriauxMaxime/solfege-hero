import type { Sound } from '../audio/sound'
import { INITIAL_SCORE, applyAnswer, multiplier, type AnswerOutcome, type ScoreState } from '../game/scoring'
import { answerPitch, type Answer } from '../game/strictOctave'
import type { Clef, Note } from '../music/notes'
import { vibrate } from '../platform/haptics'
import { recordHistory, type Progress, type Settings } from '../storage'
import { button, el } from './dom'
import { icon } from './icons'
import { burstConfetti, burstParticles, centerOf, floatText, restartAnimation } from './effects'
import { trackHiddenTime } from '../platform/visibility'
import { createAnswerPad } from './answerPad'

const TIMED_SECONDS = 60
const NEXT_DELAY_CORRECT_MS = 200

export interface DrillOptions {
  settings: Settings
  progress: Progress
  sound: Sound
  onProgress: (progress: Progress) => void
}

export interface Drill {
  historyMode: 'learn' | 'keys'
  /** Answers are exact pitches (strict octave) instead of pitch classes. */
  strictOctave: boolean
  screenClass?: string
  /** Small tappable label top-centre of the HUD. */
  hudChip?: { label: string; onTap: (chronoRunning: boolean) => void }
  wrongDelayMs: number
  next: (progress: Progress) => DrillRound
  bestTimed: (progress: Progress) => number
  withBestTimed: (correct: number) => Partial<Progress>
}

export interface DrillRound {
  staff: SVGSVGElement
  /** Prompt id in the weekly note history: `clef:midi` or `keys:<fifths>`. */
  historyId: string
  /** Lets a strict octave keyboard show the octaves around a note. */
  padTarget: { clef: Clef; pitch: number } | null
  /** The correct key: a MIDI pitch, or a pitch class. */
  keyPitch: number
  isCorrect: (chosen: Answer) => boolean
  /** Played when the answer is right. */
  sounding: Note | null
  question?: string
  correctText: string
  wrongText: string
  hint?: string
  record: (progress: Progress, correct: boolean, elapsedMs: number) => Partial<Progress>
}

export interface Game {
  element: HTMLElement
  destroy: () => void
  /** Freezes the chrono and the answer timing; the returned function resumes them. */
  hold: () => () => void
}

export function createDrillGame({ settings, progress: initialProgress, sound, onProgress }: DrillOptions, drill: Drill): Game {
  let progress = initialProgress
  let score: ScoreState = INITIAL_SCORE
  let shown: DrillRound | null = null
  let shownAt = 0
  let locked = true
  let deadline: number | null = null
  let nextTimeout = 0
  let ticker = 0
  let heldAt: number | null = null
  let holds = 0
  let releaseRotation: (() => void) | null = null

  const scoreValue = el('span', 'hud-value', '0')
  const streakValue = el('span', 'streak-value', '0')
  const streak = el('div', 'hud-streak', el('span', 'flame', icon('flame')), streakValue)
  const multiplierValue = el('span', 'multiplier', '×1')
  const timerValue = el('span', 'timer', String(TIMED_SECONDS))
  timerValue.hidden = !settings.timed
  const chip = drill.hudChip
  const hudChip = chip ? button('hud-chip', chip.label, () => chip.onTap(deadline !== null)) : null
  hudChip?.setAttribute('aria-label', `Armure : ${chip?.label ?? ''}. Modifier`)
  const hud = hudChip
    ? el('div', 'hud with-chip', el('div', 'hud-score', scoreValue), hudChip, el('div', 'hud-right', streak, multiplierValue, timerValue))
    : el('div', 'hud', el('div', 'hud-score', scoreValue), streak, multiplierValue, timerValue)

  const staffCard = el('div', 'staff-card')
  const feedback = el('div', 'feedback')
  const pad = createAnswerPad(submitAnswer, settings.naming, settings.keyboardSpan, {
    strictOctave: drill.strictOctave,
    onBlockedChange: holdWhileBlocked,
  })
  const flash = el('div', 'flash')
  const effectsLayer = el('div', 'effects-layer')
  const element = el('section', `screen game ${drill.screenClass ?? ''}`.trim(), hud, staffCard, feedback, pad.element, flash, effectsLayer)

  function showNext(): void {
    shown = drill.next(progress)
    staffCard.replaceChildren(shown.staff)
    feedback.textContent = shown.question ?? ''
    feedback.className = shown.question ? 'feedback ask' : 'feedback'
    if (shown.padTarget) pad.setTarget(shown.padTarget.clef, shown.padTarget.pitch)
    pad.clear()
    shownAt = clockMs()
    locked = false
  }

  function clockMs(): number {
    return heldAt ?? performance.now()
  }

  function hold(): () => void {
    if (holds++ === 0) heldAt = performance.now()
    let released = false
    return () => {
      if (released) return
      released = true
      if (--holds > 0 || heldAt === null) return
      const heldMs = performance.now() - heldAt
      shownAt += heldMs
      if (deadline !== null) deadline += heldMs
      heldAt = null
    }
  }

  function holdWhileBlocked(blocked: boolean): void {
    if (blocked) {
      releaseRotation ??= hold()
      return
    }
    releaseRotation?.()
    releaseRotation = null
  }

  function startRound(): void {
    score = INITIAL_SCORE
    deadline = null
    window.clearInterval(ticker)
    timerValue.textContent = String(TIMED_SECONDS)
    renderScore()
    showNext()
  }

  function renderScore(): void {
    scoreValue.textContent = String(score.score)
    streakValue.textContent = String(score.streak)
    multiplierValue.textContent = `×${multiplier(score.streak)}`
    streak.classList.toggle('hot', score.streak >= 5)
  }

  function startTimer(): void {
    deadline = clockMs() + TIMED_SECONDS * 1000
    ticker = window.setInterval(tick, 100)
  }

  function tick(): void {
    const remaining = (deadline ?? 0) - clockMs()
    timerValue.textContent = String(Math.max(0, Math.ceil(remaining / 1000)))
    timerValue.classList.toggle('urgent', remaining <= 10_000)
    if (remaining <= 0) finishTimed()
  }

  function finishTimed(): void {
    window.clearInterval(ticker)
    window.clearTimeout(nextTimeout)
    locked = true
    const best = drill.bestTimed(progress)
    const record = score.correct > best
    progress = recordHistory(progress, drill.historyMode, { kind: 'game', best: score.correct })
    updateProgress(record ? drill.withBestTimed(score.correct) : {})
    element.append(resultOverlay(record, best))
  }

  function resultOverlay(record: boolean, best: number): HTMLElement {
    const overlay = el(
      'div',
      'overlay',
      el(
        'div',
        'result',
        el('h2', '', 'Temps écoulé'),
        el('p', 'result-score', String(score.correct)),
        el('p', '', score.correct > 1 ? 'bonnes réponses' : 'bonne réponse'),
        el('p', record ? 'result-record' : 'result-best', record ? 'Nouveau record !' : `Record : ${best}`),
        button('primary', 'Rejouer', () => {
          overlay.remove()
          startRound()
        }),
      ),
    )
    return overlay
  }

  function updateProgress(patch: Partial<Progress>): void {
    progress = { ...progress, ...patch }
    onProgress(progress)
  }

  function submitAnswer(chosen: Answer): void {
    if (locked || !shown) return
    locked = true
    if (settings.timed && deadline === null) startTimer()
    const answered = shown
    const correct = answered.isCorrect(chosen)
    const elapsed = clockMs() - shownAt
    const result = applyAnswer(score, correct, elapsed)
    score = result.state
    progress = recordHistory(progress, drill.historyMode, { kind: 'answer', correct, ms: elapsed, noteId: answered.historyId })
    updateProgress({
      ...answered.record(progress, correct, elapsed),
      bestStreak: Math.max(progress.bestStreak, score.bestStreak),
      totalAnswered: progress.totalAnswered + 1,
    })
    renderScore()
    if (correct) onCorrect(answered, result)
    else onWrong(chosen, answered, result.brokenStreak)
    nextTimeout = window.setTimeout(showNext, correct ? NEXT_DELAY_CORRECT_MS : drill.wrongDelayMs)
  }

  function onCorrect(round: DrillRound, { gained, milestone, speedFactor }: AnswerOutcome): void {
    sound.correct(score.streak)
    if (round.sounding) sound.playNote(round.sounding)
    vibrate(15)
    pad.flash(round.keyPitch, 'correct')
    feedback.textContent = round.correctText
    feedback.className = 'feedback ok'
    restartAnimation(flash, 'flash-ok')
    restartAnimation(streakValue, 'bump')
    const noteHead = staffCard.querySelector('.staff-note')
    const origin = centerOf(noteHead ?? staffCard.querySelector('.staff-key') ?? staffCard)
    noteHead?.classList.add('pop')
    burstParticles(effectsLayer, origin)
    floatText(effectsLayer, origin, speedFactor > 1 ? `+${gained} ×${speedFactor} rapide !` : `+${gained}`)
    if (milestone !== null) {
      sound.milestone()
      vibrate([30, 40, 30, 40, 80])
      burstConfetti(effectsLayer)
    }
  }

  function onWrong(chosen: Answer, round: DrillRound, brokenStreak: number): void {
    sound.wrong()
    vibrate([40, 30, 40])
    pad.flash(answerPitch(chosen), 'wrong')
    pad.flash(round.keyPitch, 'reveal')
    feedback.textContent = round.wrongText
    if (round.hint) feedback.append(el('small', 'feedback-hint', round.hint))
    feedback.className = 'feedback bad'
    restartAnimation(flash, 'flash-bad')
    restartAnimation(staffCard, 'shake')
    if (brokenStreak > 0) {
      const dropped = el('span', 'streak-drop', String(brokenStreak))
      dropped.addEventListener('animationend', () => dropped.remove(), { once: true })
      streak.append(dropped)
    }
  }

  const stopTrackingHiddenTime = trackHiddenTime((hiddenMs) => {
    shownAt += hiddenMs
    if (deadline !== null) deadline += hiddenMs
  })
  startRound()
  if (pad.isBlocked()) holdWhileBlocked(true)

  return {
    element,
    hold,
    destroy() {
      stopTrackingHiddenTime()
      pad.destroy()
      window.clearInterval(ticker)
      window.clearTimeout(nextTimeout)
    },
  }
}
