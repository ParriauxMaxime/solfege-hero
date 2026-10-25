import type { Sound } from '../audio/sound'
import { promptId, recordAnswer } from '../game/sampler'
import { answerPitch, isCorrectAnswer, recordExactPitch, type Answer } from '../game/strictOctave'
import { spell } from '../music/notes'
import { motionReduced } from '../platform/appearance'
import { confirmOverlay } from './confirm'
import { vibrate } from '../platform/haptics'
import { trackHiddenTime } from '../platform/visibility'
import type { SeriesItem } from '../series/series'
import { survivalChallengeUrl, survivalWon, type SurvivalConfig } from '../survival/challenge'
import {
  INITIAL_SURVIVAL,
  difficultyFor,
  isNoteExpired,
  isOver,
  precision,
  remainingShare,
  resolveNote,
  timeOut,
  type SurvivalState,
} from '../survival/game'
import { createSurvivalSequence } from '../survival/sequence'
import { noteCount, survivalShareText } from '../survival/share'
import type { Progress, Settings } from '../storage'
import { createAnswerPad } from './answerPad'
import { button, el, iconButton } from './dom'
import { burstConfetti, burstParticles, centerOf, floatText, restartAnimation } from './effects'
import { createHearts } from './hearts'
import { renderStaff } from './staff'
import { shareOrCopy } from './sharing'

const NEXT_DELAY_MS = 150
const MISS_REVEAL_MS = 900
const GAME_OVER_DELAY_MS = 1100
const COUNT_UP_MS = 600
const URGENT_SHARE = 0.25

/** The friend's score that a challenge asks to beat. */
export interface SurvivalTarget {
  score: number
}

export interface SurvivalOptions {
  settings: Settings
  config: SurvivalConfig
  challenge: SurvivalTarget | null
  progress: Progress
  sound: Sound
  onProgress: (progress: Progress) => void
  onReplay: () => void
  onRetry: () => void
  onHome: () => void
  onQuit: () => void
}

export interface Survival {
  element: HTMLElement
  /** Pauses a game in progress; false when there is nothing to pause (game over). */
  pause: () => boolean
  /** Freezes the note timer until the returned release function is called. */
  hold: () => () => void
  destroy: () => void
}

export function createSurvival({
  settings,
  config,
  challenge,
  progress: initialProgress,
  sound,
  onProgress,
  onReplay,
  onRetry,
  onHome,
  onQuit,
}: SurvivalOptions): Survival {
  const sequence = createSurvivalSequence(config)
  let progress = initialProgress
  let state: SurvivalState = INITIAL_SURVIVAL
  let item: SeriesItem | null = null
  let streak = 0
  let locked = true
  let over = false
  let shownAt = 0
  let heldAt: number | null = null
  let holds = 0
  let releaseRotation: (() => void) | null = null
  let frame = 0
  let timer = 0
  let pending: (() => void) | null = null
  let countUpFrame = 0
  let pauseOverlay: HTMLElement | null = null
  let sharing = false

  const hearts = createHearts()
  const scoreValue = el('strong', 'survival-score-value', '0')
  const level = el('span', 'survival-level')
  const pauseButton = iconButton('pause', pause, 'Pause')
  const scoreLabel = el('span', '', 'note')
  const hud = el(
    'div',
    'hud survival-hud',
    hearts.element,
    el('div', 'survival-score', scoreValue, scoreLabel),
    level,
    pauseButton,
  )
  const staffCard = el('div', 'staff-card')
  const fill = el('div', 'survival-bar-fill')
  const bar = el('div', 'survival-bar', fill)
  const pad = createAnswerPad(submitAnswer, settings.naming, settings.keyboardSpan, {
    strictOctave: settings.strictOctave,
    onBlockedChange: holdWhileBlocked,
  })
  const flash = el('div', 'flash')
  const effectsLayer = el('div', 'effects-layer')
  const element = el('section', 'screen game survival', hud, staffCard, bar, pad.element, flash, effectsLayer)

  function elapsedMs(): number {
    return (heldAt ?? performance.now()) - shownAt
  }

  function schedule(action: () => void, delayMs: number): void {
    window.clearTimeout(timer)
    pending = action
    timer = window.setTimeout(() => {
      pending = null
      action()
    }, delayMs)
  }

  function hold(): () => void {
    if (holds++ === 0) {
      heldAt = performance.now()
      window.clearTimeout(timer)
    }
    let released = false
    return () => {
      if (released) return
      released = true
      if (--holds > 0 || heldAt === null) return
      shownAt += performance.now() - heldAt
      heldAt = null
      if (pending) schedule(pending, NEXT_DELAY_MS)
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

  function renderBar(): void {
    const share = remainingShare(elapsedMs(), config.delayS)
    fill.style.transform = `scaleX(${share})`
    bar.classList.toggle('urgent', share <= URGENT_SHARE)
  }

  function tick(): void {
    if (!locked && heldAt === null) {
      renderBar()
      if (isNoteExpired(elapsedMs(), config.delayS)) onTimeout()
    }
    frame = requestAnimationFrame(tick)
  }

  function showNote(): void {
    item = sequence.noteAt(state.played)
    staffCard.replaceChildren(renderStaff(item.clef, item.note, item.fifths))
    level.textContent = `Niveau ${difficultyFor(state.played)}`
    pad.setTarget(item.clef, item.pitch)
    pad.clear()
    shownAt = performance.now()
    renderBar()
    locked = false
  }

  function submitAnswer(chosen: Answer): void {
    if (locked || heldAt !== null || !item) return
    const correct = isCorrectAnswer(item.pitch, chosen)
    const answeredInMs = elapsedMs()
    progress = {
      ...progress,
      notes: recordAnswer(progress.notes, promptId({ clef: item.clef, pitch: item.pitch }), correct, answeredInMs),
      pitches: recordExactPitch(progress.pitches, item.pitch, correct, settings.strictOctave),
      totalAnswered: progress.totalAnswered + 1,
    }
    state = resolveNote(state, correct)
    if (correct) onHit(item)
    else onMiss(chosen, 'Raté')
  }

  function onTimeout(): void {
    state = timeOut(state)
    onMiss(null, 'Trop lent')
  }

  function onHit({ pitch, fifths }: SeriesItem): void {
    locked = true
    streak++
    scoreValue.textContent = String(state.score)
    scoreLabel.textContent = state.score > 1 ? 'notes' : 'note'
    restartAnimation(scoreValue, 'bump')
    sound.correct(streak)
    sound.playNote(spell(pitch, fifths < 0))
    vibrate(15)
    pad.flash(pitch, 'correct')
    restartAnimation(flash, 'flash-ok')
    const noteHead = staffCard.querySelector('.staff-note')
    if (noteHead) {
      noteHead.classList.add('pop')
      burstParticles(effectsLayer, centerOf(noteHead))
    }
    schedule(showNote, NEXT_DELAY_MS)
  }

  function onMiss(chosen: Answer | null, label: string): void {
    locked = true
    streak = 0
    renderBar()
    sound.wrong()
    vibrate([40, 30, 40])
    if (chosen !== null) pad.flash(answerPitch(chosen), 'wrong')
    if (item) pad.flash(item.pitch, 'reveal')
    hearts.breakAt(state.lives)
    restartAnimation(staffCard, 'shake')
    restartAnimation(flash, 'flash-bad')
    floatText(effectsLayer, centerOf(staffCard), label, 'bad')
    if (isOver(state)) schedule(finish, GAME_OVER_DELAY_MS)
    else schedule(showNote, MISS_REVEAL_MS)
  }

  function finish(): void {
    over = true
    cancelAnimationFrame(frame)
    const record = state.score > progress.survival.bestScore
    const won = challenge ? survivalWon(state.score, challenge.score) : null
    const { survival } = progress
    progress = {
      ...progress,
      survival: {
        bestScore: Math.max(survival.bestScore, state.score),
        played: survival.played + 1,
        challengesWon: survival.challengesWon + (won === true ? 1 : 0),
        challengesLost: survival.challengesLost + (won === false ? 1 : 0),
      },
    }
    onProgress(progress)
    element.append(endOverlay(record, won))
  }

  function pause(): boolean {
    if (over) return false
    if (pauseOverlay) return true
    const release = hold()
    const resume = () => {
      pauseOverlay?.remove()
      pauseOverlay = null
      release()
    }
    const confirmQuit = () => {
      void confirmOverlay(element, 'Abandonner la partie en cours ?', 'Abandonner', 'Continuer').then((abandon) => {
        if (abandon) onQuit()
      })
    }
    pauseOverlay = el(
      'div',
      'overlay',
      el('div', 'result', el('h2', '', 'Pause'), button('primary', 'Reprendre', resume), button('danger', 'Quitter', confirmQuit)),
    )
    element.append(pauseOverlay)
    return true
  }

  async function share(): Promise<void> {
    if (sharing) return
    sharing = true
    try {
      const url = survivalChallengeUrl(location.origin + location.pathname, { config, score: state.score })
      await shareOrCopy(survivalShareText({ seed: config.seed, score: state.score, lives: state.lives, url }))
    } finally {
      sharing = false
    }
  }

  function countUp(target: HTMLElement, score: number): void {
    if (motionReduced() || score === 0) {
      target.textContent = String(score)
      return
    }
    const start = performance.now()
    const step = (now: number) => {
      const ratio = Math.min(1, (now - start) / COUNT_UP_MS)
      target.textContent = String(Math.round(score * ratio))
      if (ratio < 1) countUpFrame = requestAnimationFrame(step)
    }
    countUpFrame = requestAnimationFrame(step)
  }

  function verdict(won: boolean | null): HTMLElement | null {
    if (won === null || !challenge) return null
    if (won) {
      sound.milestone()
      burstConfetti(effectsLayer)
      return el('p', 'verdict win', 'Gagné !')
    }
    const gap = challenge.score - state.score
    return el('p', 'verdict lose', gap === 0 ? 'Perdu… à égalité, il en faut une de plus' : `Perdu… à ${noteCount(gap)} près`)
  }

  function versus(): HTMLElement | '' {
    if (!challenge) return ''
    return el(
      'div',
      'versus',
      el('span', 'versus-you', `Toi ${state.score}`),
      el('span', 'versus-friend', `Ami ${challenge.score}`),
    )
  }

  function endOverlay(record: boolean, won: boolean | null): HTMLElement {
    const total = el('p', 'result-score series-total', '0')
    if (challenge) total.textContent = ''
    else countUp(total, state.score)
    const recordLine =
      record && won !== false
        ? el('p', 'result-record', 'Nouveau record !')
        : el('p', 'result-best', `Meilleur score : ${progress.survival.bestScore}`)
    const actions = challenge
      ? [
          button('primary', 'Partager mon résultat', () => void share()),
          button('segment-button', 'Réessayer ce défi', onRetry),
          button('segment-button', 'Accueil', onHome),
        ]
      : [
          button('primary', 'Défier un ami', () => void share()),
          button('segment-button', 'Rejouer', onReplay),
          button('segment-button', 'Accueil', onHome),
        ]
    const card = el(
      'div',
      'result series-end',
      verdict(won) ?? el('h2', '', 'Partie terminée'),
      challenge ? versus() : total,
      el('p', '', `Précision : ${precision(state)} % (${state.score}/${state.played})`),
      recordLine,
      el('div', 'result-actions', ...actions),
    )
    card.classList.toggle('win', won === true)
    card.classList.toggle('lose', won === false)
    return el('div', 'overlay', card)
  }

  const stopTrackingHiddenTime = trackHiddenTime((hiddenMs) => {
    if (heldAt === null) shownAt += hiddenMs
  })
  showNote()
  frame = requestAnimationFrame(tick)
  if (pad.isBlocked()) holdWhileBlocked(true)

  return {
    element,
    pause,
    hold,
    destroy() {
      stopTrackingHiddenTime()
      cancelAnimationFrame(frame)
      cancelAnimationFrame(countUpFrame)
      window.clearTimeout(timer)
      pad.destroy()
    },
  }
}
