import type { Sound } from '../../audio/sound'
import type { OmrResult } from '../../omr/types'
import type { NewScore } from '../../storage/scores'
import { confirmOverlay } from '../confirm'
import { el } from '../dom'
import { showToast } from '../toast'
import { isOmrImportOpen, setOmrImportOpen } from './openState'
import { createPdfSetup } from './pdfSetup'
import { createProgress } from './progress'
import type { ProgressScreen } from './progress'
import { startRecognition, RecognitionCancelled } from './recognition'
import type { Recognition } from './recognition'
import { createReview } from './review'
import type { Review } from './review'
import { decodePhoto, isPdf, readableError, renderPage } from './source'

export interface OmrImportOptions {
  file: File
  sound: Sound
  /** Stores the reviewed score; rejects when it cannot be stored. */
  onSave: (score: NewScore) => Promise<void>
}

export function openOmrImport({ file, sound, onSave }: OmrImportOptions): void {
  if (isOmrImportOpen()) return
  setOmrImportOpen(true)
  const modal = el('div', 'omr-modal')
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  modal.setAttribute('aria-label', 'Importer une partition')
  let source: ImageBitmap | null = null
  let sourcePage = 0
  let pdfData: ArrayBuffer | null = null
  let pageCount = 1
  let page = 1
  let staffIndex = 0
  let job: Recognition | null = null
  let review: Review | null = null
  let run = 0
  let confirmedClose = false

  function show(content: HTMLElement): void {
    review?.destroy()
    review = null
    modal.replaceChildren(content)
  }

  function leave(): void {
    run++
    job?.cancel()
    review?.destroy()
    source?.close()
    modal.remove()
    window.removeEventListener('popstate', onPopState)
    setOmrImportOpen(false)
  }

  function closeNow(): void {
    confirmedClose = true
    history.back()
  }

  async function requestClose(): Promise<void> {
    if (!review?.hasEdits() || (await confirmOverlay(modal, 'Abandonner cette lecture ? Tes corrections seront perdues.', 'Abandonner', 'Continuer'))) closeNow()
  }

  function onPopState(): void {
    if (confirmedClose || !review?.hasEdits()) {
      leave()
      return
    }
    history.pushState({ screen: 'omr' }, '')
    void requestClose()
  }

  function failScreen(message: string): void {
    const progress = createProgress({ onCancel: () => void requestClose(), onBack: backFromRun })
    show(progress.element)
    progress.fail(message)
  }

  function backFromRun(): void {
    run++
    job?.cancel()
    if (pdfData) void showSetup()
    else closeNow()
  }

  async function showSetup(): Promise<void> {
    const mine = ++run
    const loading = createProgress({ onCancel: () => void requestClose(), onBack: closeNow })
    show(loading.element)
    try {
      const first = await renderPage(pdfData as ArrayBuffer, page, false)
      if (mine !== run) return
      pageCount = first.pageCount
      show(
        createPdfSetup({
          pageCount,
          initialPreview: first.bitmap,
          staffIndex,
          preview: async (target) => (await renderPage(pdfData as ArrayBuffer, target, false)).bitmap,
          onStart: (chosenPage, chosenStaff) => {
            page = chosenPage
            staffIndex = chosenStaff
            void recognise()
          },
          onClose: () => void requestClose(),
        }),
      )
    } catch (error) {
      if (mine === run) loading.fail(readableError(error))
    }
  }

  async function recognise(): Promise<void> {
    const mine = ++run
    const progress: ProgressScreen = createProgress({ onCancel: backFromRun, onBack: backFromRun })
    show(progress.element)
    try {
      if (pdfData && sourcePage !== page) {
        const rendered = await renderPage(pdfData, page, true)
        if (mine !== run) return rendered.bitmap.close()
        source?.close()
        source = rendered.bitmap
        sourcePage = page
      }
      if (!source) throw new Error('image manquante')
      progress.update('preprocess', 0)
      job = startRecognition(source, staffIndex, progress.update)
      const result = await job.result
      if (mine !== run) return
      showReview(result)
    } catch (error) {
      if (mine !== run || error instanceof RecognitionCancelled) return
      progress.fail(readableError(error))
    }
  }

  function showReview(result: OmrResult): void {
    review = null
    const created = createReview({
      source: source as ImageBitmap,
      result,
      sound,
      onClose: () => void requestClose(),
      onRerun: (chosenStaff) => {
        staffIndex = chosenStaff
        void recognise()
      },
      onSave: (score) => {
        void onSave(score).then(closeNow, (error) => showToast(error instanceof Error ? error.message : 'Enregistrement impossible'))
      },
    })
    show(created.element)
    review = created
  }

  async function begin(): Promise<void> {
    const loading = createProgress({ onCancel: () => void requestClose(), onBack: closeNow })
    show(loading.element)
    try {
      if (isPdf(file)) {
        pdfData = await file.arrayBuffer()
        await showSetup()
        return
      }
      source = await decodePhoto(file)
      await recognise()
    } catch (error) {
      failScreen(readableError(error))
    }
  }

  history.pushState({ screen: 'omr' }, '')
  window.addEventListener('popstate', onPopState)
  document.body.append(modal)
  void begin()
}
