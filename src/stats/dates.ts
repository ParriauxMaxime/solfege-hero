import { formatDate } from '../i18n/format'
import { dailyKey } from '../series/daily'
import type { DayKey, WeekKey } from './history'

const MS_PER_DAY = 86_400_000
const DAY_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/
const WEEK_FORMAT = /^(\d{4})-W(\d{2})$/
const MONDAY = '2024-01-01'

function utcOf(day: DayKey): Date {
  return new Date(`${day}T00:00:00Z`)
}

function dayOfUtc(date: Date): DayKey {
  return date.toISOString().slice(0, 10)
}

export function isDayKey(value: unknown): value is DayKey {
  return typeof value === 'string' && DAY_FORMAT.test(value) && dayOfUtc(utcOf(value)) === value
}

/** Paris calendar day, the same boundary as the daily challenge. */
export function dayKeyOf(date: Date): DayKey {
  const key = dailyKey(date)
  return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`
}

export function addDays(day: DayKey, count: number): DayKey {
  return dayOfUtc(new Date(utcOf(day).getTime() + count * MS_PER_DAY))
}

/** `count` consecutive days ending on `last`, oldest first. */
export function dayRange(last: DayKey, count: number): DayKey[] {
  return Array.from({ length: count }, (_, index) => addDays(last, index - count + 1))
}

/** Monday = 0 … Sunday = 6. */
export function weekdayIndex(day: DayKey): number {
  return (utcOf(day).getUTCDay() + 6) % 7
}

export function weekKeyOf(day: DayKey): WeekKey {
  const thursday = addDays(day, 3 - weekdayIndex(day))
  const year = Number(thursday.slice(0, 4))
  const firstThursday = addDays(`${year}-01-04`, 3 - weekdayIndex(`${year}-01-04`))
  const week = Math.round((utcOf(thursday).getTime() - utcOf(firstThursday).getTime()) / (7 * MS_PER_DAY)) + 1
  return `${year}-W${String(week).padStart(2, '0')}`
}

export function isWeekKey(value: unknown): value is WeekKey {
  if (typeof value !== 'string') return false
  const match = WEEK_FORMAT.exec(value)
  return match !== null && Number(match[2]) >= 1 && Number(match[2]) <= 53 && addWeeks(value, 0) === value
}

function mondayOf(week: WeekKey): DayKey {
  const match = WEEK_FORMAT.exec(week)
  const year = match ? match[1] : '1970'
  const index = match ? Number(match[2]) : 1
  const firstMonday = addDays(`${year}-01-04`, -weekdayIndex(`${year}-01-04`))
  return addDays(firstMonday, (index - 1) * 7)
}

export function addWeeks(week: WeekKey, count: number): WeekKey {
  return weekKeyOf(addDays(mondayOf(week), count * 7))
}

function withoutAbbreviationDots(text: string): string {
  return text.replaceAll('.', '')
}

/** « 24 oct » / « 24 Oct » */
export function shortDateLabel(day: DayKey): string {
  return withoutAbbreviationDots(formatDate(utcOf(day), { day: 'numeric', month: 'short', timeZone: 'UTC' }))
}

/** « oct » / « Oct » */
export function shortMonthLabel(day: DayKey): string {
  return withoutAbbreviationDots(formatDate(utcOf(day), { month: 'short', timeZone: 'UTC' }))
}

/** Narrow weekday letter, Monday = 0 … Sunday = 6: « L » / « M ». */
export function weekdayInitial(index: number): string {
  return formatDate(utcOf(addDays(MONDAY, index)), { weekday: 'narrow', timeZone: 'UTC' })
}
