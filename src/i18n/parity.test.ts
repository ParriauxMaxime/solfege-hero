import { describe, expect, it } from 'vitest'
import { en } from './en'
import { fr } from './fr'
import { placeholderNames } from './message'

function leaves(node: unknown, path = ''): Map<string, string> {
  const found = new Map<string, string>()
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const next = path ? `${path}.${key}` : key
    if (typeof value === 'string') found.set(next, value)
    else for (const [leafPath, leaf] of leaves(value, next)) found.set(leafPath, leaf)
  }
  return found
}

const frLeaves = leaves(fr)
const enLeaves = leaves(en)

describe('fr / en parity', () => {
  it('has the same keys in both directions', () => {
    expect([...enLeaves.keys()].filter((key) => !frLeaves.has(key))).toEqual([])
    expect([...frLeaves.keys()].filter((key) => !enLeaves.has(key))).toEqual([])
  })

  it('has no empty en string unless fr is empty too', () => {
    const empty = [...enLeaves].filter(([key, value]) => value === '' && frLeaves.get(key) !== '')
    expect(empty).toEqual([])
  })

  it('uses the same parameters in both languages and valid plural syntax', () => {
    for (const [key, frText] of frLeaves) {
      const enText = enLeaves.get(key) ?? ''
      expect(placeholderNames(enText), key).toEqual(placeholderNames(frText))
    }
  })
})
