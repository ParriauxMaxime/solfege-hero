import { frequency } from '../music/notes'
import type { Note } from '../music/notes'

export interface Sound {
  correct(streak: number): void
  wrong(): void
  milestone(): void
  playNote(note: Note): void
  /** Audio clock in seconds; starts the audio context even when muted. */
  now(): number
  /** Schedules a metronome click at audio time `at`. */
  click(at: number, accent: boolean): void
  /** Creates and resumes the audio context; must run inside a user gesture. */
  unlock(): void
  isRunning(): boolean
  /** Resolves once the audio clock is running, immediately if it already is. */
  whenRunning(): Promise<void>
  setMuted(muted: boolean): void
  setVolume(volume: number): void
}

interface SoundOptions {
  onBlocked?: () => void
}

const CORRECT_BASE_HZ = 523.25
const MAX_STREAK_SEMITONES = 12
const MILESTONE_SEMITONES = [0, 4, 7, 12]
const CLICK_HZ = 1200
const CLICK_ACCENT_HZ = 1800
const RESUME_TIMEOUT_MS = 400
const RUNNING_POLL_MS = 100

function transpose(hz: number, semitones: number): number {
  return hz * 2 ** (semitones / 12)
}

function allowPlaybackOnSilentSwitch(): void {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
  if (session) session.type = 'playback'
}

export function createSound({ onBlocked }: SoundOptions = {}): Sound {
  let context: AudioContext | null = null
  let master: GainNode | null = null
  let muted = false
  let volume = 1

  function ensureContext(): AudioContext {
    if (!context) {
      context = new AudioContext()
      master = context.createGain()
      master.gain.value = volume
      master.connect(context.destination)
    }
    if (context.state !== 'running') context.resume().catch(() => {})
    return context
  }

  function isRunning(): boolean {
    return context?.state === 'running'
  }

  function resumed(ctx: AudioContext): Promise<boolean> {
    if (ctx.state === 'running') return Promise.resolve(true)
    const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, RESUME_TIMEOUT_MS))
    return Promise.race([ctx.resume().catch(() => {}), timeout]).then(() => ctx.state === 'running')
  }

  function play(sound: (ctx: AudioContext) => void): void {
    if (muted) return
    const ctx = ensureContext()
    if (ctx.state === 'running') {
      sound(ctx)
      return
    }
    void resumed(ctx).then((running) => {
      if (running) sound(ctx)
      else onBlocked?.()
    })
  }

  function output(): AudioNode {
    ensureContext()
    return master as GainNode
  }

  function playSilence(ctx: AudioContext): void {
    const source = ctx.createBufferSource()
    source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    source.connect(ctx.destination)
    source.start(0)
  }

  function tone(
    ctx: AudioContext,
    type: OscillatorType,
    hz: number,
    start: number,
    duration: number,
    volume: number,
    attack = 0.012,
  ) {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.value = hz
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain).connect(output())
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
  }

  function noiseBurst(ctx: AudioContext, start: number, duration: number, volume: number) {
    const length = Math.ceil(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1
    const source = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    source.buffer = buffer
    filter.type = 'lowpass'
    filter.frequency.value = 400
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    source.connect(filter).connect(gain).connect(output())
    source.start(start)
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && context && context.state !== 'running') context.resume().catch(() => {})
  })

  return {
    correct(streak) {
      play((ctx) => {
        const base = transpose(CORRECT_BASE_HZ, Math.min(streak, MAX_STREAK_SEMITONES))
        const now = ctx.currentTime
        tone(ctx, 'sine', base, now, 0.14, 0.18)
        tone(ctx, 'sine', base * 1.5, now + 0.08, 0.22, 0.18)
      })
    },
    wrong() {
      play((ctx) => {
        const now = ctx.currentTime
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(110, now)
        oscillator.frequency.exponentialRampToValueAtTime(80, now + 0.18)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.35, now + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
        oscillator.connect(gain).connect(output())
        oscillator.start(now)
        oscillator.stop(now + 0.25)
        noiseBurst(ctx, now, 0.08, 0.08)
      })
    },
    milestone() {
      play((ctx) => {
        const now = ctx.currentTime
        MILESTONE_SEMITONES.forEach((semitones, index) => {
          tone(ctx, 'triangle', transpose(CORRECT_BASE_HZ * 2, semitones), now + index * 0.07, 0.3, 0.16)
        })
      })
    },
    playNote(note) {
      play((ctx) => tone(ctx, 'triangle', frequency(note), ctx.currentTime, 0.6, 0.25))
    },
    now: () => ensureContext().currentTime,
    click(at, accent) {
      if (muted || !isRunning()) return
      tone(ensureContext(), 'sine', accent ? CLICK_ACCENT_HZ : CLICK_HZ, at, 0.06, accent ? 0.4 : 0.22, 0.002)
    },
    unlock() {
      allowPlaybackOnSilentSwitch()
      const ctx = ensureContext()
      playSilence(ctx)
    },
    isRunning,
    whenRunning() {
      ensureContext()
      return new Promise((resolve) => {
        const check = () => (isRunning() ? resolve() : window.setTimeout(check, RUNNING_POLL_MS))
        check()
      })
    },
    setMuted(value) {
      muted = value
    },
    setVolume(value) {
      volume = value
      if (master) master.gain.value = value
    },
  }
}
