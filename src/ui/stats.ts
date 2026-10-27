import { t, type MessageKey } from '../i18n'
import { formatNumber, formatPercent as formatRatio } from '../i18n/format'
import { resolveNaming, type NamingSetting } from '../i18n/naming'
import { accuracy, promptId } from '../game/sampler'
import { ALL_SIGNATURES, keyStatsId } from '../game/keysSampler'
import { mostMissedPitches, successRate } from '../game/strictOctave'
import { keyFullName, signatureLabel } from '../music/keySignature'
import { CLEFS, pitchClass, pitchClassLabel, pitchesInRange, type Clef } from '../music/notes'
import { dailyKey, dailyStreak } from '../series/daily'
import { formatTenthsUp } from '../series/share'
import { overview } from '../stats/aggregate'
import { dayKeyOf, weekKeyOf } from '../stats/dates'
import { formatAxisSeconds, formatPercent, formatSeconds } from '../stats/format'
import { LOWER_BEST_IS_BETTER, type DayKey, type HistoryMode } from '../stats/history'
import { metricsFor, progressionPoints, windowSummary, type Metric } from '../stats/progression'
import { isWeak, trendDescription, weakestFirst } from '../stats/rank'
import { dataTicks, PERCENT_TICKS } from '../stats/scale'
import { emptyMessage, metricLabel, summarySentence } from '../stats/summary'
import { noteTrend, type Trend } from '../stats/trend'
import type { Progress } from '../storage'
import { createHeatmap } from './charts/heatmap'
import { createLineChart } from './charts/lineChart'
import { button, el } from './dom'
import { icon } from './icons'

export interface StatsOptions {
  progress: Progress
  onReset: () => Progress
  onBack: () => void
  today?: DayKey
  naming?: NamingSetting
}

type ProgressionMode = Extract<HistoryMode, 'learn' | 'keys' | 'series' | 'dictation' | 'survival' | 'hero'>
type NotesFilter = 'all' | 'weak'

const CLEF_KEYS = { treble: 'stats.notes.treble', bass: 'stats.notes.bass', alto: 'stats.notes.alto' } satisfies Record<Clef, MessageKey>
const MODE_KEYS = {
  learn: 'stats.modes.learn',
  keys: 'stats.modes.keys',
  series: 'stats.modes.series',
  dictation: 'stats.modes.dictation',
  survival: 'stats.modes.survival',
  hero: 'stats.modes.hero',
} satisfies Record<ProgressionMode, MessageKey>
const MODE_ORDER: ProgressionMode[] = ['learn', 'keys', 'series', 'dictation', 'survival', 'hero']
const RANGES = [7, 30, 90]
const DEFAULT_RANGE = 30
const FILTER_KEYS = { all: 'stats.notes.all', weak: 'stats.notes.weak' } satisfies Record<NotesFilter, MessageKey>
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
  return metric === 'meanMs' ? t('stats.metrics.meanTitle') : metricLabel(mode, metric)
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
    element.append(el('span', '', formatRatio(row.ratio)), el('span', '', row.detail))
  }
  element.append(trendArrow(row.trend))
  return element
}

export function createStatsScreen({ progress: initial, onReset, onBack, today: forcedToday, naming = 'auto' }: StatsOptions): HTMLElement {
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
      summary(t('stats.tiles.answers', { count: answered }), formatNumber(answered)),
      summary(t('stats.tiles.daysPlayed', { count: totals.daysPlayed }), totals.daysPlayed),
      summary(t('stats.tiles.streakDays', { count: totals.currentStreak }), totals.currentStreak),
      summary(t('stats.tiles.bestStreakDays'), totals.bestStreak),
    )
  }

  function activitySection(): HTMLElement {
    return el('section', 'stats-section', el('h2', '', t('stats.activity.title')), createHeatmap(progress.history, today))
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
    const formatTick = (value: number) => (metric === 'precision' ? formatPercent(value) : time ? formatAxisSeconds(value) : String(value))
    const windowed = windowSummary(progress.history, progressionMode, metric, today, range)
    const headline =
      windowed.current === null
        ? t('stats.progression.noData')
        : t('stats.progression.headline', { value: format(time ? windowed.current / MS_PER_SECOND : windowed.current), count: values.length })
    const chart = createLineChart({
      title,
      points,
      yTicks: metric === 'precision' ? PERCENT_TICKS : dataTicks(values, metric === 'best' && !time),
      format,
      formatTick,
      ariaSummary: t('stats.progression.ariaSummary', { title, mode: t(MODE_KEYS[progressionMode]), days: String(range), headline }),
      emptyMessage: emptyMessage(),
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
      el('h2', '', t('stats.progression.title')),
      el(
        'div',
        'progress-controls',
        segmented(
          MODE_ORDER.map((value) => ({ value, label: t(MODE_KEYS[value]) })),
          mode,
          (value) => {
            mode = value
            renderProgression()
          },
          t('stats.progression.mode'),
        ),
        segmented(
          RANGES.map((value) => ({ value, label: t('stats.progression.range', { days: String(value) }) })),
          range,
          (value) => {
            range = value
            renderProgression()
          },
          t('stats.progression.period'),
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
        name: `${pitchClassLabel(pitchClass(pitch), resolveNaming(naming))} ${Math.floor(pitch / 12) - 1}`,
        ratio,
        detail: record ? formatSeconds(record.avgMs) : '',
        trend: noteTrend(progress.noteHistory, id, thisWeek),
      }
    })
    const shown = filter === 'weak' ? rows.filter(isWeak) : rows
    const body = shown.length > 0 ? ranked(shown) : [el('p', 'result-best', t('stats.notes.noWeak'))]
    return el('div', 'clef-section', el('h3', '', t(CLEF_KEYS[clef])), ...body)
  }

  function strictOctaveSection(): HTMLElement {
    const missed = mostMissedPitches(progress.pitches, MOST_MISSED_SHOWN)
    const rows = missed.map(({ label, record }) => {
      const ratio = successRate(record)
      const row = el('div', 'note-row', el('span', 'note-name', label))
      row.style.setProperty('--tint', `hsl(${Math.round(ratio * MAX_HUE)} 60% 28%)`)
      row.append(el('span', '', formatRatio(ratio)), el('span', '', `${record.correct}/${record.attempts}`))
      return row
    })
    const empty = Object.keys(progress.pitches).length === 0 ? t('stats.notes.strictOff') : t('stats.notes.strictNone')
    return el('div', 'clef-section', el('h3', '', t('stats.notes.strictTitle')), ...(rows.length > 0 ? rows : [el('p', 'result-best', empty)]))
  }

  function renderNotes(): void {
    const clefs = CLEFS.filter((clef) => hasData(progress, clef))
    notesSection.replaceChildren(
      el('h2', '', t('stats.notes.title')),
      segmented(
        (Object.keys(FILTER_KEYS) as NotesFilter[]).map((value) => ({ value, label: t(FILTER_KEYS[value]) })),
        filter,
        (value) => {
          filter = value
          renderNotes()
        },
        t('stats.notes.filter'),
      ),
      ...(clefs.length > 0 ? clefs.map(clefSection) : [el('p', 'result-best', t('stats.notes.empty'))]),
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
    const empty = el('p', 'result-best', t('stats.keys.empty'))
    return el('section', 'stats-section', el('h2', '', t('stats.keys.title')), el('div', 'clef-section', ...(rows.length > 0 ? ranked(rows) : [empty])))
  }

  function block(title: string, ...items: HTMLElement[]): HTMLElement {
    return el('div', 'stats-block', el('h3', '', title), el('div', 'summary summary-4', ...items))
  }

  function challengesSection(): HTMLElement {
    const { hero, series, dictation, survival, daily } = progress
    const judged = hero.hits + hero.misses
    const perfectRatio = judged > 0 ? formatRatio(hero.perfects / judged) : '–'
    const todayAttempt = daily.attempts[dailyKey(new Date())]
    const streak = dailyStreak(Object.keys(daily.attempts), dailyKey(new Date()))
    const played = Object.keys(daily.attempts).length
    const bestTime = (ms: number) => summary(t('stats.challenges.bestTime'), ms > 0 ? formatTenthsUp(ms) : '–')
    const wonLost = (won: number, lost: number) => [
      summary(t('stats.challenges.wonLabel', { count: won }), won),
      summary(t('stats.challenges.lostLabel', { count: lost }), lost),
    ]
    return el(
      'section',
      'stats-section',
      el('h2', '', t('stats.challenges.title')),
      block(
        t('stats.challenges.records'),
        summary(t('stats.challenges.best60'), progress.bestTimed),
        summary(t('stats.challenges.bestCorrectStreak'), progress.bestStreak),
        summary(t('stats.challenges.best60Keys'), progress.keysBestTimed),
      ),
      block(
        t('stats.challenges.series'),
        bestTime(series.bestMs),
        summary(t('stats.challenges.seriesPlayed', { count: series.played }), series.played),
        ...wonLost(series.won, series.lost),
      ),
      block(
        t('stats.challenges.dictation'),
        bestTime(dictation.bestMs),
        summary(t('stats.challenges.dictationPlayed', { count: dictation.played }), dictation.played),
        summary(t('stats.challenges.replays', { count: dictation.replays }), dictation.replays),
        ...wonLost(dictation.won, dictation.lost),
      ),
      block(
        t('stats.challenges.survival'),
        summary(t('stats.challenges.bestScore'), survival.bestScore),
        summary(t('stats.challenges.survivalPlayed', { count: survival.played }), survival.played),
        ...wonLost(survival.challengesWon, survival.challengesLost),
      ),
      block(
        t('stats.challenges.hero'),
        summary(t('stats.challenges.bestScore'), hero.bestScore),
        summary(t('stats.challenges.heroBestStreak'), hero.bestStreak),
        summary(t('stats.challenges.heroMaxBpm'), hero.maxBpm),
        summary(t('stats.challenges.heroPerfects'), perfectRatio),
        summary(t('stats.challenges.heroHits', { count: hero.hits }), hero.hits),
        summary(t('stats.challenges.heroMisses', { count: hero.misses }), hero.misses),
        ...wonLost(hero.challengesWon, hero.challengesLost),
      ),
      block(
        t('stats.challenges.daily'),
        summary(t('stats.tiles.streakDays', { count: streak }), streak),
        bestTime(daily.bestMs),
        summary(t('stats.tiles.daysPlayed', { count: played }), played),
        summary(t('stats.challenges.dailyToday'), todayAttempt ? checked(formatTenthsUp(todayAttempt.totalMs)) : t('stats.challenges.dailyToPlay')),
      ),
    )
  }

  function render(): void {
    renderProgression()
    renderNotes()
    element.replaceChildren(
      el('h1', '', t('stats.title')),
      headerTiles(),
      activitySection(),
      progressionSection,
      notesSection,
      keysSection(),
      challengesSection(),
      el(
        'div',
        'actions sticky-actions',
        button('danger', t('stats.reset'), () => {
          if (confirm(t('stats.resetConfirm'))) {
            progress = onReset()
            render()
          }
        }),
        button('primary', t('stats.back'), onBack),
      ),
    )
  }

  render()
  return element
}
