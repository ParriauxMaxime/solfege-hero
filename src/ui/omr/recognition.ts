import { getLanguage, t } from '../../i18n'
import { RECOGNITION_TIMEOUT_MS, withDeadline } from '../../omr/deadline'
import type { GrayImage, OmrResult, OmrStage, OmrWorkerMessage, OmrWorkerRequest } from '../../omr/types'

export interface Recognition {
  result: Promise<OmrResult>
  cancel: () => void
}

export class RecognitionCancelled extends Error {
  constructor() {
    super('Lecture annulée')
  }
}

/** Runs the recogniser in a Web Worker on a transferred copy of `source`, which stays usable for the review screen. */
export function startRecognition(source: GrayImage, staffIndexInSystem: number, onProgress: (stage: OmrStage, percent: number) => void): Recognition {
  const worker = new Worker(new URL('../../omr/worker.ts', import.meta.url), { type: 'module' })
  let reject: (error: Error) => void = () => {}
  const result = new Promise<OmrResult>((resolve, fail) => {
    reject = fail
    worker.onmessage = ({ data }: MessageEvent<OmrWorkerMessage>) => {
      if (data.type === 'progress') onProgress(data.stage, data.percent)
      else if (data.type === 'done') resolve(data.result)
      else fail(new Error(data.message))
    }
    worker.onerror = (event) => fail(new Error(event.message || t('omr.errors.workerNotStarted')))
    worker.onmessageerror = () => fail(new Error(t('omr.errors.workerUnreadable')))
    const copy = new Uint8Array(source.data)
    const request: OmrWorkerRequest = { image: { width: source.width, height: source.height, data: copy }, staffIndexInSystem, language: getLanguage() }
    worker.postMessage(request, [copy.buffer])
  })
  const finish = () => worker.terminate()
  const limited = withDeadline(result, RECOGNITION_TIMEOUT_MS, finish)
  void limited.then(finish, finish)
  return {
    result: limited,
    cancel() {
      worker.terminate()
      reject(new RecognitionCancelled())
    },
  }
}
