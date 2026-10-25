import type { Stem } from './stems'
import type { BinaryImage, Box } from './types'

interface Erasable {
  headBox: Box
  stem: Stem | null
}

const STEM_HALF_WIDTH = 2
const BEAM_MIN_LENGTH_UNITS = 1.1
const BEAM_MIN_THICKNESS_UNITS = 0.2
const BEAM_REACH_UNITS = 1.3
const BEAM_ANCHOR_PIXELS = 2

function erase(image: BinaryImage, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(image.height - 1, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(image.width - 1, Math.ceil(x1)); x++) image.data[y * image.width + x] = 0
  }
}

/** Thick, long horizontal strokes hanging off the free end of a stem; rest blocks and ties stay. */
function eraseBeams(image: BinaryImage, unit: number, stems: Stem[]): void {
  const { width, height, data } = image
  const keep = data.slice()
  const minLength = unit * BEAM_MIN_LENGTH_UNITS
  const minThickness = unit * BEAM_MIN_THICKNESS_UNITS
  for (let y = 0; y < height; y++) {
    const anchors = stems.filter((stem) => Math.abs(stem.tip - y) <= unit * BEAM_REACH_UNITS)
    if (anchors.length === 0) continue
    let x = 0
    while (x < width) {
      if (!keep[y * width + x]) {
        x++
        continue
      }
      const start = x
      while (x < width && keep[y * width + x]) x++
      if (x - start < minLength || !anchors.some((stem) => stem.x >= start - BEAM_ANCHOR_PIXELS && stem.x <= x + BEAM_ANCHOR_PIXELS)) continue
      const middle = Math.floor((start + x) / 2)
      let up = y
      while (up > 0 && keep[(up - 1) * width + middle]) up--
      let down = y
      while (down < height - 1 && keep[(down + 1) * width + middle]) down++
      if (down - up + 1 >= minThickness) for (let k = start; k < x; k++) data[y * width + k] = 0
    }
  }
}

/** The ink of a staff without note heads, stems and beams: what is left are accidentals, rests, clefs and stray marks. */
export function withoutNotes(clean: BinaryImage, unit: number, notes: Erasable[]): BinaryImage {
  const image = { width: clean.width, height: clean.height, data: clean.data.slice() }
  for (const { headBox, stem } of notes) {
    erase(image, headBox.x, headBox.y, headBox.x + headBox.width, headBox.y + headBox.height)
    if (stem) erase(image, stem.x - STEM_HALF_WIDTH, Math.min(stem.tip, headBox.y), stem.x + STEM_HALF_WIDTH, Math.max(stem.tip, headBox.y + headBox.height))
  }
  eraseBeams(
    image,
    unit,
    notes.flatMap(({ stem }) => (stem ? [stem] : [])),
  )
  return image
}
