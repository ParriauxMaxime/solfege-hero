const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60

export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / MS_PER_SECOND)
  const remainder = String(seconds % SECONDS_PER_MINUTE).padStart(2, '0')
  return `${Math.floor(seconds / SECONDS_PER_MINUTE)}:${remainder}`
}

const MS_PER_TENTH = 100

export function formatTenths(ms: number): string {
  const tenths = Math.floor(ms / MS_PER_TENTH)
  return `${formatTime(ms)}.${tenths % 10}`
}

export interface ShareSquares {
  ok: string
  bad: string
}

const DEFAULT_SQUARES: ShareSquares = { ok: '🟩', bad: '🟥' }

export const COLORBLIND_SQUARES: ShareSquares = { ok: '🟦', bad: '🟧' }

export function shareText(input: {
  seed: number
  results: boolean[]
  totalMs: number
  penaltyMs: number
  url: string
  squares?: ShareSquares
}): string {
  const { ok, bad } = input.squares ?? DEFAULT_SQUARES
  const penalty = input.penaltyMs > 0 ? ` (+${input.penaltyMs / MS_PER_SECOND} s)` : ''
  const firstTry = input.results.filter(Boolean).length
  return [
    `Solfège hero · Série #${input.seed}`,
    input.results.map((result) => (result ? ok : bad)).join(''),
    `⏱ ${formatTime(input.totalMs)}${penalty} · ${firstTry}/${input.results.length}`,
    `Bats-moi : ${input.url}`,
  ].join('\n')
}
