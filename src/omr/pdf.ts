import { getDocument, PDFWorker } from 'pdfjs-dist/legacy/build/pdf.mjs'
import PdfJsWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker'
import { grayFromRows, planWidth, PROBE_WIDTH, probeUnit } from './budget'
import { PDF_RENDER_TIMEOUT_MS, withDeadline } from './deadline'
import type { GrayImage } from './types'

export const PDF_PREVIEW_WIDTH = 400
/** Rows painted at a time when rendering a page for recognition. */
const PDF_BAND_ROWS = 512

export interface PdfGray {
  gray: GrayImage
  pageCount: number
  /** The page was rendered smaller than its staves need, for the device's memory. */
  reduced: boolean
}

export interface PdfPreview {
  bitmap: ImageBitmap
  pageCount: number
}

export class PdfCancelled extends Error {
  constructor() {
    super('Lecture annulée')
  }
}

type PdfLoading = ReturnType<typeof getDocument>
type PdfDocumentProxy = Awaited<PdfLoading['promise']>
type PdfPageProxy = Awaited<ReturnType<PdfDocumentProxy['getPage']>>

interface OpenDocument {
  loading: PdfLoading
  worker: Worker
  /** Rejects when the pdf.js worker dies. */
  interrupted: Promise<never>
}

/**
 * Renders pages of one PDF, one at a time, each in its own short-lived pdf.js worker (legacy build, for older Android browsers):
 * terminating the worker returns everything it decoded at once, whereas a worker kept for the whole import held about a quarter
 * more memory after flipping through four scanned pages. A start-up failure, a timeout or an aborted `signal` ends the render.
 */
export class PdfSession {
  private open: OpenDocument | null = null
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly data: ArrayBuffer) {}

  close(): void {
    const open = this.open
    this.open = null
    if (!open) return
    void open.loading.destroy().catch(() => {})
    open.worker.terminate()
  }

  private opened(): OpenDocument {
    if (this.open) return this.open
    const worker = new PdfJsWorker()
    const loading = getDocument({
      data: new Uint8Array(this.data.slice(0)),
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
      worker: new PDFWorker({ port: worker as unknown as null }),
      wasmUrl: new URL(`${import.meta.env.BASE_URL}pdfjs-wasm/`, document.baseURI).href,
    })
    const interrupted = new Promise<never>((_, reject) => {
      worker.addEventListener('error', (event) => reject(new Error(event.message || 'le lecteur PDF n’a pas démarré')))
      worker.addEventListener('messageerror', () => reject(new Error('réponse illisible du lecteur PDF')))
    })
    interrupted.catch(() => {})
    this.open = { loading, worker, interrupted }
    return this.open
  }

  /** Runs `use` on page `pageNumber` (1-based) once the renders queued before it are done. */
  private page<T>(pageNumber: number, signal: AbortSignal | undefined, use: (page: PdfPageProxy, pageCount: number) => Promise<T>): Promise<T> {
    const turn = this.queue.then(async () => {
      if (signal?.aborted) throw new PdfCancelled()
      const open = this.opened()
      const aborted = new Promise<never>((_, reject) => signal?.addEventListener('abort', () => reject(new PdfCancelled())))
      aborted.catch(() => {})
      const run = async () => {
        const pdf = await open.loading.promise
        const page = await pdf.getPage(Math.min(Math.max(1, pageNumber), pdf.numPages))
        try {
          return await use(page, pdf.numPages)
        } finally {
          page.cleanup()
        }
      }
      try {
        return await withDeadline(Promise.race([run(), open.interrupted, aborted]), PDF_RENDER_TIMEOUT_MS)
      } finally {
        this.close()
      }
    })
    this.queue = turn.catch(() => {})
    return turn
  }

  /** A small colour render of the page for the picker. */
  preview(pageNumber: number, signal?: AbortSignal): Promise<PdfPreview> {
    return this.page(pageNumber, signal, async (page, pageCount) => {
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: PDF_PREVIEW_WIDTH / base.width })
      const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('canvas 2d unavailable')
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: context as unknown as CanvasRenderingContext2D, viewport }).promise
      const bitmap = canvas.transferToImageBitmap()
      canvas.width = 0
      return { bitmap, pageCount }
    })
  }

  /**
   * Gray render of the page at the width its staves need: a cheap render at PROBE_WIDTH measures the staff spacing, then the page is
   * rendered once at the width that makes it WORKING_UNIT (see `planWidth`). `width` skips the probe and forces a width.
   */
  gray(pageNumber: number, options: { signal?: AbortSignal; deviceMemory?: number; width?: number } = {}): Promise<PdfGray> {
    return this.page(pageNumber, options.signal, async (page, pageCount) => {
      if (options.width) return { gray: await paintGray(page, options.width), pageCount, reduced: false }
      const base = page.getViewport({ scale: 1 })
      const unit = probeUnit(await paintGray(page, PROBE_WIDTH))
      const plan = planWidth(PROBE_WIDTH, unit, base.height / base.width, options.deviceMemory)
      return { gray: await paintGray(page, plan.width), pageCount, reduced: plan.reduced }
    })
  }
}

/**
 * Gray render of the page at `width`, painted a band of rows at a time into one small canvas (the viewport is shifted up for each band),
 * so neither the full-size RGBA canvas nor a full-size ImageData ever exists. The canvas is emptied at the end.
 */
async function paintGray(page: PdfPageProxy, width: number): Promise<GrayImage> {
  const scale = width / page.getViewport({ scale: 1 }).width
  const full = page.getViewport({ scale })
  const pageWidth = Math.ceil(full.width)
  const pageHeight = Math.ceil(full.height)
  const canvas = new OffscreenCanvas(pageWidth, Math.min(PDF_BAND_ROWS, pageHeight))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('canvas 2d unavailable')
  const data = new Uint8Array(pageWidth * pageHeight)
  for (let top = 0; top < pageHeight; top += PDF_BAND_ROWS) {
    const rows = Math.min(PDF_BAND_ROWS, pageHeight - top)
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    const viewport = page.getViewport({ scale, offsetY: -top })
    await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: context as unknown as CanvasRenderingContext2D, viewport }).promise
    data.set(grayFromRows({ width: pageWidth, height: rows, rows: (y, count) => context.getImageData(0, y, pageWidth, count).data }).data, top * pageWidth)
  }
  canvas.width = 0
  canvas.height = 0
  return { width: pageWidth, height: pageHeight, data }
}
