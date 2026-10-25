import { button, el, iconButton } from '../dom'
import { createStaffPicker } from './staffPicker'

export interface PdfSetupOptions {
  pageCount: number
  /** Renders a small version of page `page` (1-based). */
  preview: (page: number) => Promise<ImageBitmap>
  initialPreview: ImageBitmap
  staffIndex: number
  onStart: (page: number, staffIndex: number) => void
  onClose: () => void
}

export function createPdfSetup({ pageCount, preview, initialPreview, staffIndex, onStart, onClose }: PdfSetupOptions): HTMLElement {
  let page = 1
  const canvas = el('canvas', 'omr-page-preview')
  const label = el('span', 'omr-page-label')
  const previous = iconButton('chevron-left', () => go(page - 1), 'Page précédente')
  const next = iconButton('chevron-right', () => go(page + 1), 'Page suivante')
  const staff = createStaffPicker(staffIndex, () => true)

  function draw(bitmap: ImageBitmap): void {
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
  }

  function refresh(): void {
    label.textContent = `Page ${page} / ${pageCount}`
    previous.disabled = page <= 1
    next.disabled = page >= pageCount
  }

  function go(target: number): void {
    const wanted = Math.min(Math.max(1, target), pageCount)
    page = wanted
    refresh()
    canvas.classList.add('loading')
    void preview(wanted).then((bitmap) => {
      if (wanted !== page) return
      draw(bitmap)
      canvas.classList.remove('loading')
    })
  }

  draw(initialPreview)
  refresh()
  const pager = el('div', 'omr-pager', previous, label, next)
  pager.hidden = pageCount <= 1
  return el(
    'section',
    'omr-setup',
    el('header', 'omr-header', el('h2', '', 'Choisir la page'), iconButton('close', onClose, 'Fermer')),
    el('div', 'omr-page-frame', canvas),
    pager,
    staff.element,
    el('p', 'omr-hint', 'Pour un piano ou un chant, la mélodie est le plus souvent sur la portée du haut (1).'),
    button('primary big', 'Lire la partition', () => onStart(page, staff.value())),
  )
}
