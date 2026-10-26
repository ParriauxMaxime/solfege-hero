import type { Sound } from '../audio/sound'
import { dictationChallengeUrl } from '../dictation/challenge'
import type { DictationConfig, DictationItem } from '../dictation/sequence'
import { motionReduced } from '../platform/appearance'
import { vibrate } from '../platform/haptics'
import { trackHiddenTime } from '../platform/visibility'
import { midi, pitchClass, pitchClassLabel, spell, type Note } from '../music/notes'
import { challengeTimeS, challengeWon } from '../series/challenge'
import { INITIAL_RUN, PENALTY_MS, answerItem, firstTryResults, penaltyMs, type SeriesRun } from '../series/series'
import { COLORBLIND_SQUARES, ceilToTenth, formatTenths, formatTenthsUp, formatTime, shareText } from '../series/share'
import { appBase } from '../share/links'
import { recordHistory, type Progress, type Settings } from '../storage'
import { createAnswerPad } from './answerPad'
import { installDemoHook } from './demoHook'
import { button, el } from './dom'
import { burstConfetti, burstParticles, centerOf, floatText, restartAnimation } from './effects'
import { icon } from './icons'
import { plural } from './plural'
import { copyLink, shareLink, shareRow } from './sharing'
import type { ChallengeTarget } from './series'
import { createTimelineStaff } from './timelineStaff'
import { showToast } from './toast'

const NOTE_SECONDS = 0.7
const REFERENCE_NOTE: Note = spell(60, false)
const REFERENCE_GAP_MS = 900
const NEXT_PAUSE_MS = 700
const UNLOCK_GRACE_MS = 250
const WRONG_FLASH_MS = 350
const COUNT_UP_MS = 600
const REPLAY_KEY = 'r'

export interface DictationOptions {
  settings: Settings
  config: DictationConfig
  items: DictationItem[]
  challenge: ChallengeTarget | null
  progress: Progress
  sound: Sound
  onProgress: (progress: Progress) => void
  onReplay: () => void
  onRetry: () => void
  onHome: () => void
}

export interface Dictation {
  element: HTMLElement
  /** Freezes the clock until the returned release function is called. */
  hold: () => () => void
  destroy: () => void
}

interface Outcome {
  totalMs: number
  penalty: number
  results: boolean[]
  record: boolean
  best: number
  replays: number
}

export function createDictation({
  settings,
  config,
  items,
  challenge,
  progress: initialProgress,
  sound,
  onProgress,
  onReplay,
  onRetry,
  onHome,
}: DictationOptions): Dictation {
  let progress = initialProgress
  let run: SeriesRun = INITIAL_RUN
  let index = 0
  let streak = 0
  let missedCurrent = false
  let locked = true
  let finished = false
  let destroyed = false
  let begun = false
  let replays = 0
  let displayed = -1
  let startedAt: number | null = null
  let shownAt = 0
  let heldAt: number | null = null
  let holds = 0
  let frame = 0
  let countUpFrame = 0
  let wrongTimeout = 0
  let sharing = false
  let releaseRotation: (() => void) | null = null
  const timers = new Set<number>()

  const timerValue = el('span', 'series-timer', '0:00.0')
  const counter = el('span', 'series-count', `1/${items.length}`)
  const bar = el('div', 'progress-fill')
  const replayButton = button('dictation-replay', '', replay)
  replayButton.append(icon('replay'), el('span', '', 'Réécouter'))
  replayButton.disabled = true
  const hud = el('div', 'hud series-hud', counter, timerValue, replayButton, el('div', 'progress', bar))
  const timeline = createTimelineStaff({ maxFifths: Math.abs(items[0]?.fifths ?? 0) })
  const staffCard = el('div', 'staff-card', timeline.element)
  const pad = createAnswerPad(submitAnswer, settings.naming, settings.keyboardSpan, { onBlockedChange: holdWhileBlocked })
  const flash = el('div', 'flash')
  const effectsLayer = el('div', 'effects-layer')
  const element = el('section', 'screen game series dictation', hud, staffCard, pad.element, flash, effectsLayer)

  function later(action: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      timers.delete(id)
      action()
    }, ms)
    timers.add(id)
  }

  function elapsedMs(): number {
    return startedAt === null ? 0 : (heldAt ?? performance.now()) - startedAt
  }

  function shift(ms: number): void {
    if (startedAt === null) return
    startedAt += ms
    shownAt += ms
  }

  function hold(): () => void {
    if (holds++ === 0) heldAt = performance.now()
    let released = false
    return () => {
      if (released) return
      released = true
      if (--holds > 0 || heldAt === null) return
      shift(performance.now() - heldAt)
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

  function renderTimer(): void {
    const totalMs = elapsedMs() + penaltyMs(run)
    timerValue.textContent = `${formatTime(totalMs)}.${Math.floor(totalMs / 100) % 10}`
  }

  function tick(): void {
    renderTimer()
    frame = requestAnimationFrame(tick)
  }

  function playCurrent(): void {
    const item = items[index]
    if (item) sound.playNote(item.note, NOTE_SECONDS)
  }

  function displayItem(): void {
    const item = items[index]
    if (!item || displayed === index) return
    displayed = index
    timeline.setCurrent(index, item, { hidden: true })
  }

  function showItem(): void {
    displayItem()
    counter.textContent = `${index + 1}/${items.length}`
    bar.style.width = `${(index / items.length) * 100}%`
    pad.clear()
    missedCurrent = false
    locked = false
    replayButton.disabled = false
    shownAt = performance.now()
    playCurrent()
  }

  function startChrono(): void {
    startedAt = performance.now()
    frame = requestAnimationFrame(tick)
    showItem()
  }

  function begin(): void {
    if (destroyed || begun) return
    begun = true
    if (!settings.dictationReference) {
      startChrono()
      return
    }
    showToast(pitchClassLabel(pitchClass(midi(REFERENCE_NOTE)), settings.naming))
    sound.playNote(REFERENCE_NOTE, NOTE_SECONDS)
    later(() => sound.playNote(REFERENCE_NOTE, NOTE_SECONDS), REFERENCE_GAP_MS)
    later(startChrono, 2 * REFERENCE_GAP_MS)
  }

  function askToTap(): void {
    const prompt = button('dictation-unlock', 'Touche l’écran pour activer le son', () => sound.unlock())
    const overlay = el('div', 'overlay dictation-unlock-overlay', prompt)
    prompt.addEventListener('pointerup', () => sound.unlock())
    element.append(overlay)
    void sound.whenRunning().then(() => {
      overlay.remove()
      begin()
    })
  }

  function replay(): void {
    if (locked || finished) return
    replays++
    playCurrent()
  }

  function submitAnswer(chosen: { pitchClass: number }): void {
    const item = items[index]
    if (locked || !item) return
    window.clearTimeout(wrongTimeout)
    pad.clear()
    const answered = answerItem(run, items, chosen.pitchClass)
    run = answered.run
    if (!answered.correct) {
      onWrong(chosen.pitchClass)
      return
    }
    locked = true
    replayButton.disabled = true
    progress = recordHistory(progress, 'dictation', { kind: 'answer', correct: !missedCurrent, ms: performance.now() - shownAt })
    streak = missedCurrent ? 0 : streak + 1
    timeline.markAnswered(index, !missedCurrent)
    onCorrect(item.pitch, timeline.notePoint(index))
    index++
    if (answered.finished) finish()
    else later(showItem, NEXT_PAUSE_MS)
  }

  function onWrong(pitchClass: number): void {
    missedCurrent = true
    timeline.markWrong(index)
    streak = 0
    sound.wrong()
    vibrate([40, 30, 40])
    pad.flash(pitchClass, 'wrong')
    wrongTimeout = window.setTimeout(() => pad.clear(), WRONG_FLASH_MS)
    restartAnimation(timerValue, 'shake')
    floatText(effectsLayer, centerOf(timerValue), `+${PENALTY_MS / 1000} s`, 'bad')
    restartAnimation(flash, 'flash-bad')
  }

  function onCorrect(pitch: number, notePoint: ReturnType<typeof timeline.notePoint>): void {
    sound.correct(streak)
    vibrate(15)
    pad.flash(pitch, 'correct')
    restartAnimation(flash, 'flash-ok')
    if (notePoint) burstParticles(effectsLayer, notePoint)
  }

  function finish(): void {
    finished = true
    cancelAnimationFrame(frame)
    const penalty = penaltyMs(run)
    const totalMs = elapsedMs() + penalty
    renderTimer()
    bar.style.width = '100%'
    const previousBest = progress.dictation.bestMs
    const record = previousBest === 0 || totalMs < previousBest
    const best = record ? Math.round(totalMs) : previousBest
    const beaten = challenge?.timeS != null ? challengeWon(totalMs, challenge.timeS) : null
    progress = {
      ...progress,
      dictation: {
        played: progress.dictation.played + 1,
        bestMs: best,
        won: progress.dictation.won + (beaten === true ? 1 : 0),
        lost: progress.dictation.lost + (beaten === false ? 1 : 0),
        replays: progress.dictation.replays + replays,
      },
    }
    progress = recordHistory(progress, 'dictation', { kind: 'game', best: Math.round(totalMs) })
    onProgress(progress)
    const outcome = { totalMs, penalty, results: firstTryResults(run, items.length), record, best, replays }
    replays = 0
    element.append(endOverlay(outcome, beaten))
  }

  async function share(outcome: Outcome): Promise<void> {
    if (sharing) return
    sharing = true
    try {
      await shareLink({ title: 'Solfège hero : défi Dictée', text: resultText(outcome), url: challengeLink(outcome) })
    } finally {
      sharing = false
    }
  }

  function challengeLink(outcome: Outcome): string {
    return dictationChallengeUrl(appBase(location.href), { config, timeS: challengeTimeS(outcome.totalMs) })
  }

  function resultText(outcome: Outcome): string {
    return shareText({
      title: `Dictée #${config.seed}`,
      results: outcome.results,
      totalMs: outcome.totalMs,
      penaltyMs: outcome.penalty,
      squares: settings.colorblind ? COLORBLIND_SQUARES : undefined,
    })
  }

  function countUp(target: HTMLElement, totalMs: number): void {
    if (motionReduced()) {
      target.textContent = formatTenthsUp(totalMs)
      return
    }
    const start = performance.now()
    const step = (now: number) => {
      const ratio = Math.min(1, (now - start) / COUNT_UP_MS)
      target.textContent = formatTenthsUp(totalMs * ratio)
      if (ratio < 1) countUpFrame = requestAnimationFrame(step)
    }
    countUpFrame = requestAnimationFrame(step)
  }

  function verdict(outcome: Outcome, beaten: boolean | null): HTMLElement | null {
    if (beaten === null || challenge?.timeS == null) return null
    if (beaten) {
      sound.milestone()
      burstConfetti(effectsLayer)
      return el('p', 'verdict win', 'Gagné !')
    }
    return el('p', 'verdict lose', `Perdu… à ${formatTenths(ceilToTenth(outcome.totalMs) - Math.round(challenge.timeS * 1000))} près`)
  }

  function versus(outcome: Outcome): HTMLElement | string {
    if (challenge?.timeS == null) return ''
    return el(
      'div',
      'versus',
      el('span', 'versus-you', `Toi ${formatTenthsUp(outcome.totalMs)}`),
      el('span', 'versus-friend', `Ami ${formatTenths(challenge.timeS * 1000)}`),
    )
  }

  function recordLine(outcome: Outcome, beaten: boolean | null): HTMLElement {
    if (outcome.record && beaten !== false) return el('p', 'result-record', 'Nouveau record !')
    return el('p', 'result-best', `Record : ${formatTenthsUp(outcome.best)}`)
  }

  function endOverlay(outcome: Outcome, beaten: boolean | null): HTMLElement {
    const comparing = challenge?.timeS != null
    const total = el('p', 'result-score series-total', formatTenths(0))
    if (!comparing) countUp(total, outcome.totalMs)
    const hits = outcome.results.filter(Boolean).length
    const strip = el(
      'div',
      'result-strip',
      ...outcome.results.map((hit, cell) => {
        const square = el('span', hit ? 'cell ok' : 'cell ko')
        square.style.setProperty('--i', String(cell))
        return square
      }),
    )
    const copy = () => void copyLink(challengeLink(outcome))
    const actions = challenge
      ? [shareRow('Partager mon résultat', () => void share(outcome), copy), button('segment-button', 'Réessayer ce défi', onRetry)]
      : [shareRow('Défier un ami', () => void share(outcome), copy), button('segment-button', 'Rejouer', onReplay)]
    const card = el(
      'div',
      'result series-end',
      verdict(outcome, beaten) ?? el('h2', '', 'Dictée terminée'),
      comparing ? versus(outcome) : total,
      outcome.penalty > 0 ? el('p', 'result-best', `(+${outcome.penalty / 1000} s)`) : '',
      el('p', '', `${hits}/${outcome.results.length} du premier coup`),
      strip,
      recordLine(outcome, beaten),
      ...(outcome.replays > 0 ? [el('p', 'result-best', `${outcome.replays} ${plural(outcome.replays, 'réécoute', 'réécoutes')}`)] : []),
      el('div', 'result-actions', ...actions, button('segment-button', 'Accueil', onHome)),
    )
    card.classList.toggle('win', beaten === true)
    card.classList.toggle('lose', beaten === false)
    return el('div', 'overlay', card)
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
    if (event.key.toLowerCase() === REPLAY_KEY) replay()
  }

  const stopTrackingHiddenTime = trackHiddenTime(shift)
  document.addEventListener('keydown', onKeyDown)
  displayItem()
  if (pad.isBlocked()) holdWhileBlocked(true)
  sound.unlock()
  if (sound.isRunning()) begin()
  else later(() => (sound.isRunning() ? begin() : askToTap()), UNLOCK_GRACE_MS)
  const removeDemoHook = installDemoHook(() => {
    const target = items[index]
    return target && !locked ? { pitch: target.pitch, dueInMs: 0 } : null
  }, submitAnswer)

  return {
    element,
    hold,
    destroy() {
      destroyed = true
      stopTrackingHiddenTime()
      document.removeEventListener('keydown', onKeyDown)
      cancelAnimationFrame(frame)
      cancelAnimationFrame(countUpFrame)
      window.clearTimeout(wrongTimeout)
      for (const id of timers) window.clearTimeout(id)
      removeDemoHook()
      timeline.destroy()
      pad.destroy()
      if (!finished && replays > 0) {
        onProgress({ ...progress, dictation: { ...progress.dictation, replays: progress.dictation.replays + replays } })
      }
    },
  }
}
