import { afterEach, describe, expect, it } from 'vitest'
import { setLanguage } from '../i18n'
import { MELODIES } from '../music/melodies'
import { scoreTitle } from './title'

afterEach(() => setLanguage('fr'))

describe('scoreTitle', () => {
  it('keeps the stored name in French', () => {
    expect(MELODIES.map((melody) => scoreTitle(melody.name))).toEqual(MELODIES.map((melody) => melody.name))
  })

  it('translates generic titles and keeps traditional ones in English', () => {
    setLanguage('en')
    expect(scoreTitle('Frère Jacques (clé de fa)')).toBe('Frère Jacques (bass clef)')
    expect(scoreTitle('Lettre à Élise (Beethoven)')).toBe('Für Elise (Beethoven)')
    expect(scoreTitle('Au clair de la lune')).toBe('Au clair de la lune')
    expect(scoreTitle('My own score')).toBe('My own score')
  })
})
