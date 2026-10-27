export type Screen =
  | 'home'
  | 'learn'
  | 'keys'
  | 'series'
  | 'dictation'
  | 'survival'
  | 'hero'
  | 'scores'
  | 'stats'
  | 'settings'
  | 'daily'
export type LandingScreen = 'challenge' | 'score'
export interface Route<S extends string = Screen> {
  screen: S
  segment: string
}
export const ROUTES: Route[]
export const LANDING_ONLY: Route<LandingScreen>[]
export const LEGACY_REDIRECTS: Record<string, string>
export function screenFromPath(pathname: string): Screen | LandingScreen | null
export function languageFromPath(pathname: string): 'fr' | 'en' | null
export function appBasePath(pathname: string): string
export function routePath(screen: Screen | LandingScreen): string
export function routeSegments(): string[]
