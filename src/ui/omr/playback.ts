import { specBeats } from '../../hero/meter'
import { spelledIn } from '../../omr/edit'
import type { ReviewNote } from '../../omr/edit'
import type { Sound } from '../../audio/sound'

const MS_PER_MINUTE = 60_000

export interface PlaybackOptions {
  sound: Sound
  notes: () => readonly ReviewNote[]
  key: () => number
  tempo: () => number
  /** The index being played, or null once playback stopped. */
  onNote: (index: number | null) => void
}

export interface Playback {
  start: (from: number) => Promise<void>
  stop: () => void
  isPlaying: () => boolean
}

export function createPlayback({ sound, notes, key, tempo, onNote }: PlaybackOptions): Playback {
  let run = 0
  let timer = 0
  let playing = false

  function stop(): void {
    run++
    window.clearTimeout(timer)
    if (!playing) return
    playing = false
    onNote(null)
  }

  async function start(from: number): Promise<void> {
    stop()
    const mine = run
    playing = true
    await sound.whenRunning()
    if (mine !== run) return
    const step = (index: number) => {
      const entry = notes()[index]
      if (!entry) {
        stop()
        return
      }
      onNote(index)
      if (entry.spec.pitch !== null) sound.playNote(spelledIn(entry.spec.pitch, key()))
      timer = window.setTimeout(() => step(index + 1), (specBeats(entry.spec) * MS_PER_MINUTE) / tempo())
    }
    step(from)
  }

  return { start, stop, isPlaying: () => playing }
}
