import type { Sound } from '../audio/sound'
import { INITIAL_SCORE, applyAnswer, multiplier, type AnswerOutcome, type ScoreState } from '../game/scoring'
import { buildPool, pickPrompt, promptId, recordAnswer, type Prompt } from '../game/sampler'
import {
  PITCH_CLASS_NAMES,
  isNatural,
  midi,
  noteName,
  pitchClass,
  spell,
  type Note,
} from '../music/notes'
import { vibrate } from '../platform/haptics'
import type { Progress, Settings } from '../storage'
import { button, el } from './dom'
import { burstConfetti, burstParticles, centerOf, floatText, restartAnimation } from './effects'
import { renderStaff } from './staff'

const TIMED_SECONDS = 60
const NEXT_DELAY_CORRECT_MS = 200
const NEXT_DELAY_WRONG_MS = 900
const NATURAL_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11]
const KEY_LETTERS = 'cdefgab'

export interface GameOptions {
  settings: Settings
  progress: Progress
  sound: Sound
  onProgress: (progress: Progress) => void
}

export interface Game {
  element: HTMLElement
  destroy: () => void
}

interface ShownPrompt {
  prompt: Prompt
  note: Note
}

function createAnswerButton(name: string, pitchClassIndex: number, onAnswer: (pitchClass: number) => void): HTMLButtonElement {
  const answer = button('answer', '', () => onAnswer(pitchClassIndex))
  answer.append(...name.split('/').map((part) => el('span', '', part)))
  const naturalIndex = NATURAL_PITCH_CLASSES.indexOf(pitchClassIndex)
  if (naturalIndex >= 0) {
    answer.style.gridArea = `2 / ${1 + naturalIndex * 2} / auto / span 2`
  } else {
    const lowerNaturalIndex = NATURAL_PITCH_CLASSES.indexOf(pitchClassIndex - 1)
    answer.classList.add('altered')
    answer.style.gridArea = `1 / ${2 + lowerNaturalIndex * 2} / auto / span 2`
  }
  return answer
}

function pitchClassForKey(event: KeyboardEvent): number | undefined {
  const key = event.key.toLowerCase()
  const letterIndex = KEY_LETTERS.indexOf(key)
  if (letterIndex < 0) {
    const digit = Number(key)
    return digit >= 1 && digit <= 7 ? NATURAL_PITCH_CLASSES[digit - 1] : undefined
  }
  const natural = NATURAL_PITCH_CLASSES[letterIndex] as number
  if (!event.shiftKey) return natural
  return isNatural(natural + 1) ? undefined : natural + 1
}

export function createGame({ settings, progress: initialProgress, sound, onProgress }: GameOptions): Game {
  const pool = buildPool(settings.clefs, settings.accidentals)
  let progress = initialProgress
  let score: ScoreState = INITIAL_SCORE
  let shown: ShownPrompt | null = null
  let previousId: string | null = null
  let shownAt = 0
  let locked = true
  let deadline: number | null = null
  let nextTimeout = 0
  let ticker = 0

  const scoreValue = el('span', 'hud-value', '0')
  const streakValue = el('span', 'streak-value', '0')
  const streak = el('div', 'hud-streak', el('span', 'flame', '🔥'), streakValue)
  const multiplierValue = el('span', 'multiplier', '×1')
  const timerValue = el('span', 'timer', String(TIMED_SECONDS))
  timerValue.hidden = !settings.timed
  const hud = el('div', 'hud', el('div', 'hud-score', scoreValue), streak, multiplierValue, timerValue)

  const staffCard = el('div', 'staff-card')
  const feedback = el('div', 'feedback')
  const answers = PITCH_CLASS_NAMES.map((name, index) => createAnswerButton(name, index, submitAnswer))
  const answerGrid = el('div', 'answers', ...answers)
  const flash = el('div', 'flash')
  const effectsLayer = el('div', 'effects-layer')
  const element = el('section', 'screen game', hud, staffCard, feedback, answerGrid, flash, effectsLayer)

  function showNext(): void {
    const prompt = pickPrompt(pool, progress.notes, previousId)
    const note = spell(prompt.pitch, Math.random() < 0.5)
    shown = { prompt, note }
    previousId = promptId(prompt)
    staffCard.replaceChildren(renderStaff(prompt.clef, note))
    feedback.textContent = ''
    feedback.className = 'feedback'
    for (const answer of answers) answer.classList.remove('correct', 'wrong', 'reveal')
    shownAt = performance.now()
    locked = false
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
    deadline = performance.now() + TIMED_SECONDS * 1000
    ticker = window.setInterval(tick, 100)
  }

  function tick(): void {
    const remaining = (deadline ?? 0) - performance.now()
    timerValue.textContent = String(Math.max(0, Math.ceil(remaining / 1000)))
    timerValue.classList.toggle('urgent', remaining <= 10_000)
    if (remaining <= 0) finishTimed()
  }

  function finishTimed(): void {
    window.clearInterval(ticker)
    window.clearTimeout(nextTimeout)
    locked = true
    const record = score.correct > progress.bestTimed
    if (record) updateProgress({ bestTimed: score.correct })
    element.append(resultOverlay(record))
  }

  function resultOverlay(record: boolean): HTMLElement {
    const overlay = el(
      'div',
      'overlay',
      el(
        'div',
        'result',
        el('h2', '', 'Temps écoulé'),
        el('p', 'result-score', String(score.correct)),
        el('p', '', score.correct > 1 ? 'bonnes réponses' : 'bonne réponse'),
        el('p', record ? 'result-record' : 'result-best', record ? 'Nouveau record !' : `Record : ${progress.bestTimed}`),
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

  function submitAnswer(chosen: number): void {
    if (locked || !shown) return
    locked = true
    if (settings.timed && deadline === null) startTimer()
    const answered = shown
    const correct = chosen === pitchClass(answered.prompt.pitch)
    const elapsed = performance.now() - shownAt
    const result = applyAnswer(score, correct, elapsed)
    score = result.state
    updateProgress({
      notes: recordAnswer(progress.notes, promptId(answered.prompt), correct, elapsed),
      bestStreak: Math.max(progress.bestStreak, score.bestStreak),
      totalAnswered: progress.totalAnswered + 1,
    })
    renderScore()
    if (correct) onCorrect(answered.note, result)
    else onWrong(chosen, answered.note, result.brokenStreak)
    nextTimeout = window.setTimeout(showNext, correct ? NEXT_DELAY_CORRECT_MS : NEXT_DELAY_WRONG_MS)
  }

  function onCorrect(note: Note, { gained, milestone, speedFactor }: AnswerOutcome): void {
    sound.correct(score.streak)
    sound.playNote(note)
    vibrate(15)
    answers[pitchClass(midi(note))]?.classList.add('correct')
    feedback.textContent = noteName(note)
    feedback.className = 'feedback ok'
    restartAnimation(flash, 'flash-ok')
    restartAnimation(streakValue, 'bump')
    const noteHead = staffCard.querySelector('.staff-note')
    if (noteHead) {
      noteHead.classList.add('pop')
      const origin = centerOf(noteHead)
      burstParticles(effectsLayer, origin)
      floatText(effectsLayer, origin, speedFactor > 1 ? `+${gained} ×${speedFactor} rapide !` : `+${gained}`)
    }
    if (milestone !== null) {
      sound.milestone()
      vibrate([30, 40, 30, 40, 80])
      burstConfetti(effectsLayer)
    }
  }

  function onWrong(chosen: number, note: Note, brokenStreak: number): void {
    sound.wrong()
    vibrate([40, 30, 40])
    answers[chosen]?.classList.add('wrong')
    answers[pitchClass(midi(note))]?.classList.add('reveal')
    feedback.textContent = `C'était ${noteName(note)}`
    feedback.className = 'feedback bad'
    restartAnimation(flash, 'flash-bad')
    restartAnimation(staffCard, 'shake')
    if (brokenStreak > 0) {
      const dropped = el('span', 'streak-drop', String(brokenStreak))
      dropped.addEventListener('animationend', () => dropped.remove(), { once: true })
      streak.append(dropped)
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
    const chosen = pitchClassForKey(event)
    if (chosen !== undefined) submitAnswer(chosen)
  }

  document.addEventListener('keydown', onKeyDown)
  startRound()

  return {
    element,
    destroy() {
      document.removeEventListener('keydown', onKeyDown)
      window.clearInterval(ticker)
      window.clearTimeout(nextTimeout)
    },
  }
}
