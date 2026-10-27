export const LANGUAGES = ['fr', 'en'] as const
export type Language = (typeof LANGUAGES)[number]
export const LANGUAGE_SETTINGS = ['auto', ...LANGUAGES] as const
export type LanguageSetting = (typeof LANGUAGE_SETTINGS)[number]

let current: Language = 'fr'
const listeners = new Set<(language: Language) => void>()

export function getLanguage(): Language {
  return current
}

export function setLanguage(language: Language): void {
  if (typeof document !== 'undefined') document.documentElement.lang = language
  if (language === current) return
  current = language
  for (const listener of [...listeners]) listener(language)
}

export function onLanguageChange(callback: (language: Language) => void): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

export function detectLanguage(languages: readonly string[] = navigator.languages): Language {
  return languages.some((tag) => tag.toLowerCase().startsWith('fr')) ? 'fr' : 'en'
}

export function resolveLanguage(setting: LanguageSetting, detected: Language, forced: Language | null = null): Language {
  if (forced) return forced
  return setting === 'auto' ? detected : setting
}
