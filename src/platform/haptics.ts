let enabled = true

export function setVibrationEnabled(value: boolean): void {
  enabled = value
}

export function vibrate(pattern: number | number[]): void {
  if (!enabled) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Vibration is best-effort; some browsers throw when it is blocked.
  }
}
