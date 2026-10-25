import { getDocument, PDFWorker } from 'pdfjs-dist/legacy/build/pdf.mjs'
import PdfJsWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker'
import { PDF_RENDER_TIMEOUT_MS, withDeadline } from './deadline'

/** About 300 dpi on an A4 page. */
export const PDF_MIN_WIDTH = 2480

export interface PdfPage {
  image: ImageData
  pageCount: number
}

export class PdfCancelled extends Error {
  constructor() {
    super('Lecture annulée')
  }
}

/**
 * Renders page `pageNumber` (1-based) at `minWidth` pixels wide or more, and reports how many pages the document has.
 * The pdf.js worker is created here (legacy build, for older Android browsers) so a start-up failure, a timeout or `signal` can end it.
 */
export async function renderPdfPage(data: ArrayBuffer, pageNumber: number, minWidth = PDF_MIN_WIDTH, signal?: AbortSignal): Promise<PdfPage> {
  const worker = new PdfJsWorker()
  const loading = getDocument({
    data: new Uint8Array(data),
    worker: new PDFWorker({ port: worker as unknown as null }),
    wasmUrl: new URL(`${import.meta.env.BASE_URL}pdfjs-wasm/`, document.baseURI).href,
  })
  const release = () => {
    void loading.destroy().catch(() => {})
    worker.terminate()
  }
  const interrupted = new Promise<never>((_, reject) => {
    worker.addEventListener('error', (event) => reject(new Error(event.message || 'le lecteur PDF n’a pas démarré')))
    worker.addEventListener('messageerror', () => reject(new Error('réponse illisible du lecteur PDF')))
    if (signal?.aborted) reject(new PdfCancelled())
    signal?.addEventListener('abort', () => reject(new PdfCancelled()))
  })
  interrupted.catch(() => {})
  try {
    return await withDeadline(Promise.race([render(loading, pageNumber, minWidth), interrupted]), PDF_RENDER_TIMEOUT_MS, release)
  } finally {
    release()
  }
}

async function render(loading: ReturnType<typeof getDocument>, pageNumber: number, minWidth: number): Promise<PdfPage> {
  const pdf = await loading.promise
  const page = await pdf.getPage(Math.min(Math.max(1, pageNumber), pdf.numPages))
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: Math.max(1, minWidth / base.width) })
  const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas 2d unavailable')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: context as unknown as CanvasRenderingContext2D, viewport }).promise
  return { image: context.getImageData(0, 0, canvas.width, canvas.height), pageCount: pdf.numPages }
}
