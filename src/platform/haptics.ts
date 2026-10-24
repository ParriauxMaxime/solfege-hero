export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Vibration is best-effort; some browsers throw when it is blocked.
  }
}
