import { accuracy, promptId } from '../game/sampler'
import { ALL_SIGNATURES, keyStatsId } from '../game/keysSampler'
import { mostMissedPitches, successRate } from '../game/strictOctave'
import { keyFullName, signatureLabel } from '../music/keySignature'
import { CLEFS, PITCH_CLASS_NAMES, pitchClass, pitchesInRange, type Clef } from '../music/notes'
import { dailyKey, dailyStreak } from '../series/daily'
import { formatTenthsUp } from '../series/share'
import { overview } from '../stats/aggregate'
import { dayKeyOf, weekKeyOf } from '../stats/dates'
import { formatAxisSeconds, formatPercent, formatSeconds } from '../stats/format'
import { LOWER_BEST_IS_BETTER, type DayKey, type HistoryMode } from '../stats/history'
import { metricsFor, progressionPoints, windowSummary, type Metric } from '../stats/progression'
import { isWeak, trendDescription, weakestFirst } from '../stats/rank'
import { dataTicks, PERCENT_TICKS } from '../stats/scale'
import { EMPTY_MESSAGE, metricLabel, summarySentence } from '../stats/summary'
import { noteTrend, type Trend } from '../stats/trend'
import type { Progress } from '../storage'
import { createHeatmap } from './charts/heatmap'
import { createLineChart } from './charts/lineChart'
import { button, el } from './dom'
import { icon } from './icons'
import { plural } from './plural'

export interface StatsOptions {
  progress: Progress
  onReset: () => Progress
  onBack: () => void
  today?: DayKey
}

type ProgressionMode = Extract<HistoryMode, 'learn' | 'keys' | 'series' | 'dictation' | 'survival' | 'hero'>
type NotesFilter = 'all' | 'weak'

const CLEF_TITLES: Record<Clef, string> = { treble: 'Clé de sol', bass: 'Clé de fa', alto: 'Clé d’ut 3' }
const MODE_LABELS: Record<ProgressionMode, string> = { learn: 'Apprendre', keys: 'Armures', series: 'Séries', dictation: 'Dictée', survival: 'Survie', hero: 'Hero' }
const MODE_ORDER: ProgressionMode[] = ['learn', 'keys', 'series', 'dictation', 'survival', 'hero']
const RANGES = [7, 30, 90]
const DEFAULT_RANGE = 30
const FILTER_LABELS: Record<NotesFilter, string> = { all: 'Toutes', weak: 'Faibles' }
const MAX_HUE = 130
const MOST_MISSED_SHOWN = 8
const MS_PER_SECOND = 1000

interface RankedRow {
  name: string
  ratio: number | null
  detail: string
  trend: Trend | null
}

function hasData(progress: Progress, clef: Clef): boolean {
  return Object.keys(progress.notes).some((id) => id.startsWith(`${clef}:`))
}

function isTimeMetric(mode: HistoryMode, metric: Metric): boolean {
  return metric === 'meanMs' || (metric === 'best' && LOWER_BEST_IS_BETTER[mode])
}

function chartTitle(mode: ProgressionMode, metric: Metric): string {
  return metric === 'meanMs' ? 'Temps moyen de réponse' : metricLabel(mode, metric)
}

function segmented<T extends string | number>(
  choices: { value: T; label: string }[],
  current: T,
  onPick: (value: T) => void,
  label: string,
): HTMLElement {
  const options = choices.map((choice) => {
    const option = button('segment', choice.label, () => onPick(choice.value))
    option.classList.toggle('active', choice.value === current)
    option.setAttribute('aria-pressed', String(choice.value === current))
    return option
  })
  const group = el('div', 'segmented', ...options)
  group.setAttribute('role', 'group')
  group.setAttribute('aria-label', label)
  return group
}

function trendArrow(trend: Trend | null): HTMLElement {
  if (!trend) return el('span', 'trend')
  const name = trend.direction === 'up' ? 'arrow-up' : trend.direction === 'down' ? 'arrow-down' : 'arrow-right'
  return el('span', `trend trend-${trend.direction}`, icon(name), el('span', 'visually-hidden', trendDescription(trend)))
}

function tintedRow(row: RankedRow): HTMLElement {
  const element = el('div', 'note-row', el('span', 'note-name', row.name))
  if (row.ratio === null) {
    element.classList.add('unseen')
    element.append(el('span', '', '–'), el('span', '', ''))
  } else {
    element.style.setProperty('--tint', `hsl(${Math.round(row.ratio * MAX_HUE)} 60% 28%)`)
    element.append(el('span', '', `${Math.round(row.ratio * 100)} %`), el('span', '', row.detail))
  }
  element.append(trendArrow(row.trend))
  return element
}

export function createStatsScreen({ progress: initial, onReset, onBack, today: forcedToday }: StatsOptions): HTMLElement {
  const element = el('section', 'screen panel stats')
  const today = forcedToday ?? dayKeyOf(new Date())
  const thisWeek = weekKeyOf(today)
  let progress = initial
  let mode: ProgressionMode = 'learn'
  let range = DEFAULT_RANGE
  let filter: NotesFilter = 'all'
  const progressionSection = el('section', 'stats-section')
  const notesSection = el('section', 'stats-section')

  function summary(label: string, value: number | string | Node): HTMLElement {
    return el('div', 'summary-item', el('strong', '', typeof value === 'object' ? value : String(value)), el('span', '', label))
  }

  function checked(text: string): HTMLElement {
    return el('span', 'inline-icon', icon('check'), text)
  }

  function headerTiles(): HTMLElement {
    const totals = overview(progress.history, today)
    const answered = Math.max(progress.totalAnswered, totals.answered)
    return el(
      'div',
      'summary summary-4',
      summary(plural(answered, 'réponse', 'réponses'), answered.toLocaleString('fr-FR')),
      summary(plural(totals.daysPlayed, 'jour joué', 'jours joués'), totals.daysPlayed),
      summary(plural(totals.currentStreak, 'jour d’affilée', 'jours d’affilée'), totals.currentStreak),
      summary('meilleure série (jours)', totals.bestStreak),
    )
  }

  function activitySection(): HTMLElement {
    return el('section', 'stats-section', el('h2', '', 'Activité'), createHeatmap(progress.history, today))
  }

  function chartFor(progressionMode: ProgressionMode, metric: Metric): HTMLElement {
    const time = isTimeMetric(progressionMode, metric)
    const points = progressionPoints(progress.history, progressionMode, metric, today, range).map((point) => ({
      day: point.day,
      value: point.value === null ? null : time ? point.value / MS_PER_SECOND : point.value,
    }))
    const values = points.flatMap((point) => (point.value === null ? [] : [point.value]))
    const title = chartTitle(progressionMode, metric)
    const format = (value: number) => (metric === 'precision' ? formatPercent(value) : time ? formatSeconds(value * MS_PER_SECOND) : String(Math.round(value)))
    const formatTick = (value: number) => (metric === 'precision' ? `${value} %` : time ? formatAxisSeconds(value) : String(value))
    const windowed = windowSummary(progress.history, progressionMode, metric, today, range)
    const headline = windowed.current === null ? 'aucune donnée' : `${format(time ? windowed.current / MS_PER_SECOND : windowed.current)}, ${values.length} ${plural(values.length, 'jour joué', 'jours joués')}`
    const chart = createLineChart({
      title,
      points,
      yTicks: metric === 'precision' ? PERCENT_TICKS : dataTicks(values, metric === 'best' && !time),
      format,
      formatTick,
      ariaSummary: `${title} ${MODE_LABELS[progressionMode]}, ${range} derniers jours : ${headline}`,
      emptyMessage: EMPTY_MESSAGE,
      valueHeader: title,
      height: metric === 'meanMs' ? 110 : 140,
    })
    if (values.length > 0) {
      chart.querySelector('.chart-data')?.before(el('p', 'chart-summary', summarySentence(progressionMode, metric, range, windowed)))
    }
    return chart
  }

  function renderProgression(): void {
    const metrics = metricsFor(mode)
    const firstMetric = metrics[0] as Metric
    const empty = progressionPoints(progress.history, mode, firstMetric, today, range).every((point) => point.value === null)
    const charts = (empty ? [firstMetric] : metrics).map((metric) => chartFor(mode, metric))
    progressionSection.replaceChildren(
      el('h2', '', 'Progression'),
      el(
        'div',
        'progress-controls',
        segmented(
          MODE_ORDER.map((value) => ({ value, label: MODE_LABELS[value] })),
          mode,
          (value) => {
            mode = value
            renderProgression()
          },
          'Mode',
        ),
        segmented(
          RANGES.map((value) => ({ value, label: `${value} j` })),
          range,
          (value) => {
            range = value
            renderProgression()
          },
          'Période',
        ),
      ),
      ...charts,
    )
  }

  function ranked(rows: RankedRow[]): HTMLElement[] {
    return weakestFirst(rows).map(tintedRow)
  }

  function clefSection(clef: Clef): HTMLElement {
    const rows: RankedRow[] = pitchesInRange(clef, true).map((pitch) => {
      const id = promptId({ clef, pitch })
      const record = progress.notes[id]
      const ratio = accuracy(record)
      return {
        name: `${PITCH_CLASS_NAMES[pitchClass(pitch)]} ${Math.floor(pitch / 12) - 1}`,
        ratio,
        detail: record ? `${(record.avgMs / 1000).toFixed(1)} s` : '',
        trend: noteTrend(progress.noteHistory, id, thisWeek),
      }
    })
    const shown = filter === 'weak' ? rows.filter(isWeak) : rows
    const body = shown.length > 0 ? ranked(shown) : [el('p', 'result-best', 'Aucune note faible, bravo !')]
    return el('div', 'clef-section', el('h3', '', CLEF_TITLES[clef]), ...body)
  }

  function strictOctaveSection(): HTMLElement {
    const missed = mostMissedPitches(progress.pitches, MOST_MISSED_SHOWN)
    const rows = missed.map(({ label, record }) => {
      const ratio = successRate(record)
      const row = el('div', 'note-row', el('span', 'note-name', label))
      row.style.setProperty('--tint', `hsl(${Math.round(ratio * MAX_HUE)} 60% 28%)`)
      row.append(el('span', '', `${Math.round(ratio * 100)} %`), el('span', '', `${record.correct}/${record.attempts}`))
      return row
    })
    const empty = Object.keys(progress.pitches).length === 0 ? 'Active l’octave stricte dans les réglages et joue.' : 'Aucune hauteur ratée, bravo !'
    return el('div', 'clef-section', el('h3', '', 'Octave stricte'), ...(rows.length > 0 ? rows : [el('p', 'result-best', empty)]))
  }

  function renderNotes(): void {
    const clefs = CLEFS.filter((clef) => hasData(progress, clef))
    notesSection.replaceChildren(
      el('h2', '', 'Notes'),
      segmented(
        (Object.keys(FILTER_LABELS) as NotesFilter[]).map((value) => ({ value, label: FILTER_LABELS[value] })),
        filter,
        (value) => {
          filter = value
          renderNotes()
        },
        'Filtre',
      ),
      ...(clefs.length > 0 ? clefs.map(clefSection) : [el('p', 'result-best', 'Joue Apprendre pour voir tes progrès.')]),
      strictOctaveSection(),
    )
  }

  function keysSection(): HTMLElement {
    const rows: RankedRow[] = ALL_SIGNATURES.flatMap((fifths) => {
      const record = progress.keys[keyStatsId(fifths)]
      const ratio = accuracy(record)
      if (ratio === null || !record) return []
      return [
        {
          name: `${signatureLabel(fifths)} ${keyFullName(fifths, 'major')}`,
          ratio,
          detail: `${record.correct}/${record.attempts}`,
          trend: noteTrend(progress.noteHistory, `keys:${fifths}`, thisWeek),
        },
      ]
    })
    const empty = el('p', 'result-best', 'Joue Armures pour voir tes progrès.')
    return el('section', 'stats-section', el('h2', '', 'Armures'), el('div', 'clef-section', ...(rows.length > 0 ? ranked(rows) : [empty])))
  }

  function block(title: string, ...items: HTMLElement[]): HTMLElement {
    return el('div', 'stats-block', el('h3', '', title), el('div', 'summary summary-4', ...items))
  }

  function challengesSection(): HTMLElement {
    const { hero, series, dictation, survival, daily } = progress
    const judged = hero.hits + hero.misses
    const perfectRatio = judged > 0 ? `${Math.round((hero.perfects / judged) * 100)} %` : '–'
    const todayAttempt = daily.attempts[dailyKey(new Date())]
    const streak = dailyStreak(Object.keys(daily.attempts), dailyKey(new Date()))
    const played = Object.keys(daily.attempts).length
    const wonLost = (won: number, lost: number) => [
      summary(plural(won, 'défi gagné', 'défis gagnés'), won),
      summary(plural(lost, 'défi perdu', 'défis perdus'), lost),
    ]
    return el(
      'section',
      'stats-section',
      el('h2', '', 'Défis'),
      block('Records', summary('meilleur 60 s', progress.bestTimed), summary('série de bonnes réponses', progress.bestStreak), summary('meilleur 60 s Armures', progress.keysBestTimed)),
      block(
        'Séries',
        summary('meilleur temps', series.bestMs > 0 ? formatTenthsUp(series.bestMs) : '–'),
        summary(plural(series.played, 'série jouée', 'séries jouées'), series.played),
        ...wonLost(series.won, series.lost),
      ),
      block(
        'Dictée',
        summary('meilleur temps', dictation.bestMs > 0 ? formatTenthsUp(dictation.bestMs) : '–'),
        summary(plural(dictation.played, 'dictée jouée', 'dictées jouées'), dictation.played),
        summary(plural(dictation.replays, 'réécoute', 'réécoutes'), dictation.replays),
        ...wonLost(dictation.won, dictation.lost),
      ),
      block(
        'Survie',
        summary('meilleur score', survival.bestScore),
        summary(plural(survival.played, 'partie jouée', 'parties jouées'), survival.played),
        ...wonLost(survival.challengesWon, survival.challengesLost),
      ),
      block(
        'Solfège hero',
        summary('meilleur score', hero.bestScore),
        summary('meilleure série', hero.bestStreak),
        summary('BPM max', hero.maxBpm),
        summary('parfaits', perfectRatio),
        summary(plural(hero.hits, 'réussie', 'réussies'), hero.hits),
        summary(plural(hero.misses, 'ratée', 'ratées'), hero.misses),
        ...wonLost(hero.challengesWon, hero.challengesLost),
      ),
      block(
        'Défi du jour',
        summary(plural(streak, 'jour d’affilée', 'jours d’affilée'), streak),
        summary('meilleur temps', daily.bestMs > 0 ? formatTenthsUp(daily.bestMs) : '–'),
        summary(plural(played, 'jour joué', 'jours joués'), played),
        summary('aujourd’hui', todayAttempt ? checked(formatTenthsUp(todayAttempt.totalMs)) : 'à jouer'),
      ),
    )
  }

  function render(): void {
    renderProgression()
    renderNotes()
    element.replaceChildren(
      el('h1', '', 'Statistiques'),
      headerTiles(),
      activitySection(),
      progressionSection,
      notesSection,
      keysSection(),
      challengesSection(),
      el(
        'div',
        'actions sticky-actions',
        button('danger', 'Réinitialiser', () => {
          if (confirm('Effacer toute la progression ?')) {
            progress = onReset()
            render()
          }
        }),
        button('primary', 'Retour', onBack),
      ),
    )
  }

  render()
  return element
}
