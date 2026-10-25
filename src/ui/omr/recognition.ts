import { RECOGNITION_TIMEOUT_MS, withDeadline } from '../../omr/deadline'
import type { OmrResult, OmrStage, OmrWorkerMessage, OmrWorkerRequest } from '../../omr/types'

export interface Recognition {
  result: Promise<OmrResult>
  cancel: () => void
}

export class RecognitionCancelled extends Error {
  constructor() {
    super('Lecture annulée')
  }
}

/** Runs the recogniser in a Web Worker on a copy of `source`, which stays usable for the review screen. */
export function startRecognition(source: ImageBitmap, staffIndexInSystem: number, onProgress: (stage: OmrStage, percent: number) => void): Recognition {
  const worker = new Worker(new URL('../../omr/worker.ts', import.meta.url), { type: 'module' })
  let cancelled = false
  let reject: (error: Error) => void = () => {}
  const result = new Promise<OmrResult>((resolve, fail) => {
    reject = fail
    worker.onmessage = ({ data }: MessageEvent<OmrWorkerMessage>) => {
      if (data.type === 'progress') onProgress(data.stage, data.percent)
      else if (data.type === 'done') resolve(data.result)
      else fail(new Error(data.message))
    }
    worker.onerror = (event) => fail(new Error(event.message || 'le worker de lecture n’a pas démarré'))
    worker.onmessageerror = () => fail(new Error('réponse illisible du worker de lecture'))
    void createImageBitmap(source).then((copy) => {
      if (cancelled) return copy.close()
      const request: OmrWorkerRequest = { image: copy, staffIndexInSystem }
      worker.postMessage(request, [copy])
    }, fail)
  })
  const finish = () => worker.terminate()
  const limited = withDeadline(result, RECOGNITION_TIMEOUT_MS, finish)
  void limited.then(finish, finish)
  return {
    result: limited,
    cancel() {
      cancelled = true
      worker.terminate()
      reject(new RecognitionCancelled())
    },
  }
}
