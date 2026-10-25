import type { Answer } from '../game/strictOctave'
import { pitchClass } from '../music/notes'

export interface NextNote {
  pitchClass: number
  dueInMs: number
}

export interface DemoHook {
  heroNext: () => NextNote | null
  answer: (pitchClass: number) => void
}

declare global {
  interface Window {
    __solfege?: DemoHook
  }
}

function demoEnabled(): boolean {
  return import.meta.env.DEV || new URLSearchParams(location.search).has('demo')
}

export function installDemoHook(
  next: () => { pitch: number; dueInMs: number } | null,
  tap: (answer: Answer) => void,
): () => void {
  if (!demoEnabled()) return () => {}
  window.__solfege = {
    heroNext: () => {
      const upcoming = next()
      return upcoming && { pitchClass: pitchClass(upcoming.pitch), dueInMs: upcoming.dueInMs }
    },
    answer: (chosen) => tap({ pitchClass: chosen, pitch: null }),
  }
  return () => {
    delete window.__solfege
  }
}
