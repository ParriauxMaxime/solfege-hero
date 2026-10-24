import { describe, expect, it } from 'vitest'
import { pianoLayout } from './keyboardLayout'

describe('pianoLayout', () => {
  it('lays out one octave Do to Si', () => {
    const { keys, columns } = pianoLayout(1)
    expect(keys.map((key) => key.pitchClass)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(columns).toBe(14)
    expect(keys.filter((key) => key.natural)).toHaveLength(7)
  })

  it('places altered keys between their neighbouring naturals', () => {
    const { keys } = pianoLayout(1)
    expect(keys.map((key) => key.column)).toEqual([1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13])
  })

  it('starts the one and a half octave span on Sol with 18 keys', () => {
    const { keys, columns } = pianoLayout(1.5)
    expect(keys).toHaveLength(18)
    expect(keys[0]).toMatchObject({ pitchClass: 7, natural: true, column: 1 })
    expect(columns).toBe(22)
  })

  it('repeats the octave twice for two octaves', () => {
    const { keys, columns } = pianoLayout(2)
    expect(keys).toHaveLength(24)
    expect(columns).toBe(28)
    expect(keys.slice(12).map((key) => key.pitchClass)).toEqual(keys.slice(0, 12).map((key) => key.pitchClass))
    expect(keys[12]?.column).toBe(15)
  })
})
