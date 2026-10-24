import type { Sound } from '../audio/sound'
import { createBeatClock, withTempo, type BeatClock } from '../hero/clock'
import { expiredNotes, noteInWindow, timingJudgement } from '../hero/judgement'
import { INITIAL_HERO_SCORE, applyJudgement, type HeroScore } from '../hero/scoring'
import { melodySource, placeNotes, randomSource, type NoteSource } from '../hero/sources'
import { adaptTempo, type TempoState } from '../hero/tempo'
import { BEATS_PER_BAR, type HeroNote, type Judgement, type Melody } from '../hero/types'
import { buildPool, promptId, recordAnswer } from '../game/sampler'
import { multiplier } from '../game/scoring'
import { randomKey, spellInKey } from '../music/keySignature'
import { noteName, pitchClass, type Clef, type Note } from '../music/notes'
import { vibrate } from '../platform/haptics'
import type { Progress, Settings } from '../storage'
import { createAnswerPad } from './answerPad'
import { button, el, iconButton, setIcon } from './dom'
import { burstConfetti, burstParticles, centerOf, floatText, restartAnimation } from './effects'
import { createScrollingStaff } from './heroStaff'

const COUNT_IN_BEATS = 4
const BARS_AHEAD = 3
const CLICK_LOOKAHEAD_S = 0.15
const RESUME_LEAD_S = 0.3
const START_LEAD_S = 0.1
const INLINE_ACCIDENTAL_CHANCE = 0.02
const QUIT_CONFIRM_MS = 3000
const NEUTRAL_FLASH_MS = 150
const FLOAT_OFFSET_PX = 40
const JUDGEMENT_LABELS: Record<Judgement, string> = { parfait: 'Parfait', bien: 'Bien', rate: 'Raté' }

export interface HeroOptions {
  settings: Settings
  progress: Progress
  sound: Sound
  melody: Melody | null
  isMuted: () => boolean
  onToggleMute: () => void
  onProgress: (progress: Progress) => void
  onQuit: () => void
}

export interface Hero {
  element: HTMLElement
  pause: () => void
  destroy: () => void
}

export function createHero({
  settings,
  progress: initialProgress,
  sound,
  melody,
  isMuted,
  onToggleMute,
  onProgress,
  onQuit,
}: HeroOptions): Hero {
  const clef: Clef = melody?.clef ?? (settings.clefs[Math.floor(Math.random() * settings.clefs.length)] as Clef)
  const fifths = melody ? melody.key : settings.accidentals ? randomKey() : 0
  const source: NoteSource = melody
    ? melodySource(melody)
    : randomSource(
        buildPool([clef], true).filter((prompt) => spellInKey(prompt.pitch, fifths) !== null),
        () => progress.notes,
      )
  let progress = initialProgress
  let score: HeroScore = INITIAL_HERO_SCORE
  let tempo: TempoState = { bpm: settings.heroTempo, hitsInRow: 0 }
  let clock: BeatClock = createBeatClock(sound.now() + START_LEAD_S, -COUNT_IN_BEATS, tempo.bpm)
  let notes: HeroNote[] = []
  const judged = new Set<number>()
  let nextId = 0
  let nextBarBeat = 0
  let nextClickBeat = -COUNT_IN_BEATS
  let frozenBeat: number | null = null
  let introDone = false
  let frame = 0

  const staff = createScrollingStaff(clef, fifths)
  const scoreValue = el('span', 'hud-value', '0')
  const streakValue = el('span', 'streak-value', '0')
  const streak = el('div', 'hud-streak', el('span', 'flame', '🔥'), streakValue)
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
  const hud = el('div', 'hud', el('div', 'hud-score', scoreValue), streak, multiplierValue, bpm, muteButton, pauseButton)
  const countIn = el('div', 'count-in')
  const staffArea = el('div', 'hero-staff', staff.element, countIn)
  const pad = createAnswerPad(tap, settings.naming, settings.keyboardSpan)
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
    while (nextBarBeat < nowBeat + BARS_AHEAD * BEATS_PER_BAR) {
      const placed = placeNotes(source.nextBar(), nextBarBeat, nextId, fifths, melody ? 0 : INLINE_ACCIDENTAL_CHANCE)
      notes.push(...placed)
      nextId += placed.length
      nextBarBeat += BEATS_PER_BAR
    }
    notes = notes.filter((note) => note.beat >= nowBeat - BEATS_PER_BAR)
  }

  function scheduleClicks(): void {
    const horizon = sound.now() + CLICK_LOOKAHEAD_S
    while (clock.timeAt(nextClickBeat) < horizon) {
      const time = clock.timeAt(nextClickBeat)
      if (settings.metronome && time >= sound.now()) sound.click(time, nextClickBeat % BEATS_PER_BAR === 0)
      nextClickBeat++
    }
  }

  function renderCountIn(nowBeat: number): void {
    introDone ||= nowBeat >= 0
    countIn.textContent = introDone ? '' : String(Math.max(1, Math.floor(nowBeat) + COUNT_IN_BEATS + 1))
  }

  function tick(): void {
    frame = requestAnimationFrame(tick)
    const nowBeat = currentBeat()
    if (frozenBeat === null) {
      fillBars(nowBeat)
      scheduleClicks()
      for (const note of expiredNotes(notes, judged, nowBeat, clock)) judge(note, 'rate')
    }
    renderCountIn(nowBeat)
    staff.render(notes, nowBeat, 0)
  }

  function deadTap(chosen: number): void {
    const nowBeat = currentBeat()
    const nearest = notes
      .filter((note) => note.pitch !== null)
      .reduce<HeroNote | null>((best, note) => (!best || Math.abs(note.beat - nowBeat) < Math.abs(best.beat - nowBeat) ? note : best), null)
    pad.clear()
    pad.flash(chosen, 'neutral')
    window.setTimeout(() => pad.clear(), NEUTRAL_FLASH_MS)
    const zone = staff.element.querySelector('.hero-hit-zone') ?? staff.element
    floatText(effectsLayer, centerOf(zone), nearest && nearest.beat < nowBeat ? 'Trop tard' : 'Trop tôt', 'neutral')
  }

  function tap(chosen: number): void {
    if (frozenBeat !== null) return
    const target = noteInWindow(notes, judged, currentBeat(), clock)
    if (!target || target.pitch === null) {
      deadTap(chosen)
      return
    }
    const deltaMs = (sound.now() - clock.timeAt(target.beat)) * 1000
    pad.clear()
    if (chosen !== pitchClass(target.pitch)) {
      pad.flash(chosen, 'wrong')
      pad.flash(pitchClass(target.pitch), 'reveal')
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
    adaptTempoTo(hit)
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
      bestStreak: Math.max(progress.bestStreak, score.bestStreak),
      totalAnswered: progress.totalAnswered + 1,
      hero: {
        bestScore: Math.max(hero.bestScore, score.score),
        bestStreak: Math.max(hero.bestStreak, score.bestStreak),
        maxBpm: Math.max(hero.maxBpm, tempo.bpm),
        hits: hero.hits + (hit ? 1 : 0),
        misses: hero.misses + (hit ? 0 : 1),
        perfects: hero.perfects + (judgement === 'parfait' ? 1 : 0),
      },
    }
    onProgress(progress)
  }

  function adaptTempoTo(hit: boolean): void {
    const next = adaptTempo(tempo, hit)
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

  function pause(): void {
    if (frozenBeat !== null) return
    frozenBeat = currentBeat()
    let quitArmed = false
    const quit = button('danger', 'Quitter', () => {
      if (quitArmed) {
        onQuit()
        return
      }
      quitArmed = true
      quit.textContent = 'Vraiment quitter ?'
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
        quit,
      ),
    )
    element.append(overlay)
  }

  function resume(): void {
    if (frozenBeat === null) return
    const resumeBeat = frozenBeat - 1
    clock = createBeatClock(sound.now() + RESUME_LEAD_S, resumeBeat, tempo.bpm)
    nextClickBeat = Math.ceil(resumeBeat)
    frozenBeat = null
  }

  function onVisibilityChange(): void {
    if (document.hidden) pause()
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  frame = requestAnimationFrame(tick)
  if (!sound.isRunning()) {
    void sound.whenRunning().then(() => {
      clock = createBeatClock(sound.now() + START_LEAD_S, -COUNT_IN_BEATS, tempo.bpm)
      nextClickBeat = -COUNT_IN_BEATS
    })
  }

  return {
    element,
    pause,
    destroy() {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      pad.destroy()
    },
  }
}
