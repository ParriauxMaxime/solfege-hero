import { accuracy, promptId } from '../game/sampler'
import { CLEFS, PITCH_CLASS_NAMES, pitchClass, pitchesInRange, type Clef } from '../music/notes'
import { dailyKey, dailyStreak } from '../series/daily'
import { formatTenthsUp } from '../series/share'
import type { Progress } from '../storage'
import { button, el } from './dom'
import { icon } from './icons'

export interface StatsOptions {
  progress: Progress
  onReset: () => Progress
  onBack: () => void
}

const CLEF_TITLES: Record<Clef, string> = { treble: 'Clé de sol', bass: 'Clé de fa', alto: 'Clé d’ut 3' }
const MAX_HUE = 130

function hasData(progress: Progress, clef: Clef): boolean {
  return Object.keys(progress.notes).some((id) => id.startsWith(`${clef}:`))
}

export function createStatsScreen({ progress: initial, onReset, onBack }: StatsOptions): HTMLElement {
  const element = el('section', 'screen panel')

  function summary(label: string, value: number | string | Node): HTMLElement {
    return el('div', 'summary-item', el('strong', '', typeof value === 'object' ? value : String(value)), el('span', '', label))
  }

  function checked(text: string): HTMLElement {
    return el('span', 'inline-icon', icon('check'), text)
  }

  function heroSection(hero: Progress['hero']): HTMLElement {
    const judged = hero.hits + hero.misses
    const perfectRatio = judged > 0 ? `${Math.round((hero.perfects / judged) * 100)} %` : '–'
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
        summary('défis gagnés', hero.challengesWon),
        summary('défis perdus', hero.challengesLost),
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
        summary('meilleur temps', series.bestMs > 0 ? formatTenthsUp(series.bestMs) : '–'),
        summary('séries jouées', series.played),
        summary('défis gagnés', series.won),
        summary('défis perdus', series.lost),
      ),
    )
  }

  function survivalSection(survival: Progress['survival']): HTMLElement {
    return el(
      'div',
      'clef-section',
      el('h2', '', 'Survie'),
      el(
        'div',
        'summary',
        summary('meilleur score', survival.bestScore),
        summary('parties jouées', survival.played),
        summary('défis gagnés', survival.challengesWon),
        summary('défis perdus', survival.challengesLost),
      ),
    )
  }

  function dailySection(daily: Progress['daily']): HTMLElement {
    const today = dailyKey(new Date())
    const todayAttempt = daily.attempts[today]
    const streak = dailyStreak(Object.keys(daily.attempts), today)
    const played = Object.keys(daily.attempts).length
    return el(
      'div',
      'clef-section',
      el('h2', '', 'Défi du jour'),
      el(
        'div',
        'summary',
        summary(streak > 1 ? 'jours d’affilée' : 'jour d’affilée', streak),
        summary('meilleur temps', daily.bestMs > 0 ? formatTenthsUp(daily.bestMs) : '–'),
        summary(played > 1 ? 'jours joués' : 'jour joué', played),
        summary('aujourd’hui', todayAttempt ? checked(formatTenthsUp(todayAttempt.totalMs)) : 'à jouer'),
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
      row.append(el('span', '', `${Math.round(ratio * 100)} %`), el('span', '', `${(record.avgMs / 1000).toFixed(1)} s`))
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
      dailySection(progress.daily),
      seriesSection(progress.series),
      survivalSection(progress.survival),
      ...CLEFS.filter((clef) => hasData(progress, clef)).map((clef) => clefSection(progress, clef)),
      el(
        'div',
        'actions sticky-actions',
        button('danger', 'Réinitialiser', () => {
          if (confirm('Effacer toute la progression ?')) render(onReset())
        }),
        button('primary', 'Retour', onBack),
      ),
    )
  }

  render(initial)
  return element
}
