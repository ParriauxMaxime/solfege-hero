import { describe, expect, it } from 'vitest'
import { clefTipAfterLevelChange, survivalDelayAfterLevelChange } from './transition'

describe('survivalDelayAfterLevelChange', () => {
  it('moves to the new default when the default changes', () => {
    expect(survivalDelayAfterLevelChange(45, 50, 5)).toBe(3)
    expect(survivalDelayAfterLevelChange(50, 45, 3)).toBe(5)
    expect(survivalDelayAfterLevelChange(100, 0, 3)).toBe(5)
  })

  it('keeps the player choice when the default is the same', () => {
    expect(survivalDelayAfterLevelChange(10, 20, 3)).toBe(3)
    expect(survivalDelayAfterLevelChange(60, 65, 5)).toBe(5)
  })
})

describe('clefTipAfterLevelChange', () => {
  it('suggests the bass clef when crossing 50 upward', () => {
    expect(clefTipAfterLevelChange(45, 50, ['treble'], [])).toBe('bass')
    expect(clefTipAfterLevelChange(45, 60, ['treble'], [])).toBe('bass')
  })

  it('suggests the alto clef when crossing 80 upward', () => {
    expect(clefTipAfterLevelChange(75, 80, ['treble', 'bass'], ['bass'])).toBe('alto')
  })

  it('suggests one clef at a time, bass first', () => {
    expect(clefTipAfterLevelChange(10, 90, ['treble'], [])).toBe('bass')
  })

  it('stays silent when moving down, within a tier, or already shown or played', () => {
    expect(clefTipAfterLevelChange(60, 45, ['treble'], [])).toBeNull()
    expect(clefTipAfterLevelChange(50, 55, ['treble'], [])).toBeNull()
    expect(clefTipAfterLevelChange(45, 50, ['treble'], ['bass'])).toBeNull()
    expect(clefTipAfterLevelChange(45, 50, ['treble', 'bass'], [])).toBeNull()
  })
})
