import { t, type MessageKey } from '../i18n'

/** Built-in melody names double as ids (settings, saved choices), so only their display is translated. */
const TITLE_KEYS: Record<string, MessageKey> = {
  'Frère Jacques (clé de fa)': 'library.melodies.frereJacquesBass',
  'Ode à la joie': 'library.melodies.odeToJoy',
  'Menuet en sol (Bach)': 'library.melodies.minuetInG',
  'Lettre à Élise (Beethoven)': 'library.melodies.furElise',
}

export function scoreTitle(name: string): string {
  const key = TITLE_KEYS[name]
  return key ? t(key) : name
}
