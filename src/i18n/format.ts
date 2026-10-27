import { getLanguage, type Language } from './language'

const LOCALES: Record<Language, string> = { fr: 'fr-FR', en: 'en-GB' }
const NARROW_NO_BREAK_SPACE = ' '

export function currentLocale(): string {
  return LOCALES[getLanguage()]
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(currentLocale(), options).format(value)
}

export function formatDecimal(value: number, digits = 1): string {
  return formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** Ratio 0..1 → « 42 % » in French (narrow no-break space), « 42% » in English. */
export function formatPercent(ratio: number, digits = 0): string {
  const text = formatNumber(ratio, { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits })
  return text.replace(/[  ](?=%)/, NARROW_NO_BREAK_SPACE)
}

export function formatDate(date: Date | number, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat(currentLocale(), options).format(date)
}

export function formatTime(date: Date | number): string {
  return formatDate(date, { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** « 42,3 s » / « 42.3 s » from milliseconds. */
export function formatSeconds(ms: number, digits = 1): string {
  const space = getLanguage() === 'fr' ? NARROW_NO_BREAK_SPACE : ' '
  return `${formatDecimal(ms / 1000, digits)}${space}s`
}

/** « 1:05 » from milliseconds. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}
