import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

/** About 300 dpi on an A4 page. */
export const PDF_MIN_WIDTH = 2480

export interface PdfPage {
  image: ImageData
  pageCount: number
}

/** Renders page `pageNumber` (1-based) at `minWidth` pixels wide or more, and reports how many pages the document has. */
export async function renderPdfPage(data: ArrayBuffer, pageNumber: number, minWidth = PDF_MIN_WIDTH): Promise<PdfPage> {
  const loading = getDocument({ data: new Uint8Array(data), wasmUrl: new URL(`${import.meta.env.BASE_URL}pdfjs-wasm/`, document.baseURI).href })
  try {
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
  } finally {
    await loading.destroy()
  }
}
