import { FILE_READ_TIMEOUT_MS, StageTimeout, withDeadline } from '../../omr/deadline'

const PDF_PREVIEW_WIDTH = 900

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

export function decodePhoto(file: File): Promise<ImageBitmap> {
  return withDeadline(createImageBitmap(file), FILE_READ_TIMEOUT_MS)
}

export function readFile(file: File): Promise<ArrayBuffer> {
  return withDeadline(file.arrayBuffer(), FILE_READ_TIMEOUT_MS)
}

export interface RenderedPage {
  bitmap: ImageBitmap
  pageCount: number
}

/** pdf.js is loaded on first use so the main bundle stays small; it takes ownership of the bytes, so it gets a copy. */
export async function renderPage(data: ArrayBuffer, page: number, full: boolean, signal?: AbortSignal): Promise<RenderedPage> {
  const { renderPdfPage, PDF_MIN_WIDTH } = await import('../../omr/pdf')
  const { image, pageCount } = await renderPdfPage(data.slice(0), page, full ? PDF_MIN_WIDTH : PDF_PREVIEW_WIDTH, signal)
  return { bitmap: await createImageBitmap(image), pageCount }
}

function reason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (error instanceof StageTimeout) return message
  if (/password/i.test(message)) return 'ce PDF est protégé par un mot de passe'
  if (/invalid pdf|missing pdf|unexpected server response/i.test(message)) return 'le fichier est illisible'
  return message || 'erreur inconnue'
}

/** The French line shown on the progress screen when reading a file fails. */
export function readableError(error: unknown, kind: 'pdf' | 'photo' = 'pdf'): string {
  return `Impossible de lire ${kind === 'pdf' ? 'le PDF' : 'l’image'} : ${reason(error)}`
}
