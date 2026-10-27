import type { Score } from '../hero/types'
import { t, type MessageKey } from '../i18n'
import type { Clef } from '../music/notes'
import { importScoreFile } from '../music/musicxml'
import { scoreTitle } from '../scores/title'
import { appBase } from '../share/links'
import { catalogueUrl, fetchCatalogueIndex, withoutCatalogued, type CatalogueEntry } from '../storage/catalogue'
import type { Sound } from '../audio/sound'
import type { createScoreLibrary, NewScore } from '../storage/scores'
import { confirmOverlay } from './confirm'
import { button, el, iconButton } from './dom'
import { icon, type IconName } from './icons'
import { shareScore } from './sharing'
import { showToast } from './toast'

type ScoreLibrary = ReturnType<typeof createScoreLibrary>

export interface LibraryOptions {
  library: ScoreLibrary
  sound: Sound
  onPlayHero: (score: Score) => void
  onPlaySeries: (score: Score) => void
}

const CLEF_KEYS = { treble: 'library.clef.treble', bass: 'library.clef.bass', alto: 'library.clef.alto' } satisfies Record<Clef, MessageKey>

function keyLabel(fifths: number): string {
  if (fifths === 0) return '—'
  return fifths > 0 ? `${fifths}♯` : `${-fifths}♭`
}

function noteCount(score: Score): number {
  return score.notes.filter((note) => note.pitch !== null).length
}

function hiddenFileInput(accept: string, onFile: (file: File) => void, capture?: string): HTMLInputElement {
  const input = el('input')
  input.type = 'file'
  input.accept = accept
  if (capture) input.setAttribute('capture', capture)
  input.hidden = true
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    input.value = ''
    if (file) onFile(file)
  })
  return input
}

function iconLabelButton(className: string, name: IconName, label: string, onClick: () => void): HTMLButtonElement {
  const element = button(`${className} inline-icon`, label, onClick)
  element.prepend(icon(name))
  return element
}

export function createLibrary({ library, sound, onPlayHero, onPlaySeries }: LibraryOptions): HTMLElement {
  const input = hiddenFileInput('.musicxml,.xml,.mxl', (file) => void importFile(file))
  const imageInput = hiddenFileInput('.pdf,application/pdf,image/*', (file) => void readImage(file))
  const cameraInput = hiddenFileInput('image/*', (file) => void readImage(file), 'environment')

  const importButton = button('primary library-import', t('library.import'), () => input.click())
  const header = el('div', 'library-header', el('h1', '', t('library.title')), importButton, input)
  const imageButtons = el(
    'div',
    'library-image-imports',
    iconLabelButton('segment-button', 'document', t('library.importImage'), () => imageInput.click()),
    iconLabelButton('segment-button', 'camera', t('library.takePhoto'), () => cameraInput.click()),
    imageInput,
    cameraInput,
  )
  const notice = el('div', 'library-notice')
  notice.hidden = true
  const list = el('div', 'library-list')
  const element = el('section', 'screen library', header, imageButtons, notice, list)
  let sharing = false
  let catalogue: CatalogueEntry[] = []
  const catalogueScores = new Map<string, Score>()

  function showWarnings(warnings: string[]): void {
    notice.hidden = warnings.length === 0
    if (warnings.length === 0) return
    notice.replaceChildren(
      el('ul', '', ...warnings.map((warning) => el('li', '', warning))),
      iconButton('close', () => {
        notice.hidden = true
      }, t('library.close')),
    )
  }

  async function importFile(file: File): Promise<void> {
    try {
      const { score, warnings } = await importScoreFile(file.name, await file.arrayBuffer())
      if ((await library.list()).some((existing) => existing.id === score.id)) {
        showToast(t('library.alreadyIn'))
        return
      }
      await library.add(score, 'file')
      showToast(t('library.added', { name: score.name }))
      showWarnings(warnings)
      await renderList()
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('library.importFailed'))
    }
  }

  async function readImage(file: File): Promise<void> {
    const { openOmrImport } = await import('./omr/importFlow')
    openOmrImport({ file, sound, onSave: saveRecognised })
  }

  async function saveRecognised(score: NewScore): Promise<void> {
    const known = (await library.list()).some((existing) => existing.id === score.id)
    const stored = await library.add(score, 'omr')
    showToast(known ? t('library.alreadyIn') : t('library.added', { name: stored.name }))
    await renderList()
  }

  async function share(score: Score): Promise<void> {
    if (sharing) return
    sharing = true
    try {
      await shareScore(score)
    } finally {
      sharing = false
    }
  }

  async function remove(score: Score): Promise<void> {
    if (!(await confirmOverlay(element, t('library.confirmDelete', { name: scoreTitle(score.name) }), t('library.delete'), t('library.cancel')))) return
    await library.remove(score.id)
    await renderList()
  }

  function scoreCard(score: Score, composer?: string): HTMLElement {
    const builtin = score.source === 'builtin'
    const title = scoreTitle(score.name)
    const meta = [
      ...(composer ? [composer] : []),
      t(CLEF_KEYS[score.clef]),
      keyLabel(score.key),
      `${score.timeSignature.beats}/${score.timeSignature.beatType}`,
      t('library.notes', { count: noteCount(score) }),
    ]
    const actions = el(
      'div',
      'score-actions',
      button('primary', t('library.hero'), () => onPlayHero(score)),
      button('primary', t('library.series'), () => onPlaySeries(score)),
    )
    actions.append(iconButton('link', () => void share(score), t('library.shareScore', { name: title })))
    if (!builtin) actions.append(iconButton('trash', () => void remove(score), t('library.deleteScore', { name: title })))
    return el(
      'article',
      'score-card',
      el('div', 'score-main', el('h3', 'score-title', title), builtin ? el('span', 'badge', t('library.builtin')) : score.source === 'omr' ? el('span', 'badge', t('library.scan')) : ''),
      el('div', 'score-meta', ...meta.map((item) => el('span', 'chip', item))),
      actions,
    )
  }

  async function loadCatalogueScore(entry: CatalogueEntry): Promise<Score | null> {
    const cached = catalogueScores.get(entry.file)
    if (cached) return cached
    try {
      const response = await fetch(catalogueUrl(appBase(location.href), entry.file))
      if (!response.ok) throw new Error(String(response.status))
      const { score } = await importScoreFile(entry.file, await response.arrayBuffer())
      const registered = library.registerBuiltin(score)
      catalogueScores.set(entry.file, registered)
      return registered
    } catch {
      showToast(t('library.unavailable'))
      return null
    }
  }

  function catalogueCard(entry: CatalogueEntry): HTMLElement {
    const play = (start: (score: Score) => void) => async () => {
      const score = await loadCatalogueScore(entry)
      if (score) start(score)
    }
    return el(
      'article',
      'score-card',
      el('div', 'score-main', el('h3', 'score-title', entry.title), el('span', 'badge', t('library.builtin'))),
      el('div', 'score-meta', ...(entry.composer ? [el('span', 'chip', entry.composer)] : [])),
      el(
        'div',
        'score-actions',
        button('primary', t('library.hero'), () => void play(onPlayHero)()),
        button('primary', t('library.series'), () => void play(onPlaySeries)()),
      ),
    )
  }

  async function renderList(): Promise<void> {
    const scores = await library.list()
    const imported = scores.filter((score) => score.source !== 'builtin')
    const builtin = withoutCatalogued(
      scores.filter((score) => score.source === 'builtin'),
      catalogue,
    )
    list.replaceChildren(
      ...(imported.length > 0 ? imported.map((score) => scoreCard(score)) : [el('p', 'library-empty', t('library.empty'))]),
      ...builtin.map((score) => scoreCard(score)),
      ...catalogue.map((entry) => {
        const score = catalogueScores.get(entry.file)
        return score ? scoreCard(score, entry.composer) : catalogueCard(entry)
      }),
    )
  }

  void renderList()
  void fetchCatalogueIndex(appBase(location.href)).then((entries) => {
    catalogue = entries
    if (entries.length === 0) return
    void renderList()
    void Promise.all(entries.map(loadCatalogueScore)).then(renderList)
  })
  return element
}
