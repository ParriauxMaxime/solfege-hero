import { CHALLENGE_BARS } from '../hero/challenge'
import type { Melody, Score } from '../hero/types'
import { START_BPM_MAX, START_BPM_MIN } from '../hero/tempo'
import type { Settings } from '../storage'
import type { createScoreLibrary } from '../storage/scores'
import { t } from '../i18n'
import { scoreTitle } from '../scores/title'
import { button, el } from './dom'

export interface HeroStartOptions {
  settings: Settings
  library: ReturnType<typeof createScoreLibrary>
  onChange: (patch: Partial<Settings>) => void
  onPlay: (melody: Melody | null) => void
  onPlayChallenge: () => void
}

export function createHeroStart({ settings: initial, library, onChange, onPlay, onPlayChallenge }: HeroStartOptions): HTMLElement {
  let settings = initial
  let scores: Score[] = []
  const element = el('section', 'screen panel')

  function update(patch: Partial<Settings>): void {
    settings = { ...settings, ...patch }
    onChange(patch)
  }

  function selectedMelody(): Melody | null {
    return scores.find((score) => score.name === settings.heroMelody) ?? null
  }

  function melodySetting(onPick: (melody: Melody | null) => void): HTMLElement {
    const select = el('select', 'select')
    select.append(new Option(t('hero.start.random'), ''), ...scores.map((score) => new Option(scoreTitle(score.name), score.name)))
    select.value = selectedMelody()?.name ?? ''
    select.addEventListener('change', () => onPick(scores.find((score) => score.name === select.value) ?? null))
    return el('div', 'setting', el('h2', '', t('hero.start.melody')), select)
  }

  function tempoSetting(): HTMLElement {
    const label = el('span', 'tempo-label', t('hero.start.bpm', { bpm: settings.heroTempo }))
    const slider = el('input', 'slider')
    slider.type = 'range'
    slider.min = String(START_BPM_MIN)
    slider.max = String(START_BPM_MAX)
    slider.value = String(settings.heroTempo)
    slider.addEventListener('input', () => {
      label.textContent = t('hero.start.bpm', { bpm: Number(slider.value) })
      update({ heroTempo: Number(slider.value) })
    })
    return el('div', 'setting', el('h2', '', t('hero.start.tempo')), el('div', 'slider-row', slider, label))
  }

  function metronomeSetting(): HTMLElement {
    const options = [false, true].map((value) => {
      const option = button('segment', value ? t('hero.start.yes') : t('hero.start.no'), () => {
        update({ metronome: value })
        render()
      })
      option.classList.toggle('active', value === settings.metronome)
      return option
    })
    return el('div', 'setting', el('h2', '', t('hero.start.metronome')), el('div', 'segmented', ...options))
  }

  function render(): void {
    element.replaceChildren(
      el('h1', '', 'Solfège hero'),
      melodySetting((melody) => {
        update({ heroMelody: melody?.name ?? '', ...(melody ? { heroTempo: melody.tempo } : {}) })
        render()
      }),
      tempoSetting(),
      metronomeSetting(),
      button('primary', t('hero.start.play'), () => onPlay(selectedMelody())),
      ...(selectedMelody() ? [] : [button('segment-button', t('hero.start.challenge', { count: CHALLENGE_BARS }), onPlayChallenge)]),
    )
  }

  render()
  void Promise.resolve(library.list()).then((loaded) => {
    scores = loaded
    render()
  })
  return element
}
