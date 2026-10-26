import type { Sound } from '../audio/sound'
import { promptId, recordAnswer } from '../game/sampler'
import { answerPitch, recordExactPitch, type Answer } from '../game/strictOctave'
import { motionReduced } from '../platform/appearance'
import { spell } from '../music/notes'
import { vibrate } from '../platform/haptics'
import type { Score } from '../hero/types'
import { scoreLink } from './sharing'
import { appBase, landingUrl } from '../share/links'
import { trackHiddenTime } from '../platform/visibility'
import { challengeTimeS, challengeUrl, challengeWon } from '../series/challenge'
import {
  INITIAL_RUN,
  PENALTY_MS,
  answerItem,
  firstTryResults,
  penaltyMs,
  type RandomSeriesConfig,
  type SeriesConfig,
  type SeriesItem,
  type SeriesRun,
} from '../series/series'
import { COLORBLIND_SQUARES, ceilToTenth, formatTenths, formatTenthsUp, formatTime, shareText } from '../series/share'
import { type DailyKey, dailyLabel, dailyStreak, encodeDailyHash } from '../series/daily'
import { recordDaily, recordHistory, recordScoreBest, type Progress, type Settings } from '../storage'
import { createAnswerPad } from './answerPad'
import { button, el } from './dom'
import { burstConfetti, burstParticles, centerOf, floatText, restartAnimation } from './effects'
import { installDemoHook } from './demoHook'
import { createTimelineStaff, type TimelinePoint } from './timelineStaff'
import { icon } from './icons'
import { copyLink, downloadScoreFile, shareLink, shareRow } from './sharing'
import { showToast } from './toast'

interface SharePayload {
  title: string
  text: string
  url: string
}

const NEXT_DELAY_MS = 150
const WRONG_FLASH_MS = 350
const COUNT_UP_MS = 600

/** What a series is racing against: the friend's time, when the challenge carries one. */
export interface ChallengeTarget {
  timeS: number | null
}

export interface DailyRun {
  key: DailyKey
  /** True when the key is today, so the first attempt can count. */
  ranked: boolean
}

export interface SeriesOptions {
  settings: Settings
  config: SeriesConfig
  items: SeriesItem[]
  /** The score being played; null for random series. */
  score: Score | null
  /** Set when playing a daily challenge. */
  daily: DailyRun | null
  challenge: ChallengeTarget | null
  progress: Progress
  sound: Sound
  onProgress: (progress: Progress) => void
  onReplay: () => void
  onRetry: () => void
  onHome: () => void
  /** "Accueil", or "Partitions" when the run started from the library. */
  homeLabel: string
}

export interface Series {
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
  /** Whether this run was the day's counted attempt. */
  dailyCounted: boolean
}

export function createSeries({
  settings,
  config,
  items,
  score,
  daily,
  challenge,
  progress: initialProgress,
  sound,
  onProgress,
  onReplay,
  onRetry,
  onHome,
  homeLabel,
}: SeriesOptions): Series {
  let progress = initialProgress
  const historyMode = daily ? 'daily' : 'series'
  const practisingDaily = daily !== null && (!daily.ranked || initialProgress.daily.attempts[daily.key] !== undefined)
  let run: SeriesRun = INITIAL_RUN
  let index = 0
  let streak = 0
  let missedCurrent = false
  let locked = false
  let startedAt = 0
  let shownAt = 0
  let frame = 0
  let nextTimeout = 0
  let wrongTimeout = 0
  let countUpFrame = 0
  let sharing = false

  const timerValue = el('span', 'series-timer', '0:00.0')
  const counter = el('span', 'series-count', `1/${items.length}`)
  const bar = el('div', 'progress-fill')
  const hud = el(
    'div',
    'hud series-hud',
    counter,
    timerValue,
    el('span', 'series-count-balance'),
    ...(daily || score ? [el('div', 'series-title', daily ? (practisingDaily ? 'Entraînement' : 'Défi du jour') : (score?.name ?? ''))] : []),
    el('div', 'progress', bar),
  )
  const timeline = createTimelineStaff({ maxFifths: Math.max(0, ...items.map((item) => Math.abs(item.fifths))) })
  const staffCard = el('div', 'staff-card', timeline.element)
  const pad = createAnswerPad(submitAnswer, settings.naming, settings.keyboardSpan, {
    strictOctave: settings.strictOctave,
    onBlockedChange: holdWhileBlocked,
  })
  const flash = el('div', 'flash')
  const effectsLayer = el('div', 'effects-layer')
  const element = el('section', 'screen game series', hud, staffCard, pad.element, flash, effectsLayer)

  let heldAt: number | null = null
  let holds = 0
  let releaseRotation: (() => void) | null = null

  function elapsedMs(): number {
    return (heldAt ?? performance.now()) - startedAt
  }

  function hold(): () => void {
    if (holds++ === 0) heldAt = performance.now()
    let released = false
    return () => {
      if (released) return
      released = true
      if (--holds > 0 || heldAt === null) return
      const heldMs = performance.now() - heldAt
      startedAt += heldMs
      shownAt += heldMs
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

  function showItem(): void {
    const item = items[index]
    if (!item) return
    timeline.setCurrent(index, item)
    counter.textContent = `${index + 1}/${items.length}`
    bar.style.width = `${(index / items.length) * 100}%`
    pad.setTarget(item.clef, item.pitch)
    pad.clear()
    missedCurrent = false
    shownAt = performance.now()
    locked = false
  }

  function submitAnswer(chosen: Answer): void {
    const item = items[index]
    if (locked || !item) return
    window.clearTimeout(wrongTimeout)
    pad.clear()
    const answered = answerItem(run, items, chosen.pitchClass, chosen.pitch)
    run = answered.run
    if (!answered.correct) {
      onWrong(chosen)
      return
    }
    locked = true
    const elapsed = performance.now() - shownAt
    const noteId = promptId({ clef: item.clef, pitch: item.pitch })
    progress = recordHistory(progress, historyMode, { kind: 'answer', correct: !missedCurrent, ms: elapsed, noteId })
    progress = {
      ...progress,
      notes: recordAnswer(progress.notes, noteId, !missedCurrent, elapsed),
      pitches: recordExactPitch(progress.pitches, item.pitch, !missedCurrent, settings.strictOctave),
      totalAnswered: progress.totalAnswered + 1,
    }
    streak = missedCurrent ? 0 : streak + 1
    timeline.markAnswered(index, !missedCurrent)
    onCorrect(item.pitch, item.fifths, timeline.notePoint(index))
    index++
    if (answered.finished) finish()
    else nextTimeout = window.setTimeout(showItem, NEXT_DELAY_MS)
  }

  function onWrong(chosen: Answer): void {
    missedCurrent = true
    timeline.markWrong(index)
    streak = 0
    sound.wrong()
    vibrate([40, 30, 40])
    pad.flash(answerPitch(chosen), 'wrong')
    wrongTimeout = window.setTimeout(() => pad.clear(), WRONG_FLASH_MS)
    restartAnimation(timerValue, 'shake')
    floatText(effectsLayer, centerOf(timerValue), `+${PENALTY_MS / 1000} s`, 'bad')
    restartAnimation(flash, 'flash-bad')
  }

  function onCorrect(pitch: number, fifths: number, notePoint: TimelinePoint | null): void {
    sound.correct(streak)
    sound.playNote(spell(pitch, fifths < 0))
    vibrate(15)
    pad.flash(pitch, 'correct')
    restartAnimation(flash, 'flash-ok')
    if (notePoint) burstParticles(effectsLayer, notePoint)
  }

  function finish(): void {
    cancelAnimationFrame(frame)
    const penalty = penaltyMs(run)
    const totalMs = elapsedMs() + penalty
    renderTimer()
    bar.style.width = '100%'
    const scoreId = config.kind === 'score' ? config.scoreId : null
    const previousBest = scoreId ? (progress.series.bestByScore[scoreId] ?? 0) : progress.series.bestMs
    const record = previousBest === 0 || totalMs < previousBest
    const best = record ? Math.round(totalMs) : previousBest
    const beaten = challenge?.timeS != null ? challengeWon(totalMs, challenge.timeS) : null
    const results = firstTryResults(run, items.length)
    let dailyCounted = false
    if (daily) {
      if (daily.ranked) {
        const recorded = recordDaily(progress, daily.key, { totalMs: Math.round(totalMs), results, penaltyMs: penalty })
        progress = recorded.progress
        dailyCounted = recorded.counted
      }
    } else {
      progress = {
        ...progress,
        series: {
          ...progress.series,
          played: progress.series.played + 1,
          bestMs: scoreId === null ? best : progress.series.bestMs,
          won: progress.series.won + (beaten === true ? 1 : 0),
          lost: progress.series.lost + (beaten === false ? 1 : 0),
        },
      }
      if (scoreId !== null && record) progress = recordScoreBest(progress, scoreId, best)
    }
    progress = recordHistory(progress, historyMode, { kind: 'game', best: config.kind === 'score' ? null : Math.round(totalMs) })
    onProgress(progress)
    element.append(endOverlay({ totalMs, penalty, results, record, best, dailyCounted }, beaten))
  }

  async function share(outcome: Outcome): Promise<void> {
    if (sharing) return
    sharing = true
    try {
      const payload = await sharePayload(outcome)
      if (payload) await shareLink(payload)
      else if (score) {
        scoreTooLong()
        downloadScoreFile(score)
      }
    } finally {
      sharing = false
    }
  }

  async function copyChallengeLink(outcome: Outcome): Promise<void> {
    const payload = await sharePayload(outcome)
    if (payload) await copyLink(payload.url)
    else scoreTooLong()
  }

  async function sharePayload(outcome: Outcome): Promise<SharePayload | null> {
    if (daily) {
      const text = resultText(dailyOutcome(daily.key, outcome), `Défi du jour ${dailyLabel(daily.key)}`, 'Joue aussi !')
      return { title: 'Solfège hero : défi du jour', text, url: dailyUrl(daily.key) }
    }
    if (config.kind === 'random') {
      return { title: 'Solfège hero : défi Séries', text: resultText(outcome, `Série #${config.seed}`), url: randomChallengeUrl(outcome, config) }
    }
    if (!score) return null
    const url = await scoreLink(score, challengeTimeS(outcome.totalMs))
    return url ? { title: 'Solfège hero : défi Séries', text: resultText(outcome, `« ${score.name} »`), url } : null
  }

  function randomChallengeUrl(outcome: Outcome, random: RandomSeriesConfig): string {
    return challengeUrl(appBase(location.href), { config: random, timeS: challengeTimeS(outcome.totalMs) })
  }

  function scoreTooLong(): void {
    showToast('Partition trop longue : partage d’abord le fichier')
  }

  /** Like Wordle, the day's first attempt is the one shared, even after practice runs. */
  function dailyOutcome(key: DailyKey, current: Outcome): Outcome {
    const counted = progress.daily.attempts[key]
    return counted ? { ...current, totalMs: counted.totalMs, results: counted.results, penalty: counted.penaltyMs } : current
  }

  function dailyUrl(key: DailyKey): string {
    return landingUrl(appBase(location.href), 'jour', encodeDailyHash(key))
  }

  function resultText(outcome: Outcome, title: string, callToAction?: string): string {
    return shareText({
      title,
      callToAction,
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
      const progressRatio = Math.min(1, (now - start) / COUNT_UP_MS)
      target.textContent = formatTenthsUp(totalMs * progressRatio)
      if (progressRatio < 1) countUpFrame = requestAnimationFrame(step)
    }
    countUpFrame = requestAnimationFrame(step)
  }

  function verdict(outcome: Outcome, beaten: boolean | null): HTMLElement | null {
    if (beaten === null || challenge?.timeS == null) return null
    if (beaten) {
      sound.milestone()
      burstConfetti(effectsLayer)
      return el('p', 'verdict win', 'Gagné !')
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
    const subject = config.kind === 'score' ? ' pour cette partition' : ''
    if (outcome.record && beaten !== false) return el('p', 'result-record', `Nouveau record${subject} !`)
    return el('p', 'result-best', `Record${subject} : ${formatTenthsUp(outcome.best)}`)
  }

  function dailyHeadline(outcome: Outcome): string {
    return outcome.dailyCounted && daily ? `Défi du jour · ${dailyLabel(daily.key)}` : 'Entraînement'
  }

  function dailyLines({ key, ranked }: DailyRun, outcome: Outcome): HTMLElement[] {
    if (!ranked) return [el('p', 'result-best', `Défi du ${dailyLabel(key)} (hors délai)`)]
    if (!outcome.dailyCounted) {
      const counted = progress.daily.attempts[key]
      return counted ? [el('p', 'result-best', `Ton score du jour : ${formatTenthsUp(counted.totalMs)}`)] : []
    }
    const days = dailyStreak(Object.keys(progress.daily.attempts), key)
    return [
      el('p', 'result-record inline-icon', icon('flame'), `${days} jour${days > 1 ? 's' : ''} d’affilée`),
      el('p', 'result-best', `Meilleur défi : ${formatTenthsUp(progress.daily.bestMs)}`),
    ]
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
    const actions = daily
      ? [
          shareRow('Partager', () => void share(outcome), () => void copyChallengeLink(outcome)),
          button('segment-button', 'Rejouer (entraînement)', onReplay),
          button('segment-button', homeLabel, onHome),
        ]
      : challenge
      ? [
          shareRow('Partager mon résultat', () => void share(outcome), () => void copyChallengeLink(outcome)),
          button('segment-button', 'Réessayer ce défi', onRetry),
          button('segment-button', homeLabel, onHome),
        ]
      : [
          shareRow('Défier un ami', () => void share(outcome), () => void copyChallengeLink(outcome)),
          button('segment-button', 'Rejouer', onReplay),
          button('segment-button', homeLabel, onHome),
        ]
    const card = el(
      'div',
      'result series-end',
      verdict(outcome, beaten) ?? el('h2', daily ? 'daily-headline' : '', daily ? dailyHeadline(outcome) : 'Série terminée'),
      comparing ? versus(outcome) : total,
      outcome.penalty > 0 ? el('p', 'result-best', `(+${outcome.penalty / 1000} s)`) : '',
      el('p', '', `${hits}/${outcome.results.length} du premier coup`),
      strip,
      ...(daily ? dailyLines(daily, outcome) : [recordLine(outcome, beaten)]),
      el('div', 'result-actions', ...actions),
    )
    card.classList.toggle('win', beaten === true)
    card.classList.toggle('lose', beaten === false)
    return el('div', 'overlay', card)
  }

  const stopTrackingHiddenTime = trackHiddenTime((hiddenMs) => {
    startedAt += hiddenMs
    shownAt += hiddenMs
  })
  startedAt = performance.now()
  showItem()
  frame = requestAnimationFrame(tick)
  if (pad.isBlocked()) holdWhileBlocked(true)
  const removeDemoHook = installDemoHook(() => {
    const target = items[index]
    return target && !locked ? { pitch: target.pitch, dueInMs: 0 } : null
  }, submitAnswer)

  return {
    element,
    hold,
    destroy() {
      stopTrackingHiddenTime()
      cancelAnimationFrame(frame)
      cancelAnimationFrame(countUpFrame)
      window.clearTimeout(nextTimeout)
      window.clearTimeout(wrongTimeout)
      removeDemoHook()
      timeline.destroy()
      pad.destroy()
    },
  }
}
