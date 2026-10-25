import { grayFromRows, planWidth, PROBE_WIDTH, probeUnit } from '../../omr/budget'
import { FILE_READ_TIMEOUT_MS, PHOTO_DECODE_TIMEOUT_MS, StageTimeout, withDeadline } from '../../omr/deadline'
import type { PdfSession } from '../../omr/pdf'
import type { GrayImage } from '../../omr/types'

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

export function readFile(file: File): Promise<ArrayBuffer> {
  return withDeadline(file.arrayBuffer(), FILE_READ_TIMEOUT_MS)
}

/** `navigator.deviceMemory` (gigabytes, rounded down to a power of two) where the browser tells. */
export function deviceMemory(): number | undefined {
  return (navigator as Navigator & { deviceMemory?: number }).deviceMemory
}

export interface SourcePage {
  gray: GrayImage
  pageCount: number
  /** Rendered smaller than the staves need, for the device's memory. */
  reduced: boolean
}

/** pdf.js is loaded on first use so the main bundle stays small. */
export async function openPdf(data: ArrayBuffer): Promise<PdfSession> {
  const { PdfSession } = await import('../../omr/pdf')
  return new PdfSession(data)
}

export function renderPreview(pdf: PdfSession, page: number, signal?: AbortSignal): Promise<{ bitmap: ImageBitmap; pageCount: number }> {
  return pdf.preview(page, signal)
}

export function renderPage(pdf: PdfSession, page: number, signal?: AbortSignal): Promise<SourcePage> {
  return pdf.gray(page, { signal, deviceMemory: deviceMemory() })
}

function grayOfBitmap(bitmap: ImageBitmap): GrayImage {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('canvas 2d unavailable')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0)
  const gray = grayFromRows({ width: canvas.width, height: canvas.height, rows: (y, count) => context.getImageData(0, y, canvas.width, count).data })
  bitmap.close()
  canvas.width = 0
  canvas.height = 0
  return gray
}

function naturalWidth(file: File): Promise<number | undefined> {
  const url = URL.createObjectURL(file)
  const image = new Image()
  return new Promise((resolve) => {
    image.onload = () => resolve(image.naturalWidth || undefined)
    image.onerror = () => resolve(undefined)
    image.src = url
  }).finally(() => URL.revokeObjectURL(url)) as Promise<number | undefined>
}

async function decodeAt(file: File, width: number): Promise<GrayImage> {
  return grayOfBitmap(await createImageBitmap(file, { resizeWidth: width, resizeQuality: 'high' }))
}

/** Decodes a photo straight at the width its staves need (probe at PROBE_WIDTH first), so the full-size bitmap never exists. */
export function decodePhoto(file: File): Promise<SourcePage> {
  return withDeadline(
    (async () => {
      const source = await naturalWidth(file)
      const probeWidth = Math.min(PROBE_WIDTH, source ?? PROBE_WIDTH)
      const probe = await decodeAt(file, probeWidth)
      const plan = planWidth(probeWidth, probeUnit(probe), probe.height / probe.width, deviceMemory(), source)
      return { gray: await decodeAt(file, plan.width), pageCount: 1, reduced: plan.reduced }
    })(),
    PHOTO_DECODE_TIMEOUT_MS,
  )
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
