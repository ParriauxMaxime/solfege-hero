import type { Score } from '../hero/types'
import type { Clef } from '../music/notes'
import { importScoreFile } from '../music/musicxml'
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

const CLEF_LABELS: Record<Clef, string> = { treble: 'Sol', bass: 'Fa', alto: 'Ut 3' }
const EMPTY_MESSAGE = 'Aucune partition importée. Trouve des fichiers MusicXML sur MuseScore, IMSLP… ou lis un PDF ou une photo.'

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

  const importButton = button('primary library-import', 'Importer', () => input.click())
  const header = el('div', 'library-header', el('h1', '', 'Partitions'), importButton, input)
  const imageButtons = el(
    'div',
    'library-image-imports',
    iconLabelButton('segment-button', 'document', 'Importer un PDF ou une photo', () => imageInput.click()),
    iconLabelButton('segment-button', 'camera', 'Prendre une photo', () => cameraInput.click()),
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
      }, 'Fermer'),
    )
  }

  async function importFile(file: File): Promise<void> {
    try {
      const { score, warnings } = await importScoreFile(file.name, await file.arrayBuffer())
      if ((await library.list()).some((existing) => existing.id === score.id)) {
        showToast('Déjà dans ta bibliothèque')
        return
      }
      await library.add(score, 'file')
      showToast(`Partition ajoutée : ${score.name}`)
      showWarnings(warnings)
      await renderList()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Import impossible')
    }
  }

  async function readImage(file: File): Promise<void> {
    const { openOmrImport } = await import('./omr/importFlow')
    openOmrImport({ file, sound, onSave: saveRecognised })
  }

  async function saveRecognised(score: NewScore): Promise<void> {
    const known = (await library.list()).some((existing) => existing.id === score.id)
    const stored = await library.add(score, 'omr')
    showToast(known ? 'Déjà dans ta bibliothèque' : `Partition ajoutée : ${stored.name}`)
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
    if (!(await confirmOverlay(element, `Supprimer « ${score.name} » ?`, 'Supprimer', 'Annuler'))) return
    await library.remove(score.id)
    await renderList()
  }

  function scoreCard(score: Score, composer?: string): HTMLElement {
    const builtin = score.source === 'builtin'
    const meta = [...(composer ? [composer] : []), CLEF_LABELS[score.clef], keyLabel(score.key), `${score.timeSignature.beats}/${score.timeSignature.beatType}`, `${noteCount(score)} notes`]
    const actions = el(
      'div',
      'score-actions',
      button('primary', 'Hero', () => onPlayHero(score)),
      button('primary', 'Série', () => onPlaySeries(score)),
    )
    actions.append(iconButton('link', () => void share(score), `Partager ${score.name}`))
    if (!builtin) actions.append(iconButton('trash', () => void remove(score), `Supprimer ${score.name}`))
    return el(
      'article',
      'score-card',
      el('div', 'score-main', el('h3', 'score-title', score.name), builtin ? el('span', 'badge', 'intégrée') : score.source === 'omr' ? el('span', 'badge', 'scan') : ''),
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
      showToast('Partition indisponible pour le moment')
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
      el('div', 'score-main', el('h3', 'score-title', entry.title), el('span', 'badge', 'intégrée')),
      el('div', 'score-meta', ...(entry.composer ? [el('span', 'chip', entry.composer)] : [])),
      el(
        'div',
        'score-actions',
        button('primary', 'Hero', () => void play(onPlayHero)()),
        button('primary', 'Série', () => void play(onPlaySeries)()),
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
      ...(imported.length > 0 ? imported.map((score) => scoreCard(score)) : [el('p', 'library-empty', EMPTY_MESSAGE)]),
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
