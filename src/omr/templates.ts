import {
  ACCIDENTAL_BAR_WIDTH,
  ACCIDENTAL_SHAPES,
  ACCIDENTAL_STEM_WIDTH,
  FLAGGED_REST_BALL,
  FLAGGED_REST_FLAG_SHIFT,
  FLAGGED_REST_STEMS,
  FLAT_PATH,
  FLAT_WIDTH,
  QUARTER_REST_PATH,
  REST_FLAG_PATH,
  REST_STROKE_WIDTH,
} from '../ui/glyphs'
import { patchOfRaster } from './glyphMatch'
import type { Patch } from './glyphMatch'
import { rasterize, strokePath } from './rasterize'
import type { Shape } from './rasterize'

export type AccidentalKind = 'sharp' | 'flat' | 'natural'
export type PitchedRestKind = 'quarter' | 'eighth' | 'sixteenth'

export interface Template<T> {
  name: T
  patch: Patch
}

export const ACCIDENTAL_GRID = { columns: 10, rows: 20 }
export const REST_GRID = { columns: 10, rows: 20 }

const RASTER_SCALE = 4

function accidentalShapes(kind: AccidentalKind): Shape[] {
  if (kind === 'flat') return [strokePath(FLAT_PATH, FLAT_WIDTH)]
  const { stems, bars } = ACCIDENTAL_SHAPES[kind]
  return [
    ...stems.map((d) => strokePath(d, ACCIDENTAL_STEM_WIDTH)),
    ...bars.map((d) => strokePath(d, ACCIDENTAL_BAR_WIDTH)),
  ]
}

function restShapes(kind: PitchedRestKind): Shape[] {
  if (kind === 'quarter') return [strokePath(QUARTER_REST_PATH, REST_STROKE_WIDTH)]
  const flags = kind === 'eighth' ? 1 : 2
  const shapes: Shape[] = [strokePath(FLAGGED_REST_STEMS[flags - 1] as string, REST_STROKE_WIDTH)]
  for (let flag = 0; flag < flags; flag++) {
    const dx = flag * FLAGGED_REST_FLAG_SHIFT.x
    const dy = flag * FLAGGED_REST_FLAG_SHIFT.y
    shapes.push(
      strokePath(REST_FLAG_PATH, REST_STROKE_WIDTH, dx, dy),
      { kind: 'disc', cx: FLAGGED_REST_BALL.cx + dx, cy: FLAGGED_REST_BALL.cy + dy, radius: FLAGGED_REST_BALL.r },
    )
  }
  return shapes
}

let accidentalCache: Template<AccidentalKind>[] | null = null
let restCache: Template<PitchedRestKind>[] | null = null

export function accidentalTemplates(): Template<AccidentalKind>[] {
  accidentalCache ??= (['sharp', 'flat', 'natural'] as const).map((name) => ({
    name,
    patch: patchOfRaster(rasterize(accidentalShapes(name), RASTER_SCALE), ACCIDENTAL_GRID.columns, ACCIDENTAL_GRID.rows),
  }))
  return accidentalCache
}

export function restTemplates(): Template<PitchedRestKind>[] {
  restCache ??= (['quarter', 'eighth', 'sixteenth'] as const).map((name) => ({
    name,
    patch: patchOfRaster(rasterize(restShapes(name), RASTER_SCALE), REST_GRID.columns, REST_GRID.rows),
  }))
  return restCache
}
