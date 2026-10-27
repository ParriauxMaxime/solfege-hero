import { t } from '../i18n'
import { dailyLabel, type DailyKey } from './daily'

const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60

export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / MS_PER_SECOND)
  const remainder = String(seconds % SECONDS_PER_MINUTE).padStart(2, '0')
  return `${Math.floor(seconds / SECONDS_PER_MINUTE)}:${remainder}`
}

const MS_PER_TENTH = 100

/** Rounds up to a tenth of a second so a sharer never looks faster than they were. */
export function ceilToTenth(ms: number): number {
  return Math.ceil(ms / MS_PER_TENTH) * MS_PER_TENTH
}

export function formatTenths(ms: number): string {
  const tenths = Math.floor(ms / MS_PER_TENTH)
  return `${formatTime(ms)}.${tenths % 10}`
}

/** A player's own time as shared: same rounding as the link and the share text. */
export function formatTenthsUp(ms: number): string {
  return formatTenths(ceilToTenth(ms))
}

export interface ShareSquares {
  ok: string
  bad: string
}

const DEFAULT_SQUARES: ShareSquares = { ok: '🟩', bad: '🟥' }

export const COLORBLIND_SQUARES: ShareSquares = { ok: '🟦', bad: '🟧' }

export type ShareDialogKind = 'daily' | 'series' | 'survival' | 'dictation'

export function shareDialogTitle(kind: ShareDialogKind): string {
  return t(`share.dialog.${kind}`)
}

export function seriesShareTitle(seed: number): string {
  return t('share.title.series', { seed: String(seed) })
}

export function scoreShareTitle(name: string): string {
  return t('share.title.score', { name })
}

export function dictationShareTitle(seed: number): string {
  return t('share.title.dictation', { seed: String(seed) })
}

export function dailyShareTitle(key: DailyKey): string {
  return t('share.title.daily', { date: dailyLabel(key) })
}

export function dailyCallToAction(): string {
  return t('share.ctaDaily')
}

export function shareText(input: {
  /** What was played, after "Solfège hero · ", e.g. "Série #4821". */
  title: string
  results: boolean[]
  totalMs: number
  penaltyMs: number
  squares?: ShareSquares
  /** Closing line, « Bats-moi ! » by default. */
  callToAction?: string
}): string {
  const { ok, bad } = input.squares ?? DEFAULT_SQUARES
  const hits = input.results.filter(Boolean).length
  const counts = { hits, total: input.results.length, seconds: input.penaltyMs / MS_PER_SECOND }
  return [
    t('share.header', { title: input.title, time: formatTenthsUp(input.totalMs) }),
    input.results.map((result) => (result ? ok : bad)).join(''),
    t(input.penaltyMs > 0 ? 'share.firstTryPenalty' : 'share.firstTry', counts),
    input.callToAction ?? t('share.cta'),
  ].join('\n')
}
