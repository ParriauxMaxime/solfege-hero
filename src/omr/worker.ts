import { recognize } from './recognize'
import type { OmrStage, OmrWorkerMessage, OmrWorkerRequest } from './types'

interface WorkerScope {
  postMessage(message: OmrWorkerMessage): void
  onmessage: ((event: MessageEvent<OmrWorkerRequest>) => void) | null
}

/** Share of the progress bar each stage covers. */
const STAGE_RANGE: Record<OmrStage, [number, number]> = {
  preprocess: [0, 15],
  staves: [15, 30],
  symbols: [30, 90],
  music: [90, 100],
}

const scope = self as unknown as WorkerScope

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

self.addEventListener('unhandledrejection', (event) => scope.postMessage({ type: 'error', message: describe((event as PromiseRejectionEvent).reason) }))
self.addEventListener('messageerror', () => scope.postMessage({ type: 'error', message: 'image illisible par le worker' }))

scope.onmessage = ({ data }) => {
  try {
    const result = recognize(data.image, {
      staffIndexInSystem: data.staffIndexInSystem,
      onProgress: (stage, fraction) => {
        const [from, to] = STAGE_RANGE[stage]
        scope.postMessage({ type: 'progress', stage, percent: Math.round(from + (to - from) * fraction) })
      },
    })
    scope.postMessage({ type: 'done', result })
  } catch (error) {
    scope.postMessage({ type: 'error', message: describe(error) })
  }
}
