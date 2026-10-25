import { describe, expect, it } from 'vitest'
import { closeSquare, componentMask, fillSmallHoles, labelComponents, openSquare, toOdd } from './components'
import type { BinaryImage } from './types'

function image(rows: string[]): BinaryImage {
  const height = rows.length
  const width = (rows[0] as string).length
  const data = new Uint8Array(width * height)
  rows.forEach((row, y) => [...row].forEach((char, x) => (data[y * width + x] = char === '#' ? 1 : 0)))
  return { width, height, data }
}

function rowsOf(picture: BinaryImage): string[] {
  const rows: string[] = []
  for (let y = 0; y < picture.height; y++) rows.push([...picture.data.subarray(y * picture.width, (y + 1) * picture.width)].map((v) => (v ? '#' : '.')).join(''))
  return rows
}

describe('labelComponents', () => {
  it('separates blobs and honours the connectivity', () => {
    const picture = image(['##....', '##..#.', '...#..', '......'])
    expect(labelComponents(picture, 1, true).components).toHaveLength(2)
    expect(labelComponents(picture, 1, false).components).toHaveLength(3)
  })

  it('reports bounding boxes and areas', () => {
    const { components } = labelComponents(image(['.....', '.###.', '.#...']), 1, true)
    expect(components[0]).toMatchObject({ x0: 1, y0: 1, x1: 3, y1: 2, area: 4 })
  })
})

describe('fillSmallHoles', () => {
  const ring = ['.......', '.#####.', '.#...#.', '.#...#.', '.#####.', '.......']

  it('fills an enclosed pocket but not the background', () => {
    const filled = rowsOf(fillSmallHoles(image(ring), 20))
    expect(filled[2]).toBe('.#####.')
    expect(filled[0]).toBe('.......')
  })

  it('leaves pockets that are too big or vetoed', () => {
    expect(rowsOf(fillSmallHoles(image(ring), 4))[2]).toBe('.#...#.')
    expect(rowsOf(fillSmallHoles(image(ring), 20, () => true))[2]).toBe('.#...#.')
  })
})

describe('morphology', () => {
  it('opening removes strokes thinner than the element and keeps blobs', () => {
    const picture = image(['..........', '.###......', '.###.#####', '.###......', '..........'])
    const opened = rowsOf(openSquare(picture, 3))
    expect(opened[2]).toBe('.###......')
  })

  it('closing bridges small gaps', () => {
    const closed = rowsOf(closeSquare(image(['.........', '.##...##.', '.##...##.', '.##...##.', '.........']), 5))
    expect(closed[2]).toBe('.#######.')
  })

  it('toOdd rounds to an odd positive size', () => {
    expect(toOdd(4)).toBe(5)
    expect(toOdd(5)).toBe(5)
    expect(toOdd(0.2)).toBe(1)
  })
})

describe('componentMask', () => {
  it('crops one component, optionally against another image', () => {
    const picture = image(['.##..', '.#...', '...##'])
    const labelling = labelComponents(picture, 1, true)
    const first = labelling.components[0]
    if (!first) throw new Error('no component')
    expect(rowsOf(componentMask(labelling, 5, first))).toEqual(['##', '#.'])
    const half = image(['..#..', '.#...', '.....'])
    expect(rowsOf(componentMask(labelling, 5, first, half))).toEqual(['.#', '#.'])
  })
})
