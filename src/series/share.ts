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

export function shareText(input: {
  /** What was played, after "Solfège hero · ", e.g. "Série #4821". */
  title: string
  results: boolean[]
  totalMs: number
  penaltyMs: number
  url: string
  squares?: ShareSquares
  /** Sentence before the link, "Bats-moi" by default. */
  callToAction?: string
}): string {
  const { ok, bad } = input.squares ?? DEFAULT_SQUARES
  const penalty = input.penaltyMs > 0 ? ` (+${input.penaltyMs / MS_PER_SECOND} s)` : ''
  const firstTry = input.results.filter(Boolean).length
  return [
    `Solfège hero · ${input.title}`,
    input.results.map((result) => (result ? ok : bad)).join(''),
    `⏱ ${formatTenthsUp(input.totalMs)}${penalty} · ${firstTry}/${input.results.length}`,
    `${input.callToAction ?? 'Bats-moi'} : ${input.url}`,
  ].join('\n')
}
