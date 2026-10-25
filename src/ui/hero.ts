import type { Sound } from '../audio/sound'
import { createBeatClock, withTempo, type BeatClock } from '../hero/clock'
import {
  CHALLENGE_BARS,
  challengeClef,
  describeGap,
  heroChallengeUrl,
  heroChallengeWon,
  heroShareText,
  limitedSource,
  successPercent,
  type HeroChallengeConfig,
  type HeroResult,
} from '../hero/challenge'
import { newSeed } from '../series/series'
import { seededRandom } from '../random'
import { shareOrCopy } from './sharing'
import { expiredNotes, noteInWindow, timingJudgement } from '../hero/judgement'
import { INITIAL_HERO_SCORE, applyJudgement, type HeroScore } from '../hero/scoring'
import { INITIAL_DIFFICULTY, TEMPO_CAP, onJudgement, type DifficultyState } from '../hero/difficulty'
import { generatedSource, melodySource, placeNotes, type NoteSource } from '../hero/sources'
import { adaptTempo, type TempoState } from '../hero/tempo'
import { barClicks, barLength, type Click } from '../hero/meter'
import { COMMON_TIME, type HeroNote, type Judgement, type Melody } from '../hero/types'
import { promptId, recordAnswer } from '../game/sampler'
import { multiplier } from '../game/scoring'
import { answerPitch, defaultWindowStart, isCorrectAnswer, recordExactPitch, type Answer } from '../game/strictOctave'
import { noteName, type Clef, type Note } from '../music/notes'
import { vibrate } from '../platform/haptics'
import type { Progress, Settings } from '../storage'
import { createAnswerPad } from './answerPad'
import { button, el, iconButton, setIcon } from './dom'
import { icon } from './icons'
import { burstConfetti, burstParticles, centerOf, floatText, restartAnimation } from './effects'
import { installDemoHook } from './demoHook'
import { createScrollingStaff } from './heroStaff'

const BARS_AHEAD = 3
const CLICK_LOOKAHEAD_S = 0.15
const RESUME_LEAD_S = 0.3
const START_LEAD_S = 0.1
const INLINE_ACCIDENTAL_CHANCE = 0.02
const INLINE_FROM_LEVEL = 3
const MAX_LEVEL = 5

function renderStars(level: number): string {
  return '★'.repeat(level) + '☆'.repeat(MAX_LEVEL - level)
}
const QUIT_CONFIRM_MS = 3000
const NEUTRAL_FLASH_MS = 150
const FLOAT_OFFSET_PX = 40
const DEAD_TAP_LABEL_GAP_PX = 14
const JUDGEMENT_LABELS: Record<Judgement, string> = { parfait: 'Parfait', bien: 'Bien', rate: 'Raté' }

export interface HeroOptions {
  settings: Settings
  progress: Progress
  sound: Sound
  melody: Melody | null
  /** A fixed 16-bar run on a seeded melody; `against` is the friend's result to beat, if any. */
  challenge?: { config: HeroChallengeConfig; against: HeroResult | null } | null
  isMuted: () => boolean
  onToggleMute: () => void
  onProgress: (progress: Progress) => void
  onQuit: () => void
  onReplay: () => void
  onRetry: () => void
  onHome: () => void
  /** "Accueil", or "Partitions" when the run started from the library. */
  homeLabel: string
}

export interface Hero {
  element: HTMLElement
  pause: () => void
  isOver: () => boolean
  destroy: () => void
}

export function createHero({
  settings,
  progress: initialProgress,
  sound,
  melody,
  challenge = null,
  isMuted,
  onToggleMute,
  onProgress,
  onQuit,
  onReplay,
  onRetry,
  onHome,
  homeLabel,
}: HeroOptions): Hero {
  const seed = challenge?.config.seed ?? newSeed()
  const armures = challenge?.config.armures ?? settings.accidentals
  const startBpm = challenge?.config.bpm ?? settings.heroTempo
  const clef: Clef = melody?.clef ?? challengeClef({ seed, clefs: challenge?.config.clefs ?? settings.clefs })
  let difficulty: DifficultyState = challenge ? { ...INITIAL_DIFFICULTY, level: challenge.config.difficulty } : INITIAL_DIFFICULTY
  const generated = melody ? null : generatedSource(seed, { clef, armures }, () => difficulty.level)
  const placementRandom = challenge ? seededRandom(seed) : Math.random
  const fifths = melody ? melody.key : (generated?.key ?? 0)
  const time = melody ? (melody.timeSignature ?? COMMON_TIME) : (generated?.time ?? COMMON_TIME)
  const bar = barLength(time)
  const clicks = barClicks(time)
  const generatedNotes = generated?.source as NoteSource
  const source: NoteSource = melody
    ? melodySource(melody)
    : challenge
      ? limitedSource(generatedNotes, challenge.config.bars)
      : generatedNotes
  let progress = initialProgress
  let score: HeroScore = INITIAL_HERO_SCORE
  let tempo: TempoState = { bpm: startBpm, hitsInRow: 0 }
  let clock: BeatClock = createBeatClock(sound.now() + START_LEAD_S, -bar, tempo.bpm)
  let notes: HeroNote[] = []
  const judged = new Set<number>()
  let nextId = 0
  let nextBarBeat = 0
  let nextClickIndex = 0
  let exhausted = false
  let sessionHits = 0
  let sessionMisses = 0
  let sessionPerfects = 0
  let frozenBeat: number | null = null
  let frozenByRotation = false
  let over = false
  let introDone = false
  let frame = 0

  const staff = createScrollingStaff(clef, fifths, time)
  const scoreValue = el('span', 'hud-value', '0')
  const streakValue = el('span', 'streak-value', '0')
  const streak = el('div', 'hud-streak', el('span', 'flame', icon('flame')), streakValue)
  const multiplierValue = el('span', 'multiplier', '×1')
  const bpmValue = el('span', 'bpm-value', String(tempo.bpm))
  const bpm = el('div', 'bpm', bpmValue, el('small', '', 'BPM'))
  const pauseButton = iconButton('pause', pause, 'Pause')
  const muteButton = iconButton(
    'sound-on',
    () => {
      onToggleMute()
      renderMute()
    },
    'Son',
  )
  renderMute()
  const stars = el('span', 'difficulty', renderStars(difficulty.level))
  stars.hidden = melody !== null
  const hud = el(
    'div',
    'hud',
    el('div', 'hud-score', scoreValue),
    streak,
    multiplierValue,
    el('div', 'bpm-block', bpm, stars),
    muteButton,
    pauseButton,
  )
  const countIn = el('div', 'count-in')
  const staffArea = el('div', 'hero-staff', staff.element, countIn)
  const pad = createAnswerPad(tap, settings.naming, settings.keyboardSpan, {
    strictOctave: settings.strictOctave,
    onBlockedChange: freezeWhileBlocked,
  })
  const flash = el('div', 'flash')
  const effectsLayer = el('div', 'effects-layer')
  const element = el('section', 'screen game hero', hud, staffArea, pad.element, flash, effectsLayer)

  function renderMute(): void {
    setIcon(muteButton, isMuted() ? 'sound-off' : 'sound-on')
  }

  function currentBeat(): number {
    return frozenBeat ?? clock.beatAt(sound.now())
  }

  function fillBars(nowBeat: number): void {
    while (!exhausted && nextBarBeat < nowBeat + BARS_AHEAD * bar) {
      const specs = source.nextBar()
      if (specs === null) {
        exhausted = true
        break
      }
      const placed = placeNotes(specs, nextBarBeat, nextId, fifths, melody || difficulty.level < INLINE_FROM_LEVEL ? 0 : INLINE_ACCIDENTAL_CHANCE, placementRandom)
      notes.push(...placed)
      nextId += placed.length
      nextBarBeat += bar
    }
    notes = notes.filter((note) => note.beat >= nowBeat - bar)
  }

  function clickBeat(index: number): number {
    const click = clicks[index % clicks.length] as Click
    return -bar + Math.floor(index / clicks.length) * bar + click.offset
  }

  function firstClickAtOrAfter(beat: number): number {
    let index = Math.max(0, (Math.floor((beat + bar) / bar) - 1) * clicks.length)
    while (clickBeat(index) < beat) index++
    return index
  }

  function scheduleClicks(): void {
    const horizon = sound.now() + CLICK_LOOKAHEAD_S
    while (clock.timeAt(clickBeat(nextClickIndex)) < horizon) {
      const time = clock.timeAt(clickBeat(nextClickIndex))
      if (settings.metronome && time >= sound.now()) sound.click(time, (clicks[nextClickIndex % clicks.length] as Click).accent)
      nextClickIndex++
    }
  }

  function renderCountIn(nowBeat: number): void {
    introDone ||= nowBeat >= 0
    const passed = clicks.filter((click) => click.offset <= nowBeat + bar).length
    countIn.textContent = introDone ? '' : String(Math.max(1, passed))
  }

  function isFinished(): boolean {
    return exhausted && notes.every((note) => note.pitch === null || judged.has(note.id))
  }

  function tick(): void {
    frame = requestAnimationFrame(tick)
    const nowBeat = currentBeat()
    if (frozenBeat === null) {
      fillBars(nowBeat)
      scheduleClicks()
      for (const note of expiredNotes(notes, judged, nowBeat, clock)) judge(note, 'rate')
      if (isFinished()) finish(nowBeat)
      if (settings.strictOctave) showKeyboardForNextNote()
    }
    renderCountIn(nowBeat)
    staff.render(notes, nowBeat, 0)
  }

  function nextPendingNote(): { pitch: number; dueInMs: number } | null {
    const next = notes.find((note) => note.pitch !== null && !judged.has(note.id))
    if (next?.pitch == null) return null
    return { pitch: next.pitch, dueInMs: (clock.timeAt(next.beat) - sound.now()) * 1000 }
  }

  function showKeyboardForNextNote(): void {
    const next = notes.find((note) => note.pitch !== null && !judged.has(note.id))
    if (next?.pitch != null) pad.setTarget(clef, next.pitch)
  }

  function deadTap(chosen: Answer): void {
    const nowBeat = currentBeat()
    const nearest = notes
      .filter((note) => note.pitch !== null)
      .reduce<HeroNote | null>((best, note) => (!best || Math.abs(note.beat - nowBeat) < Math.abs(best.beat - nowBeat) ? note : best), null)
    pad.clear()
    pad.flash(answerPitch(chosen), 'neutral')
    window.setTimeout(() => pad.clear(), NEUTRAL_FLASH_MS)
    const zone = staff.element.querySelector('.hero-hit-zone') ?? staff.element
    const { x } = centerOf(zone)
    const { top } = zone.getBoundingClientRect()
    floatText(effectsLayer, { x, y: top - DEAD_TAP_LABEL_GAP_PX }, nearest && nearest.beat < nowBeat ? 'Trop tard' : 'Trop tôt', 'neutral')
  }

  function tap(chosen: Answer): void {
    if (frozenBeat !== null) return
    const target = noteInWindow(notes, judged, currentBeat(), clock)
    if (!target || target.pitch === null) {
      deadTap(chosen)
      return
    }
    const deltaMs = (sound.now() - clock.timeAt(target.beat)) * 1000
    pad.clear()
    if (!isCorrectAnswer(target.pitch, chosen)) {
      pad.flash(answerPitch(chosen), 'wrong')
      pad.flash(target.pitch, 'reveal')
      judge(target, 'rate')
      return
    }
    const judgement = timingJudgement(deltaMs)
    if (judgement) judge(target, judgement)
  }

  function judge(note: HeroNote, judgement: Judgement): void {
    judged.add(note.id)
    if (note.pitch === null || !note.note) return
    const hit = judgement !== 'rate'
    const result = applyJudgement(score, judgement)
    score = result.state
    if (!melody && !challenge) updateDifficulty(hit, Math.floor(note.beat / bar))
    if (!challenge) adaptTempoTo(hit)
    updateProgress(note.pitch, hit, judgement)
    renderScore()
    if (hit) onHit(note.id, note.note, judgement, result.gained, result.milestone)
    else onMiss(note.id, noteName(note.note, settings.naming), result.brokenStreak)
  }

  function updateProgress(pitch: number, hit: boolean, judgement: Judgement): void {
    const { hero } = progress
    progress = {
      ...progress,
      notes: recordAnswer(progress.notes, promptId({ clef, pitch }), hit, null),
      pitches: recordExactPitch(progress.pitches, pitch, hit, settings.strictOctave),
      bestStreak: Math.max(progress.bestStreak, score.bestStreak),
      totalAnswered: progress.totalAnswered + 1,
      hero: {
        ...hero,
        ...(challenge
          ? {}
          : {
              bestScore: Math.max(hero.bestScore, score.score),
              bestStreak: Math.max(hero.bestStreak, score.bestStreak),
              maxBpm: Math.max(hero.maxBpm, tempo.bpm),
            }),
        hits: hero.hits + (hit ? 1 : 0),
        misses: hero.misses + (hit ? 0 : 1),
        perfects: hero.perfects + (judgement === 'parfait' ? 1 : 0),
      },
    }
    sessionHits += hit ? 1 : 0
    sessionMisses += hit ? 0 : 1
    sessionPerfects += judgement === 'parfait' ? 1 : 0
    onProgress(progress)
  }

  function updateDifficulty(hit: boolean, barIndex: number): void {
    const next = onJudgement(difficulty, hit, barIndex)
    if (next.level !== difficulty.level) {
      stars.textContent = renderStars(next.level)
      restartAnimation(stars, 'bump')
      floatText(effectsLayer, centerOf(stars), `Niveau ${next.level}`, next.level > difficulty.level ? 'good' : 'neutral')
    }
    difficulty = next
  }

  function adaptTempoTo(hit: boolean): void {
    const next = adaptTempo(tempo, hit, melody ? undefined : TEMPO_CAP[difficulty.level])
    if (next.bpm !== tempo.bpm) {
      clock = withTempo(clock, sound.now(), next.bpm)
      bpmValue.textContent = String(next.bpm)
      restartAnimation(bpmValue, 'bump')
    }
    tempo = next
  }

  function renderScore(): void {
    scoreValue.textContent = String(score.score)
    streakValue.textContent = String(score.streak)
    multiplierValue.textContent = `×${multiplier(score.streak)}`
    streak.classList.toggle('hot', score.streak >= 5)
  }

  function onHit(id: number, note: Note, judgement: Judgement, gained: number, milestone: number | null): void {
    sound.correct(score.streak)
    sound.playNote(note)
    vibrate(15)
    staff.markHit(id)
    restartAnimation(flash, 'flash-ok')
    restartAnimation(streakValue, 'bump')
    const origin = staff.notePoint(id)
    if (origin) {
      burstParticles(effectsLayer, origin)
      floatText(effectsLayer, { x: origin.x, y: origin.y - FLOAT_OFFSET_PX }, `${JUDGEMENT_LABELS[judgement]} +${gained}`)
    }
    if (milestone !== null) {
      sound.milestone()
      vibrate([30, 40, 30, 40, 80])
      burstConfetti(effectsLayer)
    }
  }

  function onMiss(id: number, label: string, brokenStreak: number): void {
    sound.wrong()
    vibrate([40, 30, 40])
    staff.markMiss(id, label)
    restartAnimation(flash, 'flash-bad')
    if (brokenStreak > 0) {
      const dropped = el('span', 'streak-drop', String(brokenStreak))
      dropped.addEventListener('animationend', () => dropped.remove(), { once: true })
      streak.append(dropped)
    }
  }

  function finish(nowBeat: number): void {
    frozenBeat = nowBeat
    over = true
    const judgedCount = sessionHits + sessionMisses
    const perfectRatio = judgedCount > 0 ? `${Math.round((sessionPerfects / judgedCount) * 100)} %` : '–'
    const stat = (label: string, value: string | number) => el('p', 'result-best', `${label} : ${value}`)
    const result = currentResult()
    const target = challenge?.against ?? null
    const won = target ? heroChallengeWon(result, target) : null
    if (target) recordChallenge(won === true)
    const card = el(
      'div',
      'result series-end',
      target ? verdict(result, target, won === true) : el('h2', '', melody?.name ?? 'Terminé'),
      ...(target ? [versus(result, target)] : [el('p', 'result-score series-total', String(score.score)), el('p', 'result-best', 'points')]),
      stat('Réussite', `${result.percent} %`),
      stat('Meilleure série', score.bestStreak),
      stat('Parfaits', perfectRatio),
      stat('Réussies', sessionHits),
      stat('Ratées', sessionMisses),
      el('div', 'result-actions', ...resultActions(target)),
    )
    card.classList.toggle('win', won === true)
    card.classList.toggle('lose', won === false)
    element.append(el('div', 'overlay', card))
  }

  function currentResult(): HeroResult {
    return { percent: successPercent(sessionHits, sessionMisses), score: score.score }
  }

  function recordChallenge(won: boolean): void {
    const { hero } = progress
    progress = {
      ...progress,
      hero: { ...hero, challengesWon: hero.challengesWon + (won ? 1 : 0), challengesLost: hero.challengesLost + (won ? 0 : 1) },
    }
    onProgress(progress)
  }

  function verdict(mine: HeroResult, target: HeroResult, won: boolean): HTMLElement {
    if (won) {
      sound.milestone()
      burstConfetti(effectsLayer)
      return el('p', 'verdict win', 'Gagné !')
    }
    return el('p', 'verdict lose', `Perdu : ${describeGap(mine, target)}`)
  }

  function versus(mine: HeroResult, target: HeroResult): HTMLElement {
    const line = ({ percent, score: points }: HeroResult) => `${percent} % · ${points} pts`
    return el(
      'div',
      'versus stacked',
      el('span', 'versus-you', `Toi : ${line(mine)}`),
      el('span', 'versus-friend', `Ami : ${line(target)}`),
    )
  }

  function challengeToShare(): { config: HeroChallengeConfig; result: HeroResult | null } {
    if (challenge) return { config: challenge.config, result: currentResult() }
    const config: HeroChallengeConfig = {
      seed,
      clefs: settings.clefs,
      armures,
      bpm: startBpm,
      difficulty: difficulty.level,
      bars: CHALLENGE_BARS,
    }
    return { config, result: null }
  }

  let sharing = false
  async function share(): Promise<void> {
    if (sharing) return
    sharing = true
    try {
      const { config, result } = challengeToShare()
      const url = heroChallengeUrl(location.origin + location.pathname, { config, target: result })
      await shareOrCopy(heroShareText({ config, result, url }))
    } finally {
      sharing = false
    }
  }

  function resultActions(target: HeroResult | null): HTMLElement[] {
    const home = button('segment-button', homeLabel, onHome)
    if (challenge) {
      const label = target ? 'Partager mon résultat' : 'Défier un ami'
      return [button('primary', label, () => void share()), button('segment-button', 'Réessayer ce défi', onRetry), home]
    }
    const replay = button('primary', 'Rejouer', onReplay)
    return melody ? [replay, home] : [replay, button('segment-button', 'Défier un ami', () => void share()), home]
  }

  function freezeWhileBlocked(blocked: boolean): void {
    if (blocked) {
      if (frozenBeat !== null || over) return
      frozenBeat = currentBeat()
      frozenByRotation = true
    } else if (frozenByRotation) {
      frozenByRotation = false
      resume()
    }
  }

  function pause(): void {
    if (frozenBeat !== null && !frozenByRotation) return
    frozenByRotation = false
    frozenBeat ??= currentBeat()
    let quitArmed = false
    const quit = button('danger', 'Quitter', () => {
      if (quitArmed) {
        onQuit()
        return
      }
      quitArmed = true
      quit.textContent = 'Vraiment quitter ?'
      window.setTimeout(() => {
        quitArmed = false
        quit.textContent = 'Quitter'
      }, QUIT_CONFIRM_MS)
    })
    const overlay = el(
      'div',
      'overlay',
      el(
        'div',
        'result',
        el('h2', '', 'Pause'),
        button('primary', 'Reprendre', () => {
          overlay.remove()
          resume()
        }),
        ...(challenge
          ? []
          : [
              button('segment-button', 'Terminer', () => {
                overlay.remove()
                finish(currentBeat())
              }),
            ]),
        quit,
      ),
    )
    element.append(overlay)
  }

  function resume(): void {
    if (frozenBeat === null) return
    const resumeBeat = frozenBeat - 1
    clock = createBeatClock(sound.now() + RESUME_LEAD_S, resumeBeat, tempo.bpm)
    nextClickIndex = firstClickAtOrAfter(resumeBeat)
    frozenBeat = null
  }

  function onVisibilityChange(): void {
    if (document.hidden) pause()
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  const removeDemoHook = installDemoHook(nextPendingNote, tap)
  pad.setTarget(clef, defaultWindowStart(clef))
  if (pad.isBlocked()) freezeWhileBlocked(true)
  frame = requestAnimationFrame(tick)
  if (!sound.isRunning()) {
    void sound.whenRunning().then(() => {
      clock = createBeatClock(sound.now() + START_LEAD_S, -bar, tempo.bpm)
      nextClickIndex = 0
    })
  }

  return {
    element,
    pause,
    isOver: () => over,
    destroy() {
      cancelAnimationFrame(frame)
      removeDemoHook()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      pad.destroy()
    },
  }
}
