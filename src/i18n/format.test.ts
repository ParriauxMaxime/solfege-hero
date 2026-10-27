import { afterEach, describe, expect, it } from 'vitest'
import { formatDecimal, formatDuration, formatPercent, formatSeconds } from './format'
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

  it('formats a duration', () => {
    expect(formatDuration(65000)).toBe('1:05')
  })

  it('applies French typography only in French', () => {
    expect(typography('Prêt ? « Oui » : 5 %', 'fr')).toBe('Prêt ? « Oui » : 5 %')
    expect(typography('Ready ? « Yes »', 'en')).toBe('Ready ? « Yes »')
  })
})
