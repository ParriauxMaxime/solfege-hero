export const FILE_READ_TIMEOUT_MS = 20_000
export const PHOTO_DECODE_TIMEOUT_MS = 40_000
export const PDF_RENDER_TIMEOUT_MS = 60_000
export const RECOGNITION_TIMEOUT_MS = 60_000

export class StageTimeout extends Error {
  constructor(ms: number) {
    super(`délai dépassé (${Math.round(ms / 1000)} s)`)
  }
}

/** Rejects with a StageTimeout when `promise` has not settled after `ms`, and runs `onTimeout` to release what it holds. */
export function withDeadline<T>(promise: Promise<T>, ms: number, onTimeout: () => void = () => {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout()
      reject(new StageTimeout(ms))
    }, ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}
