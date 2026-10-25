import { specBeats } from '../hero/meter'
import type { NoteSpec } from '../hero/types'
import type { Clef } from '../music/notes'
import { pitchOfStep } from './pitch'
import type { MeasureAccidentals } from './pitch'
import type { StaffEvent } from './reader'
import type { Box } from './types'

export interface ReadNote {
  spec: NoteSpec
  /** 0..1 before the measure check. */
  quality: number
  /** Box in crop coordinates. */
  box: Box
  /** Index of the measure within the staff. */
  measure: number
}

export interface ReadStaff {
  notes: ReadNote[]
  /** Written length in quarter notes of every measure of the staff, in order. */
  measureBeats: number[]
}

/** Turns the time-ordered symbols of one staff into note specs; bar lines close measures and reset accidentals. */
export function assembleStaff(events: StaffEvent[], clef: Clef, fifths: number): ReadStaff {
  const notes: ReadNote[] = []
  const measureBeats: number[] = [0]
  let standing: MeasureAccidentals = new Map()
  for (const event of events) {
    if (event.kind === 'bar') {
      if ((measureBeats[measureBeats.length - 1] as number) > 0) measureBeats.push(0)
      standing = new Map()
      continue
    }
    const spec: NoteSpec =
      event.kind === 'rest'
        ? { pitch: null, duration: event.duration, ...(event.dots ? { dots: event.dots } : {}) }
        : { pitch: pitchOfStep(event.step, clef, fifths, event.accidental, standing), duration: event.duration, ...(event.dots ? { dots: event.dots } : {}) }
    notes.push({ spec, quality: event.quality, box: event.box, measure: measureBeats.length - 1 })
    measureBeats[measureBeats.length - 1] = (measureBeats[measureBeats.length - 1] as number) + specBeats(spec)
  }
  if (measureBeats[measureBeats.length - 1] === 0) measureBeats.pop()
  return { notes, measureBeats }
}
