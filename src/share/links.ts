import { appBasePath, routePath, type LandingScreen, type Screen } from '../../scripts/routes.mjs'

export type LandingKind = 'challenge' | 'survival' | 'hero' | 'daily' | 'score' | 'dictation'

export function appBase(href: string): string {
  const url = new URL(href)
  return new URL(appBasePath(url.pathname), url).href
}

export function routeUrl(base: string, screen: Screen | LandingScreen): string {
  const segment = routePath(screen)
  return segment ? `${base}${segment}/` : base
}

export function landingUrl(base: string, kind: LandingKind, hash: string): string {
  return `${routeUrl(base, kind)}#${hash}`
}
