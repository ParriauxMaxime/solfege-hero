// Browser side of scripts/omr-eval-pdf.mjs: renders a PDF page with pdfjs, runs the recogniser and draws what it read.
import { noteAccuracy } from '../../src/omr/accuracy'
import { PdfSession } from '../../src/omr/pdf'
import { binarize } from '../../src/omr/image'
import { recognize } from '../../src/omr/recognize'
import { measureStaffMetrics } from '../../src/omr/staves'
import type { NoteSpec } from '../../src/hero/types'
import type { GrayImage, OmrWorkerMessage, OmrWorkerRequest } from '../../src/omr/types'
import { noteName, spell } from '../../src/music/notes'

const SHORT: Record<string, string> = { whole: 'w', half: 'h', quarter: 'q', eighth: 'e', sixteenth: 's' }

function label(spec: NoteSpec): string {
  const name = spec.pitch === null ? 'r' : noteName(spell(spec.pitch, false), 'english')
  return `${name}${SHORT[spec.duration]}${'.'.repeat(spec.dots ?? 0)}`
}

function bytesOf(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

declare global {
  interface Window {
    evalPage: (base64: string, pageNumber: number, staffIndex: number, truth: NoteSpec[] | null) => Promise<unknown>
  }
}

function viaWorker(image: GrayImage, staffIndexInSystem: number): Promise<{ notes: number; progress: number[] }> {
  const worker = new Worker(new URL('../../src/omr/worker.ts', import.meta.url), { type: 'module' })
  const progress: number[] = []
  return new Promise((resolve, reject) => {
    worker.onmessage = ({ data }: MessageEvent<OmrWorkerMessage>) => {
      if (data.type === 'progress') progress.push(data.percent)
      else if (data.type === 'done') resolve({ notes: data.result.score.notes.length, progress })
      else reject(new Error(data.message))
      if (data.type !== 'progress') worker.terminate()
    }
    worker.onerror = (event) => reject(new Error(event.message))
    const copy = image.data.slice()
    worker.postMessage({ image: { ...image, data: copy }, staffIndexInSystem } satisfies OmrWorkerRequest, [copy.buffer])
  })
}

window.evalPage = async (base64, pageNumber, staffIndex, truth) => {
  const started = performance.now()
  const query = new URLSearchParams(location.search)
  const session = new PdfSession(bytesOf(base64))
  const { gray, pageCount, reduced } = await session.gray(pageNumber, {
    width: Number(query.get('width')) || undefined,
    deviceMemory: query.has('memory') ? Number(query.get('memory')) : undefined,
  })
  session.close()
  const image = gray
  const renderMs = performance.now() - started
  const unit = measureStaffMetrics(binarize(gray))?.unit
  const t0 = performance.now()
  const result = recognize(gray, { staffIndexInSystem: staffIndex })
  const recognizeMs = performance.now() - t0
  const worker = await viaWorker(image, staffIndex)

  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  const pixels = context.createImageData(image.width, image.height)
  for (let i = 0; i < image.data.length; i++) pixels.data.set([image.data[i] as number, image.data[i] as number, image.data[i] as number, 255], i * 4)
  context.putImageData(pixels, 0, 0)
  const raster = canvas.toDataURL('image/png')
  context.lineWidth = 3
  context.font = 'bold 22px sans-serif'
  for (const staff of result.staves) {
    context.strokeStyle = 'rgba(0,120,255,0.9)'
    context.strokeRect(staff.box.x, staff.box.y, staff.box.width, staff.box.height)
    for (const { index, box } of staff.notes) {
      const spec = result.score.notes[index] as NoteSpec
      const doubtful = (result.confidence[index] as number) < 0.5
      context.strokeStyle = doubtful ? 'rgba(255,140,0,0.95)' : 'rgba(220,0,0,0.9)'
      context.strokeRect(box.x, box.y, box.width, box.height)
      context.fillStyle = doubtful ? 'rgb(255,120,0)' : 'rgb(200,0,0)'
      context.fillText(label(spec), box.x, box.y - 6 - (index % 2) * 22)
    }
  }
  return {
    pageCount,
    width: image.width,
    height: image.height,
    unit,
    reduced,
    renderMs,
    recognizeMs,
    workerNotes: worker.notes,
    workerProgress: worker.progress.join(','),
    timings: result.timings,
    systems: result.systems,
    staves: result.staves.map((s) => ({ system: s.system, box: s.box, notes: s.notes.length })),
    clef: result.score.clef,
    key: result.score.key,
    timeSignature: result.score.timeSignature,
    notes: result.score.notes.map(label),
    uncertainMeasures: result.measures.filter((m) => m.uncertain).length,
    measures: result.measures.length,
    doubtful: result.confidence.filter((c) => c < 0.5).length,
    warnings: result.warnings,
    accuracy: truth ? noteAccuracy(truth, result.score.notes) : null,
    raster,
    overlay: canvas.toDataURL('image/png'),
  }
}
