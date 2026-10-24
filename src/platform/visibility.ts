/** Calls `onReturn` with how long the page stayed hidden; returns the unsubscribe function. */
export function trackHiddenTime(onReturn: (hiddenMs: number) => void): () => void {
  let hiddenAt: number | null = null

  function onChange(): void {
    if (document.hidden) {
      hiddenAt = performance.now()
    } else if (hiddenAt !== null) {
      onReturn(performance.now() - hiddenAt)
      hiddenAt = null
    }
  }

  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}
