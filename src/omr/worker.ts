import { recognize, rgbaToGray } from './recognize'
import type { GrayImage, OmrStage, OmrWorkerMessage, OmrWorkerRequest } from './types'

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

function toGray(image: ImageData | ImageBitmap): GrayImage {
  if ('data' in image) return rgbaToGray(image.data, image.width, image.height)
  const canvas = new OffscreenCanvas(image.width, image.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas 2d unavailable')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, image.width, image.height)
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, image.width, image.height)
  return rgbaToGray(pixels.data, pixels.width, pixels.height)
}

scope.onmessage = ({ data }) => {
  try {
    const gray = toGray(data.image)
    if ('close' in data.image) data.image.close()
    const result = recognize(gray, {
      staffIndexInSystem: data.staffIndexInSystem,
      onProgress: (stage, fraction) => {
        const [from, to] = STAGE_RANGE[stage]
        scope.postMessage({ type: 'progress', stage, percent: Math.round(from + (to - from) * fraction) })
      },
    })
    scope.postMessage({ type: 'done', result })
  } catch (error) {
    scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
