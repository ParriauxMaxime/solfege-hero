import type { Naming } from '../music/notes'
import { getLanguage } from './language'

export type NamingSetting = Naming | 'auto'

/** An explicit choice wins; otherwise Do Ré Mi in French and C D E in English. */
export function resolveNaming(setting: NamingSetting): Naming {
  if (setting !== 'auto') return setting
  return getLanguage() === 'fr' ? 'latin' : 'english'
}
