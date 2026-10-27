export const ROUTES = [
  { screen: 'home', segment: '' },
  { screen: 'learn', segment: 'learn' },
  { screen: 'keys', segment: 'keys' },
  { screen: 'series', segment: 'series' },
  { screen: 'dictation', segment: 'dictation' },
  { screen: 'survival', segment: 'survival' },
  { screen: 'hero', segment: 'hero' },
  { screen: 'scores', segment: 'scores' },
  { screen: 'stats', segment: 'stats' },
  { screen: 'settings', segment: 'settings' },
  { screen: 'daily', segment: 'daily' },
]

export const LANDING_ONLY = [
  { screen: 'challenge', segment: 'challenge' },
  { screen: 'score', segment: 'score' },
]

export const LEGACY_REDIRECTS = {
  apprendre: 'learn',
  armures: 'keys',
  dictee: 'dictation',
  survie: 'survival',
  partitions: 'scores',
  reglages: 'settings',
  jour: 'daily',
  defi: 'challenge',
  partition: 'score',
}

const PAGES = [...ROUTES, ...LANDING_ONLY]
const KNOWN_SEGMENTS = new Set([...PAGES.map((route) => route.segment).filter(Boolean), ...Object.keys(LEGACY_REDIRECTS)])

const LANGUAGE_SEGMENTS = ['fr', 'en']

function segmentsOf(pathname) {
  return pathname
    .replace(/\/index\.html$/, '')
    .split('/')
    .filter(Boolean)
}

function withoutRoute(segments) {
  return segments.length > 0 && KNOWN_SEGMENTS.has(segments.at(-1)) ? segments.slice(0, -1) : segments
}

export function languageFromPath(pathname) {
  const last = withoutRoute(segmentsOf(pathname)).at(-1)
  return LANGUAGE_SEGMENTS.includes(last) ? last : null
}

export function screenFromPath(pathname) {
  const last = segmentsOf(pathname).at(-1)
  if (last === undefined || LANGUAGE_SEGMENTS.includes(last)) return 'home'
  return PAGES.find((route) => route.segment === last)?.screen ?? null
}

export function appBasePath(pathname) {
  const segments = withoutRoute(segmentsOf(pathname))
  if (LANGUAGE_SEGMENTS.includes(segments.at(-1))) segments.pop()
  return segments.length === 0 ? '/' : `/${segments.join('/')}/`
}

export function routePath(screen) {
  const route = PAGES.find((candidate) => candidate.screen === screen)
  if (!route) throw new Error(`unknown screen: ${screen}`)
  return route.segment
}

export function routeSegments() {
  return PAGES.map((route) => route.segment).filter(Boolean)
}
