import { INSTRUMENTS, type Instrument } from './audio/instruments'
import type { NoteRecord, NoteStats } from './game/sampler'
import { START_BPM_MAX, START_BPM_MIN } from './hero/tempo'
import { CLEFS, type Clef, type Naming } from './music/notes'
import { isDailyKey, type DailyKey } from './series/daily'
import { DEFAULT_SURVIVAL_DELAY, SURVIVAL_DELAYS, type SurvivalDelay } from './survival/game'
import { KEYBOARD_SPANS, type KeyboardSpan } from './ui/keyboardLayout'

export const NAMINGS: readonly Naming[] = ['latin', 'english']
export const THEMES = ['dark', 'light', 'system'] as const
export type Theme = (typeof THEMES)[number]
export const KEY_SIZES = ['S', 'M', 'L'] as const
export type KeySize = (typeof KEY_SIZES)[number]

export interface Settings {
  clefs: Clef[]
  accidentals: boolean
  timed: boolean
  muted: boolean
  heroTempo: number
  metronome: boolean
  /** Melody name; empty means random notes. */
  heroMelody: string
  keyNames: boolean
  naming: Naming
  theme: Theme
  colorblind: boolean
  reducedMotion: boolean
  keySize: KeySize
  keyboardSpan: KeyboardSpan
  vibration: boolean
  volume: number
  instrument: Instrument
  survivalDelayS: SurvivalDelay
}

export const DEFAULT_SETTINGS: Settings = {
  clefs: ['treble'],
  accidentals: true,
  timed: false,
  muted: false,
  heroTempo: 60,
  metronome: true,
  heroMelody: '',
  keyNames: true,
  naming: 'latin',
  theme: 'dark',
  colorblind: false,
  reducedMotion: false,
  keySize: 'M',
  keyboardSpan: 1,
  vibration: true,
  volume: 0.8,
  instrument: 'piano',
  survivalDelayS: DEFAULT_SURVIVAL_DELAY,
}

export interface HeroProgress {
  bestScore: number
  bestStreak: number
  maxBpm: number
  hits: number
  misses: number
  perfects: number
}

export interface SeriesProgress {
  /** Fastest winning series including penalties; 0 means none yet. */
  bestMs: number
  played: number
  won: number
  lost: number
  /** Fastest time in ms per imported or built-in score id. */
  bestByScore: Record<string, number>
}

export interface SurvivalProgress {
  bestScore: number
  played: number
  challengesWon: number
  challengesLost: number
}

export interface DailyAttempt {
  totalMs: number
  results: boolean[]
  penaltyMs: number
}

export interface DailyProgress {
  /** The first attempt of each day, kept for the last 400 days. */
  attempts: Record<DailyKey, DailyAttempt>
  bestMs: number
}

export interface Progress {
  notes: NoteStats
  bestStreak: number
  totalAnswered: number
  bestTimed: number
  hero: HeroProgress
  series: SeriesProgress
  daily: DailyProgress
  survival: SurvivalProgress
}

const MAX_DAILY_ATTEMPTS = 400
const MAX_DAILY_RESULTS = 100

export const EMPTY_DAILY_PROGRESS: DailyProgress = { attempts: {}, bestMs: 0 }

export const EMPTY_SERIES_PROGRESS: SeriesProgress = {
  bestMs: 0,
  played: 0,
  won: 0,
  lost: 0,
  bestByScore: {},
}

export const EMPTY_SURVIVAL_PROGRESS: SurvivalProgress = {
  bestScore: 0,
  played: 0,
  challengesWon: 0,
  challengesLost: 0,
}

export const EMPTY_HERO_PROGRESS: HeroProgress = {
  bestScore: 0,
  bestStreak: 0,
  maxBpm: 0,
  hits: 0,
  misses: 0,
  perfects: 0,
}

export const EMPTY_PROGRESS: Progress = {
  notes: {},
  bestStreak: 0,
  totalAnswered: 0,
  bestTimed: 0,
  hero: EMPTY_HERO_PROGRESS,
  series: EMPTY_SERIES_PROGRESS,
  daily: EMPTY_DAILY_PROGRESS,
  survival: EMPTY_SURVIVAL_PROGRESS,
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
    heroTempo: sanitizeHeroTempo(stored.heroTempo),
    metronome: booleanOr(stored.metronome, DEFAULT_SETTINGS.metronome),
    heroMelody: typeof stored.heroMelody === 'string' ? stored.heroMelody : DEFAULT_SETTINGS.heroMelody,
    keyNames: booleanOr(stored.keyNames, DEFAULT_SETTINGS.keyNames),
    naming: oneOf(NAMINGS, stored.naming, DEFAULT_SETTINGS.naming),
    theme: oneOf(THEMES, stored.theme, DEFAULT_SETTINGS.theme),
    colorblind: booleanOr(stored.colorblind, DEFAULT_SETTINGS.colorblind),
    reducedMotion: booleanOr(stored.reducedMotion, DEFAULT_SETTINGS.reducedMotion),
    keySize: oneOf(KEY_SIZES, stored.keySize, DEFAULT_SETTINGS.keySize),
    keyboardSpan: KEYBOARD_SPANS.find((span) => span === stored.keyboardSpan) ?? DEFAULT_SETTINGS.keyboardSpan,
    vibration: booleanOr(stored.vibration, DEFAULT_SETTINGS.vibration),
    volume: sanitizeVolume(stored.volume),
    instrument: oneOf(INSTRUMENTS, stored.instrument, DEFAULT_SETTINGS.instrument),
    survivalDelayS: SURVIVAL_DELAYS.find((delay) => delay === stored.survivalDelayS) ?? DEFAULT_SETTINGS.survivalDelayS,
  }
}

function oneOf<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return options.find((option) => option === value) ?? fallback
}

function sanitizeVolume(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SETTINGS.volume
  return Math.min(1, Math.max(0, value))
}

function sanitizeHeroTempo(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SETTINGS.heroTempo
  return Math.min(START_BPM_MAX, Math.max(START_BPM_MIN, Math.round(value)))
}

function sanitizeHeroProgress(raw: unknown): HeroProgress {
  const stored = asObject(raw)
  return {
    bestScore: nonNegativeOr(stored.bestScore, 0),
    bestStreak: nonNegativeOr(stored.bestStreak, 0),
    maxBpm: nonNegativeOr(stored.maxBpm, 0),
    hits: nonNegativeOr(stored.hits, 0),
    misses: nonNegativeOr(stored.misses, 0),
    perfects: nonNegativeOr(stored.perfects, 0),
  }
}

function sanitizeNoteRecord(raw: unknown): NoteRecord | null {
  const { attempts, correct, misses, avgMs } = asObject(raw)
  if (!isNonNegative(attempts) || !isNonNegative(correct) || correct > attempts) return null
  if (!isNonNegative(misses) || !isNonNegative(avgMs)) return null
  return { attempts, correct, misses, avgMs }
}

function sanitizeSeriesProgress(raw: unknown): SeriesProgress {
  const stored = asObject(raw)
  return {
    bestMs: nonNegativeOr(stored.bestMs, 0),
    played: nonNegativeOr(stored.played, 0),
    won: nonNegativeOr(stored.won, 0),
    lost: nonNegativeOr(stored.lost, 0),
    bestByScore: sanitizeBestByScore(stored.bestByScore),
  }
}

function sanitizeSurvivalProgress(raw: unknown): SurvivalProgress {
  const stored = asObject(raw)
  return {
    bestScore: nonNegativeOr(stored.bestScore, 0),
    played: nonNegativeOr(stored.played, 0),
    challengesWon: nonNegativeOr(stored.challengesWon, 0),
    challengesLost: nonNegativeOr(stored.challengesLost, 0),
  }
}

function sanitizeBestByScore(raw: unknown): Record<string, number> {
  const best: Record<string, number> = {}
  const entries = Array.isArray(raw) ? [] : Object.entries(asObject(raw))
  for (const [id, ms] of entries) {
    if (isNonNegative(ms) && ms > 0) best[id] = ms
  }
  return best
}

/** Keeps the faster of the stored and new time for a score. */
export function recordScoreBest(progress: Progress, scoreId: string, totalMs: number): Progress {
  const previous = progress.series.bestByScore[scoreId]
  if (previous !== undefined && previous <= totalMs) return progress
  return {
    ...progress,
    series: {
      ...progress.series,
      bestByScore: { ...progress.series.bestByScore, [scoreId]: totalMs },
    },
  }
}

function sanitizeDailyAttempt(raw: unknown): DailyAttempt | null {
  const { totalMs, penaltyMs, results } = asObject(raw)
  if (!isNonNegative(totalMs) || !isNonNegative(penaltyMs)) return null
  if (!Array.isArray(results) || results.length > MAX_DAILY_RESULTS) return null
  if (!results.every((result) => typeof result === 'boolean')) return null
  return { totalMs, penaltyMs, results: results as boolean[] }
}

function newestDays(attempts: Record<DailyKey, DailyAttempt>): Record<DailyKey, DailyAttempt> {
  const kept = Object.keys(attempts).sort().slice(-MAX_DAILY_ATTEMPTS)
  return Object.fromEntries(kept.map((key) => [key, attempts[key] as DailyAttempt]))
}

function sanitizeDailyProgress(raw: unknown): DailyProgress {
  const stored = asObject(raw)
  const attempts: Record<DailyKey, DailyAttempt> = {}
  const entries = Array.isArray(stored.attempts) ? [] : Object.entries(asObject(stored.attempts))
  for (const [key, value] of entries) {
    const attempt = sanitizeDailyAttempt(value)
    if (isDailyKey(key) && attempt) attempts[key] = attempt
  }
  return { attempts: newestDays(attempts), bestMs: nonNegativeOr(stored.bestMs, 0) }
}

/** Only the first attempt of a day counts; later ones leave the progress untouched. */
export function recordDaily(
  progress: Progress,
  key: DailyKey,
  attempt: DailyAttempt,
): { progress: Progress; counted: boolean } {
  if (progress.daily.attempts[key]) return { progress, counted: false }
  const { bestMs } = progress.daily
  return {
    counted: true,
    progress: {
      ...progress,
      daily: {
        attempts: newestDays({ ...progress.daily.attempts, [key]: attempt }),
        bestMs: bestMs === 0 || attempt.totalMs < bestMs ? attempt.totalMs : bestMs,
      },
    },
  }
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
    hero: sanitizeHeroProgress(stored.hero),
    series: sanitizeSeriesProgress(stored.series),
    daily: sanitizeDailyProgress(stored.daily),
    survival: sanitizeSurvivalProgress(stored.survival),
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
  return {
    ...EMPTY_PROGRESS,
    notes: {},
    hero: { ...EMPTY_HERO_PROGRESS },
    series: { ...EMPTY_SERIES_PROGRESS },
    daily: { attempts: {}, bestMs: 0 },
    survival: { ...EMPTY_SURVIVAL_PROGRESS },
  }
}

const EXPORT_APP = 'solfege'
const EXPORT_VERSION = 1

export function exportData(settings: Settings, progress: Progress): string {
  return JSON.stringify(
    {
      app: EXPORT_APP,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      settings,
      progress,
    },
    null,
    2,
  )
}

export function importData(text: string): { settings: Settings; progress: Progress } | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  const data = asObject(parsed)
  if (data.app !== EXPORT_APP) return null
  return { settings: sanitizeSettings(data.settings), progress: sanitizeProgress(data.progress) }
}
