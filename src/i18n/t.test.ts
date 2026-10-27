import { afterEach, describe, expect, it } from 'vitest'
import { formatMessage, placeholderNames } from './message'
import { formatNumber } from './format'
import { getLanguage, setLanguage } from './language'
import { t } from './index'

const NOTES = '{count, plural, =0 {aucune note} one {# note} other {# notes}}'

function render(template: string, params: Record<string, string | number>, language: 'fr' | 'en'): string {
  return formatMessage(template, params, language, (value) => new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-GB').format(value))
}

afterEach(() => setLanguage('fr'))

describe('t', () => {
  it('translates a key in the current language', () => {
    expect(t('settings.language.label')).toBe('Langue / Language')
    setLanguage('en')
    expect(t('app.topBar.home')).toBe('Home')
    expect(getLanguage()).toBe('en')
  })

  it('replaces params', () => {
    expect(t('app.forcedLanguage.message', { language: 'English' })).toBe('Langue de ce lien : English. La garder ?')
  })

  it('falls back to the key when nothing matches', () => {
    expect(t('nope.nothing' as never)).toBe('nope.nothing')
  })
})

describe('plurals', () => {
  it('treats 0 and 1 as one in French', () => {
    const template = '{count, plural, one {# note} other {# notes}}'
    expect([0, 1, 2].map((count) => render(template, { count }, 'fr'))).toEqual(['0 note', '1 note', '2 notes'])
  })

  it('treats only 1 as one in English', () => {
    const template = '{count, plural, one {# note} other {# notes}}'
    expect([0, 1, 2].map((count) => render(template, { count }, 'en'))).toEqual(['0 notes', '1 note', '2 notes'])
  })

  it('prefers exact cases', () => {
    expect([0, 1, 5].map((count) => render(NOTES, { count }, 'fr'))).toEqual(['aucune note', '1 note', '5 notes'])
  })

  it('formats numbers with the language', () => {
    expect(render('{count, plural, other {# pts}}', { count: 1234.5 }, 'en')).toBe('1,234.5 pts')
    expect(render('{value}', { value: 1234.5 }, 'fr')).toBe(`${formatNumberFr(1234.5)}`)
  })

  it('lists parameter names and rejects bad syntax', () => {
    expect(placeholderNames(`{name} ${NOTES}`)).toEqual(['count', 'name'])
    expect(() => placeholderNames('{count, plural, one {x}}')).toThrow()
    expect(() => placeholderNames('{oops')).toThrow()
  })
})

function formatNumberFr(value: number): string {
  setLanguage('fr')
  return formatNumber(value)
}
