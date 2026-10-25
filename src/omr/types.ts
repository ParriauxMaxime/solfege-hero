import type { ImportResult } from '../music/musicxml'

export interface GrayImage {
  width: number
  height: number
  data: Uint8Array
}

/** One byte per pixel, 1 = ink. */
export interface BinaryImage {
  width: number
  height: number
  data: Uint8Array
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export type OmrStage = 'preprocess' | 'staves' | 'symbols' | 'music'

export const OMR_STAGES: readonly OmrStage[] = ['preprocess', 'staves', 'symbols', 'music']

export interface OmrMeasure {
  /** The notes of the measure are `score.notes` from `startNote` up to `endNote` excluded. */
  startNote: number
  endNote: number
  /** The written values do not add up to the time signature. */
  uncertain: boolean
}

export interface OmrStaffReport {
  system: number
  /** Bounding box of the staff in source-image pixels. */
  box: Box
  /** Notes read on this staff, as indexes of `score.notes`, with their box in source-image pixels. */
  notes: { index: number; box: Box }[]
}

export interface OmrResult {
  score: ImportResult['score']
  warnings: string[]
  /** 0..1 per entry of `score.notes`. */
  confidence: number[]
  measures: OmrMeasure[]
  staves: OmrStaffReport[]
  systems: number
  staffIndexInSystem: number
  timings: Record<OmrStage, number>
}

/** Message to the OMR worker: the gray page, whose buffer is transferred, not copied. */
export interface OmrWorkerRequest {
  image: GrayImage
  staffIndexInSystem?: number
}

export type OmrWorkerMessage =
  | { type: 'progress'; stage: OmrStage; percent: number }
  | { type: 'done'; result: OmrResult }
  | { type: 'error'; message: string }

export interface RecognizeOptions {
  /** Staff kept in every system, 0 = top. */
  staffIndexInSystem?: number
  onProgress?: (stage: OmrStage, fraction: number) => void
}
