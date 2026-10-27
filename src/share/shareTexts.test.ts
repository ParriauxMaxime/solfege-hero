import { afterEach, describe, expect, it } from 'vitest'
import { setLanguage, type Language } from '../i18n'
import {
  COLORBLIND_SQUARES,
  dailyCallToAction,
  dailyShareTitle,
  dictationShareTitle,
  scoreShareTitle,
  seriesShareTitle,
  shareDialogTitle,
  shareText,
} from '../series/share'
import { survivalShareText } from '../survival/share'

const results = Array.from({ length: 20 }, (_, index) => index !== 3 && index !== 11)
const base = { results, totalMs: 47_301, penaltyMs: 10_000 }

function inLanguage<T>(language: Language, build: () => T): T {
  setLanguage(language)
  return build()
}

afterEach(() => setLanguage('fr'))

describe('share texts in French', () => {
  const fr = <T>(build: () => T) => inLanguage('fr', build)

  it('random series', () => {
    expect(fr(() => shareText({ ...base, title: seriesShareTitle(4821) }))).toMatchInlineSnapshot(`
      "Solfège hero · Série #4821 · ⏱ 0:47.4
      🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟩
      18/20 du premier coup (+10 s)
      Bats-moi !"
    `)
    expect(fr(() => shareDialogTitle('series'))).toMatchInlineSnapshot(`"Solfège hero : défi Séries"`)
  })

  it('score series without penalty, colourblind squares', () => {
    expect(fr(() => shareText({ ...base, title: scoreShareTitle('Für Elise'), penaltyMs: 0, squares: COLORBLIND_SQUARES }))).toMatchInlineSnapshot(`
      "Solfège hero · « Für Elise » · ⏱ 0:47.4
      🟦🟦🟦🟧🟦🟦🟦🟦🟦🟦🟦🟧🟦🟦🟦🟦🟦🟦🟦🟦
      18/20 du premier coup
      Bats-moi !"
    `)
  })

  it('daily challenge', () => {
    const text = fr(() => shareText({ ...base, title: dailyShareTitle('20261024'), callToAction: dailyCallToAction() }))
    expect(text).toMatchInlineSnapshot(`
      "Solfège hero · Défi du jour 24/10/2026 · ⏱ 0:47.4
      🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟩
      18/20 du premier coup (+10 s)
      Joue aussi !"
    `)
    expect(fr(() => shareDialogTitle('daily'))).toMatchInlineSnapshot(`"Solfège hero : défi du jour"`)
  })

  it('dictation', () => {
    expect(fr(() => shareText({ ...base, title: dictationShareTitle(77) }))).toMatchInlineSnapshot(`
      "Solfège hero · Dictée #77 · ⏱ 0:47.4
      🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟩
      18/20 du premier coup (+10 s)
      Bats-moi !"
    `)
    expect(fr(() => shareDialogTitle('dictation'))).toMatchInlineSnapshot(`"Solfège hero : défi Dictée"`)
  })

  it('survival', () => {
    expect(fr(() => survivalShareText({ seed: 1234, score: 47, lives: 1 }))).toMatchInlineSnapshot(`
      "Solfège hero · Survie #1234 · 🎯 47 notes · ❤️🖤🖤
      Bats-moi !"
    `)
    expect(fr(() => survivalShareText({ seed: 1234, score: 1, lives: 0 }))).toMatchInlineSnapshot(`
      "Solfège hero · Survie #1234 · 🎯 1 note · 🖤🖤🖤
      Bats-moi !"
    `)
    expect(fr(() => shareDialogTitle('survival'))).toMatchInlineSnapshot(`"Solfège hero : défi Survie"`)
  })
})

describe('share texts in English', () => {
  const en = <T>(build: () => T) => inLanguage('en', build)

  it('random series', () => {
    expect(en(() => shareText({ ...base, title: seriesShareTitle(4821) }))).toMatchInlineSnapshot(`
      "Solfège hero · Series #4821 · ⏱ 0:47.4
      🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟩
      18/20 on the first try (+10 s)
      Beat me!"
    `)
    expect(en(() => shareDialogTitle('series'))).toMatchInlineSnapshot(`"Solfège hero: Series challenge"`)
  })

  it('score series without penalty, colourblind squares', () => {
    expect(en(() => shareText({ ...base, title: scoreShareTitle('Für Elise'), penaltyMs: 0, squares: COLORBLIND_SQUARES }))).toMatchInlineSnapshot(`
      "Solfège hero · “Für Elise” · ⏱ 0:47.4
      🟦🟦🟦🟧🟦🟦🟦🟦🟦🟦🟦🟧🟦🟦🟦🟦🟦🟦🟦🟦
      18/20 on the first try
      Beat me!"
    `)
  })

  it('daily challenge', () => {
    const text = en(() => shareText({ ...base, title: dailyShareTitle('20261024'), callToAction: dailyCallToAction() }))
    expect(text).toMatchInlineSnapshot(`
      "Solfège hero · Daily challenge 24/10/2026 · ⏱ 0:47.4
      🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟩
      18/20 on the first try (+10 s)
      Play too!"
    `)
    expect(en(() => shareDialogTitle('daily'))).toMatchInlineSnapshot(`"Solfège hero: daily challenge"`)
  })

  it('dictation', () => {
    expect(en(() => shareText({ ...base, title: dictationShareTitle(77) }))).toMatchInlineSnapshot(`
      "Solfège hero · Dictation #77 · ⏱ 0:47.4
      🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟩
      18/20 on the first try (+10 s)
      Beat me!"
    `)
    expect(en(() => shareDialogTitle('dictation'))).toMatchInlineSnapshot(`"Solfège hero: Dictation challenge"`)
  })

  it('survival', () => {
    expect(en(() => survivalShareText({ seed: 1234, score: 47, lives: 1 }))).toMatchInlineSnapshot(`
      "Solfège hero · Survival #1234 · 🎯 47 notes · ❤️🖤🖤
      Beat me!"
    `)
    expect(en(() => survivalShareText({ seed: 1234, score: 1, lives: 0 }))).toMatchInlineSnapshot(`
      "Solfège hero · Survival #1234 · 🎯 1 note · 🖤🖤🖤
      Beat me!"
    `)
    expect(en(() => shareDialogTitle('survival'))).toMatchInlineSnapshot(`"Solfège hero: Survival challenge"`)
  })
})

describe('links stay language-neutral', () => {
  it('builds the same URLs in both languages', async () => {
    const { challengeUrl } = await import('../series/challenge')
    const { survivalChallengeUrl } = await import('../survival/challenge')
    const { dictationChallengeUrl } = await import('../dictation/challenge')
    const base = 'https://example.test/solfege/'
    const series = { config: { kind: 'random', version: 4, seed: 9, clefs: ['treble'], armures: true, difficulty: 3, level: 50 }, timeS: 47.3 } as const
    const survival = { config: { seed: 5, clefs: ['bass'], armures: false, delayS: 3 }, score: 12 } as const
    const dictation = { config: { seed: 8, clef: 'alto', level: 40, armures: true }, timeS: 61.2 } as const
    const build = () => [challengeUrl(base, series as never), survivalChallengeUrl(base, survival as never), dictationChallengeUrl(base, dictation as never)]
    expect(inLanguage('en', build)).toEqual(inLanguage('fr', build))
  })
})
