import { accuracy, promptId } from '../game/sampler'
import { CLEFS, PITCH_CLASS_NAMES, pitchClass, pitchesInRange, type Clef } from '../music/notes'
import { formatTime } from '../series/share'
import type { Progress } from '../storage'
import { button, el } from './dom'

export interface StatsOptions {
  progress: Progress
  onReset: () => Progress
  onBack: () => void
}

const CLEF_TITLES: Record<Clef, string> = { treble: 'Clé de sol', bass: 'Clé de fa', alto: "Clé d'ut 3" }
const MAX_HUE = 130

function hasData(progress: Progress, clef: Clef): boolean {
  return Object.keys(progress.notes).some((id) => id.startsWith(`${clef}:`))
}

export function createStatsScreen({ progress: initial, onReset, onBack }: StatsOptions): HTMLElement {
  const element = el('section', 'screen panel')

  function summary(label: string, value: number | string): HTMLElement {
    return el('div', 'summary-item', el('strong', '', String(value)), el('span', '', label))
  }

  function heroSection(hero: Progress['hero']): HTMLElement {
    const perfectRatio = hero.hits > 0 ? `${Math.round((hero.perfects / hero.hits) * 100)} %` : '–'
    return el(
      'div',
      'clef-section',
      el('h2', '', 'Solfège hero'),
      el(
        'div',
        'summary hero-summary',
        summary('meilleur score', hero.bestScore),
        summary('meilleure série', hero.bestStreak),
        summary('BPM max', hero.maxBpm),
        summary('réussies', hero.hits),
        summary('ratées', hero.misses),
        summary('parfaits', perfectRatio),
      ),
    )
  }

  function seriesSection(series: Progress['series']): HTMLElement {
    return el(
      'div',
      'clef-section',
      el('h2', '', 'Séries'),
      el(
        'div',
        'summary',
        summary('meilleur temps', series.bestMs > 0 ? formatTime(series.bestMs) : '–'),
        summary('séries jouées', series.played),
        summary('défis gagnés', series.won),
        summary('défis perdus', series.lost),
      ),
    )
  }

  function pitchRow(progress: Progress, clef: Clef, pitch: number): HTMLElement {
    const record = progress.notes[promptId({ clef, pitch })]
    const ratio = accuracy(record)
    const label = `${PITCH_CLASS_NAMES[pitchClass(pitch)]} ${Math.floor(pitch / 12) - 1}`
    const row = el('div', 'note-row', el('span', 'note-name', label))
    if (ratio === null || !record) {
      row.classList.add('unseen')
      row.append(el('span', '', '–'), el('span', '', ''))
    } else {
      row.style.setProperty('--tint', `hsl(${Math.round(ratio * MAX_HUE)} 60% 28%)`)
      row.append(el('span', '', `${Math.round(ratio * 100)} %`), el('span', '', `${(record.avgMs / 1000).toFixed(1)} s`))
    }
    return row
  }

  function clefSection(progress: Progress, clef: Clef): HTMLElement {
    const rows = pitchesInRange(clef, true)
      .map((pitch) => pitchRow(progress, clef, pitch))
      .reverse()
    return el('div', 'clef-section', el('h2', '', CLEF_TITLES[clef]), ...rows)
  }

  function render(progress: Progress): void {
    element.replaceChildren(
      el('h1', '', 'Statistiques'),
      el(
        'div',
        'summary',
        summary('meilleure série', progress.bestStreak),
        summary('réponses', progress.totalAnswered),
        summary('meilleur 60 s', progress.bestTimed),
      ),
      heroSection(progress.hero),
      seriesSection(progress.series),
      ...CLEFS.filter((clef) => hasData(progress, clef)).map((clef) => clefSection(progress, clef)),
      el(
        'div',
        'actions',
        button('danger', 'Réinitialiser', () => {
          if (confirm('Effacer toute la progression ?')) render(onReset())
        }),
        button('primary', 'Retour', onBack),
      ),
    )
  }

  render(initial)
  return element
}
