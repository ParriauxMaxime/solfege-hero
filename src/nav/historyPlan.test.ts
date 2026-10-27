import { describe, expect, it } from 'vitest'
import { depthOf, ENTERING, insideState, planHistoryChange, screenKey, type HistoryAction } from './historyPlan'

/** Browser history reduced to what the app relies on: entries with a state and a screen key. */
class FakeHistory {
  entries: { key: string; state: unknown }[] = [{ key: 'home', state: null }]
  index = 0
  private entryKey: string | null = 'home'

  get depth(): number {
    return depthOf(this.entries[this.index]?.state) ?? 0
  }

  enterFromHome(route: string): void {
    this.entries.splice(this.index + 1, Infinity, { key: route, state: insideState(this.depth + 1) })
    this.index++
    this.entryKey = ENTERING
  }

  show(route: string, playing: boolean, userInitiated = true): HistoryAction {
    const target = screenKey(route, playing)
    const action = planHistoryChange({ entry: this.entryKey, target, userInitiated })
    if (action === 'push') {
      this.entries.splice(this.index + 1, Infinity, { key: target, state: insideState(this.depth + 1) })
      this.index++
    }
    this.entryKey = target
    return action
  }

  back(): string {
    this.index--
    const key = this.entries[this.index]?.key ?? 'home'
    this.show(key.split(':')[0] ?? key, false, false)
    return key
  }
}

describe('screenKey', () => {
  it('separates play from intro only where an intro exists', () => {
    expect(screenKey('learn', true)).toBe('learn:play')
    expect(screenKey('learn', false)).toBe('learn')
    expect(screenKey('series', true)).toBe('series')
  })
})

describe('depthOf', () => {
  it('reads entries pushed by the app only', () => {
    expect(depthOf(insideState(2))).toBe(2)
    expect(depthOf({ screen: 'inside' })).toBe(1)
    expect(depthOf(null)).toBeNull()
    expect(depthOf({ screen: 'other' })).toBeNull()
  })
})

describe('planHistoryChange', () => {
  it('only syncs the URL when not user-initiated, for home and before the first screen', () => {
    expect(planHistoryChange({ entry: 'learn', target: 'settings', userInitiated: false })).toBe('replace')
    expect(planHistoryChange({ entry: 'learn', target: 'home', userInitiated: true })).toBe('replace')
    expect(planHistoryChange({ entry: null, target: 'learn', userInitiated: true })).toBe('replace')
    expect(planHistoryChange({ entry: ENTERING, target: 'learn', userInitiated: true })).toBe('replace')
  })

  it('pushes a change of screen and ignores a redraw', () => {
    expect(planHistoryChange({ entry: 'learn', target: 'learn:play', userInitiated: true })).toBe('push')
    expect(planHistoryChange({ entry: 'learn:play', target: 'learn:play', userInitiated: true })).toBe('none')
  })
})

describe('history stack', () => {
  it('counts every screen change and goes back one screen at a time', () => {
    const history = new FakeHistory()
    history.enterFromHome('learn')
    expect(history.show('learn', false)).toBe('replace')
    expect(history.show('learn', true)).toBe('push')
    expect(history.show('learn', true)).toBe('none')
    expect(history.show('settings', false)).toBe('push')
    expect(history.depth).toBe(3)

    expect(history.back()).toBe('learn:play')
    expect(history.back()).toBe('learn')
    expect(history.back()).toBe('home')
    expect(history.depth).toBe(0)
  })

  it('a back from the play screen lands on the intro, not on home', () => {
    const history = new FakeHistory()
    history.enterFromHome('keys')
    history.show('keys', false)
    history.show('keys', true)
    expect(history.back()).toBe('keys')
    expect(history.depth).toBe(1)
  })

  it('a mode that starts playing straight away takes a single entry', () => {
    const history = new FakeHistory()
    history.enterFromHome('series')
    expect(history.show('series', true)).toBe('replace')
    expect(history.show('series', true)).toBe('none')
    expect(history.depth).toBe(1)
  })

  it('a new screen after going back drops the forward entries', () => {
    const history = new FakeHistory()
    history.enterFromHome('learn')
    history.show('learn', false)
    history.show('settings', false)
    history.back()
    expect(history.show('learn', true)).toBe('push')
    expect(history.entries.map((entry) => entry.key)).toEqual(['home', 'learn', 'learn:play'])
  })
})
