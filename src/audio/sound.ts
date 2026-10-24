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
  setMuted(muted: boolean): void
}

const CORRECT_BASE_HZ = 523.25
const MAX_STREAK_SEMITONES = 12
const MILESTONE_SEMITONES = [0, 4, 7, 12]
const CLICK_HZ = 1200
const CLICK_ACCENT_HZ = 1800

function transpose(hz: number, semitones: number): number {
  return hz * 2 ** (semitones / 12)
}

export function createSound(): Sound {
  let context: AudioContext | null = null
  let muted = false

  function ensureContext(): AudioContext {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    return context
  }

  function audio(): AudioContext | null {
    return muted ? null : ensureContext()
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
    oscillator.connect(gain).connect(ctx.destination)
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
    source.connect(filter).connect(gain).connect(ctx.destination)
    source.start(start)
  }

  return {
    correct(streak) {
      const ctx = audio()
      if (!ctx) return
      const base = transpose(CORRECT_BASE_HZ, Math.min(streak, MAX_STREAK_SEMITONES))
      const now = ctx.currentTime
      tone(ctx, 'sine', base, now, 0.14, 0.18)
      tone(ctx, 'sine', base * 1.5, now + 0.08, 0.22, 0.18)
    },
    wrong() {
      const ctx = audio()
      if (!ctx) return
      const now = ctx.currentTime
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(110, now)
      oscillator.frequency.exponentialRampToValueAtTime(80, now + 0.18)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.35, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.25)
      noiseBurst(ctx, now, 0.08, 0.08)
    },
    milestone() {
      const ctx = audio()
      if (!ctx) return
      const now = ctx.currentTime
      MILESTONE_SEMITONES.forEach((semitones, index) => {
        tone(ctx, 'triangle', transpose(CORRECT_BASE_HZ * 2, semitones), now + index * 0.07, 0.3, 0.16)
      })
    },
    playNote(note) {
      const ctx = audio()
      if (!ctx) return
      tone(ctx, 'triangle', frequency(note), ctx.currentTime, 0.6, 0.25)
    },
    now: () => ensureContext().currentTime,
    click(at, accent) {
      const ctx = audio()
      if (!ctx) return
      tone(ctx, 'sine', accent ? CLICK_ACCENT_HZ : CLICK_HZ, at, 0.06, accent ? 0.4 : 0.22, 0.002)
    },
    setMuted(value) {
      muted = value
    },
  }
}
