const PDF_PREVIEW_WIDTH = 900

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

export function decodePhoto(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file)
}

export interface RenderedPage {
  bitmap: ImageBitmap
  pageCount: number
}

/** pdf.js is loaded on first use so the main bundle stays small; it takes ownership of the bytes, so it gets a copy. */
export async function renderPage(data: ArrayBuffer, page: number, full: boolean): Promise<RenderedPage> {
  const { renderPdfPage, PDF_MIN_WIDTH } = await import('../../omr/pdf')
  const { image, pageCount } = await renderPdfPage(data.slice(0), page, full ? PDF_MIN_WIDTH : PDF_PREVIEW_WIDTH)
  return { bitmap: await createImageBitmap(image), pageCount }
}

export function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/password/i.test(message)) return 'Ce PDF est protégé par un mot de passe.'
  if (/invalid pdf|missing pdf|unexpected server response/i.test(message)) return 'Ce fichier PDF est illisible.'
  return 'La lecture a échoué. Essaie une autre image ou une autre page.'
}
