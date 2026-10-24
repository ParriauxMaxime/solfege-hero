import type { NoteRecord, NoteStats } from './game/sampler'
import { CLEFS, type Clef } from './music/notes'

export interface Settings {
  clefs: Clef[]
  accidentals: boolean
  timed: boolean
  muted: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  clefs: ['treble'],
  accidentals: true,
  timed: false,
  muted: false,
}

export interface Progress {
  notes: NoteStats
  bestStreak: number
  totalAnswered: number
  bestTimed: number
}

export const EMPTY_PROGRESS: Progress = {
  notes: {},
  bestStreak: 0,
  totalAnswered: 0,
  bestTimed: 0,
}

const SETTINGS_KEY = 'solfege.settings.v2'
const PROGRESS_KEY = 'solfege.progress.v2'

function asObject(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function isNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function nonNegativeOr(value: unknown, fallback: number): number {
  return isNonNegative(value) ? value : fallback
}

function sanitizeClefs(value: unknown): Clef[] {
  const stored = Array.isArray(value) ? value : []
  const clefs = CLEFS.filter((clef) => stored.includes(clef))
  return clefs.length > 0 ? clefs : [...DEFAULT_SETTINGS.clefs]
}

export function sanitizeSettings(raw: unknown): Settings {
  const stored = asObject(raw)
  return {
    clefs: sanitizeClefs(stored.clefs),
    accidentals: booleanOr(stored.accidentals, DEFAULT_SETTINGS.accidentals),
    timed: booleanOr(stored.timed, DEFAULT_SETTINGS.timed),
    muted: booleanOr(stored.muted, DEFAULT_SETTINGS.muted),
  }
}

function sanitizeNoteRecord(raw: unknown): NoteRecord | null {
  const { attempts, correct, misses, avgMs } = asObject(raw)
  if (!isNonNegative(attempts) || !isNonNegative(correct) || correct > attempts) return null
  if (!isNonNegative(misses) || !isNonNegative(avgMs)) return null
  return { attempts, correct, misses, avgMs }
}

export function sanitizeProgress(raw: unknown): Progress {
  const stored = asObject(raw)
  const notes: NoteStats = {}
  for (const [id, record] of Object.entries(asObject(stored.notes))) {
    const sanitized = sanitizeNoteRecord(record)
    if (sanitized) notes[id] = sanitized
  }
  return {
    notes,
    bestStreak: nonNegativeOr(stored.bestStreak, 0),
    totalAnswered: nonNegativeOr(stored.totalAnswered, 0),
    bestTimed: nonNegativeOr(stored.bestTimed, 0),
  }
}

function readStored(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

// Storage can be unavailable or throw (private mode, quota): data then simply doesn't persist.
function writeStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    return
  }
}

export function loadSettings(): Settings {
  return sanitizeSettings(readStored(SETTINGS_KEY))
}

export function saveSettings(settings: Settings): void {
  writeStored(SETTINGS_KEY, settings)
}

export function loadProgress(): Progress {
  return sanitizeProgress(readStored(PROGRESS_KEY))
}

export function saveProgress(progress: Progress): void {
  writeStored(PROGRESS_KEY, progress)
}

export function resetProgress(): Progress {
  try {
    localStorage.removeItem(PROGRESS_KEY)
  } catch {
    // nothing persisted, nothing to clear
  }
  return { ...EMPTY_PROGRESS, notes: {} }
}
