import { COMMON_TIME } from '../../src/hero/types'
import { MELODIES } from '../../src/music/melodies'
import { parseMusicXml } from '../../src/music/musicxml'
import { toMusicXml } from '../../src/music/musicxmlExport'
import { renderSheet } from '../../src/ui/sheet'

const PAGE_WIDTH = 1600
const ROTATION_DEGREES = 2
const ROTATION_ZOOM = 1.04
const BLUR = '0.8px'
const PAPER_TINT = 'rgb(236, 233, 226)'
const NOISE_SIGMA = 7
const NOISE_QUANTUM = 4

interface Truth {
  name: string
  clef: string
  key: number
  timeSignature: { beats: number; beatType: number }
  notes: unknown[]
}

function gaussianish(random: () => number): number {
  return (random() + random() + random() + random() - 2) * 1.73
}

function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = source
  })
}

/** Melody -> MusicXML -> parsed score -> rendered page, the same path the OMR output is compared against. */
function showFixture(name: string, systemsPerPage?: number): { truth: Truth; width: number; height: number; pageHeight: number } {
  const melody = MELODIES.find((candidate) => candidate.name === name)
  if (!melody) throw new Error(`Unknown melody: ${name}`)
  const { score } = parseMusicXml(toMusicXml({ ...melody, timeSignature: melody.timeSignature ?? COMMON_TIME }))
  const sheet = renderSheet(score, { width: PAGE_WIDTH, systemsPerPage, ink: '#000', background: '#fff' })
  document.body.replaceChildren(sheet.svg)
  const height = Number(sheet.svg.getAttribute('height'))
  const truth: Truth = { name, clef: score.clef, key: score.key, timeSignature: score.timeSignature, notes: score.notes }
  return { truth, width: PAGE_WIDTH, height, pageHeight: sheet.pageHeight }
}

async function degrade(pngDataUrl: string): Promise<string> {
  const image = await loadImage(pngDataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.filter = `blur(${BLUR})`
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate((ROTATION_DEGREES * Math.PI) / 180)
  context.scale(ROTATION_ZOOM, ROTATION_ZOOM)
  context.drawImage(image, -canvas.width / 2, -canvas.height / 2)
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.filter = 'none'
  context.globalCompositeOperation = 'multiply'
  context.fillStyle = PAPER_TINT
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.globalCompositeOperation = 'source-over'

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  const random = seededRandom(7)
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const noise = Math.round((gaussianish(random) * NOISE_SIGMA) / NOISE_QUANTUM) * NOISE_QUANTUM
    for (let channel = 0; channel < 3; channel++) {
      pixels.data[offset + channel] = Math.max(0, Math.min(255, (pixels.data[offset + channel] as number) + noise))
    }
  }
  context.putImageData(pixels, 0, 0)
  return canvas.toDataURL('image/png')
}

Object.assign(window, { showFixture, degrade })
