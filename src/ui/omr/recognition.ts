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
    worker.onerror = (event) => fail(new Error(event.message || 'La lecture a échoué'))
    void createImageBitmap(source).then((copy) => {
      if (cancelled) return copy.close()
      const request: OmrWorkerRequest = { image: copy, staffIndexInSystem }
      worker.postMessage(request, [copy])
    }, fail)
  })
  const finish = () => worker.terminate()
  void result.then(finish, finish)
  return {
    result,
    cancel() {
      cancelled = true
      worker.terminate()
      reject(new RecognitionCancelled())
    },
  }
}
