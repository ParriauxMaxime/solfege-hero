import type { Sound } from '../audio/sound'
import { promptId, recordAnswer } from '../game/sampler'
import { motionReduced } from '../platform/appearance'
import { pitchClass, spell } from '../music/notes'
import { vibrate } from '../platform/haptics'
import type { Score } from '../hero/types'
import { scoreLink } from './sharing'
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
import { recordDaily, recordScoreBest, type Progress, type Settings } from '../storage'
import { createAnswerPad } from './answerPad'
import { button, el } from './dom'
import { burstConfetti, burstParticles, centerOf, floatText, restartAnimation } from './effects'
import { renderStaff } from './staff'
import { icon } from './icons'
import { downloadScoreFile, shareOrCopy } from './sharing'
import { showToast } from './toast'

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
    ...(daily || score ? [el('div', 'series-title', daily ? 'Défi du jour' : (score?.name ?? ''))] : []),
    el('div', 'progress', bar),
  )
  const staffCard = el('div', 'staff-card')
  const pad = createAnswerPad(submitAnswer, settings.naming, settings.keyboardSpan)
  const flash = el('div', 'flash')
  const effectsLayer = el('div', 'effects-layer')
  const element = el('section', 'screen game series', hud, staffCard, pad.element, flash, effectsLayer)

  let heldAt: number | null = null

  function elapsedMs(): number {
    return (heldAt ?? performance.now()) - startedAt
  }

  function hold(): () => void {
    heldAt = performance.now()
    return () => {
      if (heldAt === null) return
      const heldMs = performance.now() - heldAt
      startedAt += heldMs
      shownAt += heldMs
      heldAt = null
    }
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
    staffCard.replaceChildren(renderStaff(item.clef, item.note, item.fifths))
    counter.textContent = `${index + 1}/${items.length}`
    bar.style.width = `${(index / items.length) * 100}%`
    pad.clear()
    missedCurrent = false
    shownAt = performance.now()
    locked = false
  }

  function submitAnswer(chosen: number): void {
    const item = items[index]
    if (locked || !item) return
    window.clearTimeout(wrongTimeout)
    pad.clear()
    const answered = answerItem(run, items, chosen)
    run = answered.run
    if (!answered.correct) {
      onWrong(chosen)
      return
    }
    locked = true
    progress = {
      ...progress,
      notes: recordAnswer(progress.notes, promptId({ clef: item.clef, pitch: item.pitch }), !missedCurrent, performance.now() - shownAt),
      totalAnswered: progress.totalAnswered + 1,
    }
    streak = missedCurrent ? 0 : streak + 1
    onCorrect(item.pitch, item.fifths)
    index++
    if (answered.finished) finish()
    else nextTimeout = window.setTimeout(showItem, NEXT_DELAY_MS)
  }

  function onWrong(chosen: number): void {
    missedCurrent = true
    streak = 0
    sound.wrong()
    vibrate([40, 30, 40])
    pad.flash(chosen, 'wrong')
    wrongTimeout = window.setTimeout(() => pad.clear(), WRONG_FLASH_MS)
    restartAnimation(timerValue, 'shake')
    floatText(effectsLayer, centerOf(timerValue), `+${PENALTY_MS / 1000} s`, 'bad')
    restartAnimation(flash, 'flash-bad')
  }

  function onCorrect(pitch: number, fifths: number): void {
    sound.correct(streak)
    sound.playNote(spell(pitch, fifths < 0))
    vibrate(15)
    pad.flash(pitchClass(pitch), 'correct')
    restartAnimation(flash, 'flash-ok')
    const noteHead = staffCard.querySelector('.staff-note')
    if (noteHead) {
      noteHead.classList.add('pop')
      burstParticles(effectsLayer, centerOf(noteHead))
    }
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
    onProgress(progress)
    element.append(endOverlay({ totalMs, penalty, results, record, best, dailyCounted }, beaten))
  }

  async function share(outcome: Outcome): Promise<void> {
    if (sharing) return
    sharing = true
    try {
      if (daily) await shareOrCopy(resultText(dailyOutcome(daily.key, outcome), dailyUrl(daily.key), `Défi du jour ${dailyLabel(daily.key)}`, 'Joue aussi'))
      else if (config.kind === 'random') await shareOrCopy(resultText(outcome, randomChallengeUrl(outcome, config), `Série #${config.seed}`))
      else if (score) await shareScoreChallenge(outcome, score)
    } finally {
      sharing = false
    }
  }

  function randomChallengeUrl(outcome: Outcome, random: RandomSeriesConfig): string {
    return challengeUrl(location.origin + location.pathname, { config: random, timeS: challengeTimeS(outcome.totalMs) })
  }

  async function shareScoreChallenge(outcome: Outcome, shared: Score): Promise<void> {
    const url = await scoreLink(shared, challengeTimeS(outcome.totalMs))
    if (!url) {
      showToast('Partition trop longue : partage d’abord le fichier')
      downloadScoreFile(shared)
      return
    }
    await shareOrCopy(resultText(outcome, url, `« ${shared.name} »`))
  }

  /** Like Wordle, the day's first attempt is the one shared, even after practice runs. */
  function dailyOutcome(key: DailyKey, current: Outcome): Outcome {
    const counted = progress.daily.attempts[key]
    return counted ? { ...current, totalMs: counted.totalMs, results: counted.results, penalty: counted.penaltyMs } : current
  }

  function dailyUrl(key: DailyKey): string {
    return `${location.origin}${location.pathname}#${encodeDailyHash(key)}`
  }

  function resultText(outcome: Outcome, url: string, title: string, callToAction?: string): string {
    return shareText({
      title,
      callToAction,
      results: outcome.results,
      totalMs: outcome.totalMs,
      penaltyMs: outcome.penalty,
      url,
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
          button('primary', 'Partager', () => void share(outcome)),
          button('segment-button', 'Rejouer (entraînement)', onReplay),
          button('segment-button', homeLabel, onHome),
        ]
      : challenge
      ? [
          button('primary', 'Partager mon résultat', () => void share(outcome)),
          button('segment-button', 'Réessayer ce défi', onRetry),
          button('segment-button', homeLabel, onHome),
        ]
      : [
          button('primary', 'Défier un ami', () => void share(outcome)),
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

  return {
    element,
    hold,
    destroy() {
      stopTrackingHiddenTime()
      cancelAnimationFrame(frame)
      cancelAnimationFrame(countUpFrame)
      window.clearTimeout(nextTimeout)
      window.clearTimeout(wrongTimeout)
      pad.destroy()
    },
  }
}
