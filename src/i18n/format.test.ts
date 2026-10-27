import { afterEach, describe, expect, it } from 'vitest'
import { formatDate, formatDecimal, formatDuration, formatPercent, formatSeconds } from './format'
import { setLanguage } from './language'
import { typography } from './message'

afterEach(() => setLanguage('fr'))

describe('formatters', () => {
  it('puts a narrow no-break space before % in French only', () => {
    expect(formatPercent(0.42)).toBe('42 %')
    setLanguage('en')
    expect(formatPercent(0.42)).toBe('42%')
  })

  it('formats decimals and seconds per language', () => {
    expect(formatDecimal(42.34)).toBe('42,3')
    expect(formatSeconds(42300)).toBe('42,3 s')
    setLanguage('en')
    expect(formatDecimal(42.34)).toBe('42.3')
    expect(formatSeconds(42300)).toBe('42.3 s')
  })

  it('abbreviates English months to three letters, September included', () => {
    setLanguage('en')
    const options = { day: 'numeric', month: 'short', timeZone: 'UTC' } as const
    expect(formatDate(Date.UTC(2026, 8, 5), options)).toBe('5 Sep')
    expect(formatDate(Date.UTC(2026, 9, 24), { month: 'short', timeZone: 'UTC' })).toBe('Oct')
  })

  it('formats a duration', () => {
    expect(formatDuration(65000)).toBe('1:05')
  })

  it('applies French typography only in French', () => {
    expect(typography('Prêt ? « Oui » : 5 %', 'fr')).toBe('Prêt ? « Oui » : 5 %')
    expect(typography('Ready ? « Yes »', 'en')).toBe('Ready ? « Yes »')
  })
})
