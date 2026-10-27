export type HistoryAction = 'push' | 'replace' | 'none'

/** Marks the entry the app has just pushed from home, before the first screen of that route is shown. */
export const ENTERING = 'entering'

const ROUTES_WITH_INTRO: readonly string[] = ['learn', 'keys', 'dictation', 'hero', 'scores']

export interface InsideState {
  screen: 'inside'
  depth: number
}

/** The play screen of a route with an intro is its own history entry; the others open straight into play. */
export function screenKey(route: string, playing: boolean): string {
  return playing && ROUTES_WITH_INTRO.includes(route) ? `${route}:play` : route
}

export function insideState(depth: number): InsideState {
  return { screen: 'inside', depth }
}

/** Depth of an entry pushed by the app (1 = first screen after home); null for any other entry. */
export function depthOf(state: unknown): number | null {
  if (typeof state !== 'object' || state === null) return null
  const { screen, depth } = state as Partial<InsideState>
  return screen === 'inside' ? (typeof depth === 'number' ? depth : 1) : null
}

export interface HistoryChange {
  /** Screen key of the current history entry, `ENTERING` right after the push from home, null before the first screen. */
  entry: string | null
  target: string
  userInitiated: boolean
}

/** Each user-initiated move to another screen is a history entry (Cloudflare counts pushState only); back, boot and home only sync the URL. */
export function planHistoryChange({ entry, target, userInitiated }: HistoryChange): HistoryAction {
  if (!userInitiated || target === 'home' || entry === null || entry === ENTERING) return 'replace'
  return entry === target ? 'none' : 'push'
}
