import { DEFAULT_SERIES_DIFFICULTY, type RandomSeriesConfig } from './series'

/** A calendar day in Paris, written "YYYYMMDD". */
export type DailyKey = string

const TIME_ZONE = 'Europe/Paris'
const KEY_FORMAT = /^\d{8}$/
const HASH_PREFIX = 'daily='
const MS_PER_DAY = 86_400_000

const parisParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function dateOf(key: DailyKey): Date {
  return new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8))))
}

function keyOf(date: Date): DailyKey {
  return date.toISOString().slice(0, 10).replaceAll('-', '')
}

/** True for a well-formed key naming a real calendar day. */
export function isDailyKey(value: unknown): value is DailyKey {
  return typeof value === 'string' && KEY_FORMAT.test(value) && keyOf(dateOf(value)) === value
}

export function dailyKey(date: Date): DailyKey {
  const part = (type: string) => parisParts.formatToParts(date).find((p) => p.type === type)?.value ?? ''
  return `${part('year')}${part('month')}${part('day')}`
}

export function dailyLabel(key: DailyKey): string {
  return `${key.slice(6, 8)}/${key.slice(4, 6)}/${key.slice(0, 4)}`
}

export function dailyConfig(key: DailyKey): RandomSeriesConfig {
  return { kind: 'random', version: 3, seed: Number(key), clefs: ['treble'], armures: true, difficulty: DEFAULT_SERIES_DIFFICULTY }
}

export function encodeDailyHash(key: DailyKey): string {
  return `${HASH_PREFIX}${key}`
}

export function parseDailyHash(hash: string): DailyKey | null {
  const key = new URLSearchParams(hash.replace(/^#/, '')).get('daily')
  return isDailyKey(key) ? key : null
}

/** Consecutive days played, ending today, or yesterday while today is still to play. */
export function dailyStreak(playedKeys: Iterable<DailyKey>, today: DailyKey): number {
  const played = new Set(playedKeys)
  const previous = (key: DailyKey) => keyOf(new Date(dateOf(key).getTime() - MS_PER_DAY))

  let day = played.has(today) ? today : previous(today)
  let streak = 0
  while (played.has(day)) {
    streak++
    day = previous(day)
  }
  return streak
}
