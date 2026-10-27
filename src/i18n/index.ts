import { en } from './en'
import { fr } from './fr'
import { formatNumber } from './format'
import { getLanguage } from './language'
import { formatMessage, type MessageParams } from './message'
import type { MessageKey } from './messages'

export type { MessageKey } from './messages'
export type { Language, LanguageSetting } from './language'
export { detectLanguage, getLanguage, onLanguageChange, resolveLanguage, setLanguage } from './language'

const DICTIONARIES = { fr, en }

export function lookup(dictionary: unknown, key: string): string | undefined {
  let node = dictionary
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[segment]
  }
  return typeof node === 'string' ? node : undefined
}

export function t(key: MessageKey, params: MessageParams = {}): string {
  const language = getLanguage()
  const template = lookup(DICTIONARIES[language], key) ?? lookup(fr, key)
  return template === undefined ? key : formatMessage(template, params, language, (value) => formatNumber(value))
}
