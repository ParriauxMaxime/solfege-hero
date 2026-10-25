const MINUS = '−'

function decimalComma(value: number, digits: number): string {
  return value.toFixed(digits).replace('.', ',')
}

function signed(value: number, digits: number): string {
  const text = decimalComma(Math.abs(value), digits)
  if (Number(text.replace(',', '.')) === 0) return text
  return `${value < 0 ? MINUS : '+'}${text}`
}

/** « 42,3 s » from milliseconds. */
export function formatSeconds(ms: number, digits = 1): string {
  return `${decimalComma(ms / 1000, digits)} s`
}

/** Axis label for a value already in seconds: « 30 s », « 0,5 s ». */
export function formatAxisSeconds(seconds: number): string {
  return `${String(Math.round(seconds * 100) / 100).replace('.', ',')} s`
}

export function formatPercent(value: number): string {
  return `${Math.round(value)} %`
}

export function formatSignedPoints(delta: number): string {
  const rounded = Math.round(delta)
  return `${signed(rounded, 0)} ${Math.abs(rounded) < 2 ? 'pt' : 'pts'}`
}

export function formatSignedSeconds(deltaMs: number): string {
  return `${signed(deltaMs / 1000, 1)} s`
}

export function formatSignedInteger(delta: number): string {
  return signed(Math.round(delta), 0)
}
