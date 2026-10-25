import { describe, expect, it } from 'vitest'
import { parseMusicXml } from '../music/musicxml'
import { catalogueUrl, fetchCatalogueIndex, parseCatalogueIndex, withoutCatalogued } from './catalogue'

describe('parseCatalogueIndex', () => {
  it('keeps valid entries and drops the rest', () => {
    const entries = parseCatalogueIndex([
      { file: 'a.musicxml', title: ' A ', composer: 'Bach' },
      { file: 'a.musicxml', title: 'Doublon' },
      { file: '../secret.musicxml', title: 'Évasion' },
      { file: 'dir/b.xml', title: 'Sous-dossier' },
      { file: 'c.mxl', title: 'Zippée' },
      { file: 'd.xml', title: '' },
      { file: 'e.xml', title: 'E', composer: 3 },
      null,
      'texte',
    ])
    expect(entries).toEqual([
      { file: 'a.musicxml', title: 'A', composer: 'Bach' },
      { file: 'e.xml', title: 'E' },
    ])
  })

  it('returns nothing for a non-array', () => {
    expect(parseCatalogueIndex({ file: 'a.xml' })).toEqual([])
    expect(parseCatalogueIndex(undefined)).toEqual([])
  })
})

describe('withoutCatalogued', () => {
  const builtins = [{ name: 'Greensleeves' }, { name: 'Vive le vent' }]

  it('hides built-ins that a catalogue entry replaces', () => {
    expect(withoutCatalogued(builtins, [{ file: 'a.xml', title: ' greensleeves ' }])).toEqual([{ name: 'Vive le vent' }])
  })

  it('keeps every built-in when the catalogue is empty', () => {
    expect(withoutCatalogued(builtins, [])).toEqual(builtins)
  })
})

describe('catalogueUrl', () => {
  it('works with relative and absolute bases', () => {
    expect(catalogueUrl('./', 'index.json')).toBe('./scores/index.json')
    expect(catalogueUrl('/solfege-hero/', 'Mon air.xml')).toBe('/solfege-hero/scores/Mon%20air.xml')
    expect(catalogueUrl('/x', 'a.xml')).toBe('/x/scores/a.xml')
  })
})

describe('fetchCatalogueIndex', () => {
  it('is silent on network failure and on bad responses', async () => {
    const failing = (() => Promise.reject(new Error('offline'))) as typeof fetch
    const missing = (() => Promise.resolve(new Response('', { status: 404 }))) as typeof fetch
    const garbled = (() => Promise.resolve(new Response('<html>'))) as typeof fetch
    expect(await fetchCatalogueIndex('./', failing)).toEqual([])
    expect(await fetchCatalogueIndex('./', missing)).toEqual([])
    expect(await fetchCatalogueIndex('./', garbled)).toEqual([])
  })

  it('parses a good response', async () => {
    const good = (() => Promise.resolve(Response.json([{ file: 'a.xml', title: 'A' }]))) as typeof fetch
    expect(await fetchCatalogueIndex('./', good)).toEqual([{ file: 'a.xml', title: 'A' }])
  })
})

describe('public/scores', () => {
  const sources = import.meta.glob<string>('../../public/scores/*.{musicxml,xml}', {
    query: '?raw',
    import: 'default',
    eager: true,
  })
  const files = Object.entries(sources)

  it('contains scores', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s parses with notes', (_file, xml) => {
    const { score } = parseMusicXml(xml)
    expect(score.notes.some((note) => note.pitch !== null)).toBe(true)
  })
})
