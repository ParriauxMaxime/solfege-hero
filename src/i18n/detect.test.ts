import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectLanguage, getLanguage, onLanguageChange, resolveLanguage, setLanguage } from './language'
import { resolveNaming } from './naming'

afterEach(() => setLanguage('fr'))

describe('detectLanguage', () => {
  it('picks French when any entry is French', () => {
    expect(detectLanguage(['fr-CA', 'en'])).toBe('fr')
    expect(detectLanguage(['en-US', 'fr'])).toBe('fr')
    expect(detectLanguage(['FR-be'])).toBe('fr')
  })

  it('falls back to English', () => {
    expect(detectLanguage(['de'])).toBe('en')
    expect(detectLanguage([])).toBe('en')
  })
})

describe('resolveLanguage', () => {
  it('prefers the forced language, then the setting, then detection', () => {
    expect(resolveLanguage('fr', 'en', 'en')).toBe('en')
    expect(resolveLanguage('fr', 'en')).toBe('fr')
    expect(resolveLanguage('auto', 'en')).toBe('en')
    expect(resolveLanguage('auto', 'fr', null)).toBe('fr')
  })
})

describe('language store', () => {
  it('notifies listeners on change only and sets the html lang', () => {
    const listener = vi.fn()
    const unsubscribe = onLanguageChange(listener)
    setLanguage('en')
    setLanguage('en')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('en')
    expect(getLanguage()).toBe('en')
    unsubscribe()
    setLanguage('fr')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('resolveNaming', () => {
  it('follows the language unless the choice is explicit', () => {
    expect(resolveNaming('auto')).toBe('latin')
    setLanguage('en')
    expect(resolveNaming('auto')).toBe('english')
    expect(resolveNaming('latin')).toBe('latin')
  })
})
