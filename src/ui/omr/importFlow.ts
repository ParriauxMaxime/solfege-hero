import type { Sound } from '../../audio/sound'
import { t } from '../../i18n'
import type { GrayImage, OmrResult } from '../../omr/types'
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
import type { PdfSession } from '../../omr/pdf'
import { decodePhoto, isPdf, openPdf, readableError, readFile, renderPage, renderPreview } from './source'

/** Closes the import even when the browser never delivers the popstate that history.back() should trigger. */
const POP_FALLBACK_MS = 250

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
  modal.setAttribute('aria-label', t('omr.dialogLabel'))
  let source: GrayImage | null = null
  let sourcePage = 0
  let pdf: PdfSession | null = null
  let pageCount = 1
  let page = 1
  let staffIndex = 0
  let job: Recognition | null = null
  let review: Review | null = null
  let run = 0
  let closed = false
  let abort = new AbortController()

  function show(content: HTMLElement): void {
    review?.destroy()
    review = null
    modal.replaceChildren(content)
  }

  function leave(): void {
    if (closed) return
    closed = true
    run++
    abort.abort()
    job?.cancel()
    review?.destroy()
    source = null
    pdf?.close()
    modal.remove()
    window.removeEventListener('popstate', onPopState)
    setOmrImportOpen(false)
  }

  function closeNow(): void {
    if (history.state?.screen !== 'omr') return leave()
    history.back()
    setTimeout(leave, POP_FALLBACK_MS)
  }

  async function requestClose(): Promise<void> {
    if (!review?.hasEdits() || (await confirmOverlay(modal, t('omr.abandon.message'), t('omr.abandon.confirm'), t('omr.abandon.keep')))) closeNow()
  }

  function onPopState(): void {
    if (!review?.hasEdits()) {
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

  function restartAbort(): AbortSignal {
    abort.abort()
    abort = new AbortController()
    return abort.signal
  }

  function backFromRun(): void {
    run++
    restartAbort()
    job?.cancel()
    if (pdf) void showSetup()
    else closeNow()
  }

  async function showSetup(): Promise<void> {
    const mine = ++run
    const signal = restartAbort()
    const loading = createProgress({ onCancel: () => void requestClose(), onBack: closeNow })
    show(loading.element)
    try {
      const first = await renderPreview(pdf as PdfSession, page, signal)
      if (mine !== run) return
      pageCount = first.pageCount
      show(
        createPdfSetup({
          pageCount,
          initialPreview: first.bitmap,
          staffIndex,
          preview: async (target) => (await renderPreview(pdf as PdfSession, target, abort.signal)).bitmap,
          onStart: (chosenPage, chosenStaff) => {
            page = chosenPage
            staffIndex = chosenStaff
            void recognise()
          },
          onClose: () => void requestClose(),
        }),
      )
    } catch (error) {
      if (mine === run) loading.fail(readableError(error, 'pdf'))
    }
  }

  async function recognise(): Promise<void> {
    const mine = ++run
    const signal = restartAbort()
    const progress: ProgressScreen = createProgress({ onCancel: backFromRun, onBack: backFromRun })
    show(progress.element)
    try {
      if (pdf && sourcePage !== page) {
        source = null
        sourcePage = 0
        const rendered = await renderPage(pdf, page, signal)
        if (mine !== run) return
        source = rendered.gray
        sourcePage = page
        if (rendered.reduced) showToast(t('omr.reduced'))
      }
      if (!source) throw new Error(t('omr.missingImage'))
      progress.update('preprocess', 0)
      job = startRecognition(source, staffIndex, progress.update)
      const result = await job.result
      if (mine !== run) return
      if (result.staves.length === 0 || !result.score.notes.some((note) => note.pitch !== null)) {
        progress.fail(result.warnings[0] ?? t('omr.nothingRead'))
        return
      }
      showReview(result)
    } catch (error) {
      if (mine !== run || error instanceof RecognitionCancelled) return
      progress.fail(readableError(error, pdf ? 'pdf' : 'photo'))
    }
  }

  function showReview(result: OmrResult): void {
    review = null
    const created = createReview({
      source: source as GrayImage,
      result,
      sound,
      onClose: () => void requestClose(),
      onRerun: (chosenStaff) => {
        staffIndex = chosenStaff
        void recognise()
      },
      onSave: (score) => {
        void onSave(score).then(closeNow, (error) => showToast(error instanceof Error ? error.message : t('omr.saveFailed')))
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
        pdf = await openPdf(await readFile(file))
        if (closed) return pdf.close()
        await showSetup()
        return
      }
      const photo = await decodePhoto(file)
      source = photo.gray
      if (photo.reduced) showToast(t('omr.reduced'))
      await recognise()
    } catch (error) {
      if (!closed) failScreen(readableError(error, isPdf(file) ? 'pdf' : 'photo'))
    }
  }

  history.pushState({ screen: 'omr' }, '')
  window.addEventListener('popstate', onPopState)
  document.body.append(modal)
  void begin()
}
