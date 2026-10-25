import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Melody } from '../hero/types'
import { noteAccuracy } from './accuracy'
import { rotateGray } from './image'
import { recognize } from './recognize'
import { readPng } from './testing/png'

type Truth = Pick<Melody, 'name' | 'clef' | 'key' | 'timeSignature' | 'notes'>

const CLEAN = ['frere-jacques', 'frere-jacques-fa', 'ode-a-la-joie', 'claire-fontaine', 'menuet-en-sol', 'greensleeves', 'lettre-a-elise', 'amazing-grace']
const DEGRADED = ['menuet-en-sol-degraded', 'amazing-grace-degraded']

const CLEAN_AVERAGE_FLOOR = 0.97
const DEGRADED_FLOOR = 0.9

function evaluate(slug: string) {
  const fixture = (extension: string) => new URL(`./fixtures/${slug}.${extension}`, import.meta.url)
  const truth = JSON.parse(readFileSync(fixture('json'), 'utf8')) as Truth
  const image = readPng(fixture('png'))
  const started = performance.now()
  const result = recognize(image)
  const milliseconds = performance.now() - started
  return { slug, truth, result, milliseconds, accuracy: noteAccuracy(truth.notes, result.score.notes) }
}

const clean = CLEAN.map(evaluate)
const degraded = DEGRADED.map(evaluate)

describe('fixture accuracy', () => {
  it('prints the table', () => {
    const rows = [...clean, ...degraded].map(({ slug, truth, result, milliseconds, accuracy }) => ({
      fixture: slug,
      notes: truth.notes.length,
      read: result.score.notes.length,
      accuracy: `${(accuracy * 100).toFixed(1)} %`,
      ms: Math.round(milliseconds),
      warnings: result.warnings.length,
    }))
    console.table(rows)
    expect(rows).toHaveLength(CLEAN.length + DEGRADED.length)
  })

  it('reads clean fixtures at 97 % on average, none below 90 %', () => {
    const average = clean.reduce((sum, row) => sum + row.accuracy, 0) / clean.length
    expect(average).toBeGreaterThanOrEqual(CLEAN_AVERAGE_FLOOR)
    for (const row of clean) expect(row.accuracy, row.slug).toBeGreaterThanOrEqual(DEGRADED_FLOOR)
  })

  it('reads the rotated, blurred and noisy fixtures at 90 % or better', () => {
    for (const row of degraded) expect(row.accuracy, row.slug).toBeGreaterThanOrEqual(DEGRADED_FLOOR)
  })

  it('survives a tilt, grain and uneven lighting added to a clean fixture', () => {
    const slug = 'ode-a-la-joie'
    const truth = (clean.find((row) => row.slug === slug) as (typeof clean)[number]).truth
    const base = readPng(new URL(`./fixtures/${slug}.png`, import.meta.url))
    let seed = 7
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    const tilted = rotateGray(base, (-4 * Math.PI) / 180)
    const grainy = {
      ...tilted,
      data: Uint8Array.from(tilted.data, (value, i) => {
        const shade = 1 - 0.4 * ((i % tilted.width) / tilted.width)
        return Math.max(0, Math.min(255, value * shade + (random() + random() + random() - 1.5) * 60))
      }),
    }
    expect(noteAccuracy(truth.notes, recognize(grainy).score.notes)).toBeGreaterThanOrEqual(DEGRADED_FLOOR)
  })

  it.each(CLEAN)('recognises clef, key and time signature of %s', (slug) => {
    const row = clean.find((candidate) => candidate.slug === slug)
    if (!row) throw new Error('missing fixture')
    expect(row.result.score.clef).toBe(row.truth.clef)
    expect(row.result.score.key).toBe(row.truth.key)
    expect(row.result.score.timeSignature).toEqual(row.truth.timeSignature)
    expect(row.result.score.name).toBe('Partition importée')
    expect(row.result.score.tempo).toBe(80)
  })

  it('keeps one confidence per note and one measure span per bar', () => {
    for (const row of [...clean, ...degraded]) {
      const { score, confidence, measures } = row.result
      expect(confidence).toHaveLength(score.notes.length)
      expect(confidence.every((value) => value >= 0 && value <= 1)).toBe(true)
      expect(measures.at(-1)?.endNote).toBe(score.notes.length)
    }
  })

  it('reports the staves of the source image with a box for every note', () => {
    for (const row of degraded) {
      const { staves, score } = row.result
      expect(staves.length).toBeGreaterThan(0)
      expect(staves.reduce((count, staff) => count + staff.notes.length, 0)).toBe(score.notes.length)
      for (const staff of staves) {
        expect(staff.box.x).toBeGreaterThanOrEqual(-5)
        for (const { box } of staff.notes) expect(box.y).toBeGreaterThan(staff.box.y - 30)
      }
    }
  })
})
