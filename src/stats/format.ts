import { t } from '../i18n'
import { formatDecimal, formatNumber, formatPercent as formatRatio, formatSeconds } from '../i18n/format'
import { getLanguage } from '../i18n/language'

export { formatSeconds }

const MINUS = '−'
const NARROW_NO_BREAK_SPACE = ' '

function sign(value: number, digits: number): string {
  if (Number(Math.abs(value).toFixed(digits)) === 0) return ''
  return value < 0 ? MINUS : '+'
}

/** Axis label for a value already in seconds: « 30 s », « 0,5 s ». */
export function formatAxisSeconds(seconds: number): string {
  const space = getLanguage() === 'fr' ? NARROW_NO_BREAK_SPACE : ' '
  return `${formatNumber(Math.round(seconds * 100) / 100)}${space}s`
}

/** Value on a 0..100 scale → « 42 % » / « 42% ». */
export function formatPercent(value: number): string {
  return formatRatio(Math.round(value) / 100)
}

export function formatSignedPoints(delta: number): string {
  const rounded = Math.round(delta)
  return t('stats.summary.points', { sign: sign(rounded, 0), count: Math.abs(rounded) })
}

export function formatSignedSeconds(deltaMs: number): string {
  return `${sign(deltaMs / 1000, 1)}${formatSeconds(Math.abs(deltaMs))}`
}

export function formatSignedInteger(delta: number): string {
  const rounded = Math.round(delta)
  return `${sign(rounded, 0)}${formatDecimal(Math.abs(rounded), 0)}`
}
