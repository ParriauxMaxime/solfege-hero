import type { Duration, Melody, NoteSpec } from '../hero/types'
import { midi, type Letter } from './notes'

const DURATION_BY_SYMBOL: Record<string, Duration> = {
  w: 'whole',
  h: 'half',
  q: 'quarter',
  e: 'eighth',
}

const OCTAVE = 12
const D_MAJOR_SHIFT = 2
const F_MAJOR_SHIFT = 5
const TOKEN = /^([A-G])(\d)([whqe])$/

/** Notes read like "C4q": letter, octave, then w/h/q/e for whole/half/quarter/eighth; "|" marks bars. */
function score(source: string, semitoneShift = 0): NoteSpec[] {
  return source
    .split(/\s+/)
    .filter((token) => token !== '' && token !== '|')
    .map((token) => {
      const [, letter, octave, symbol] = TOKEN.exec(token) ?? []
      const duration = DURATION_BY_SYMBOL[symbol ?? '']
      if (!letter || !octave || !duration) throw new Error(`Invalid melody token: ${token}`)
      const pitch = midi({ letter: letter as Letter, octave: Number(octave), alter: 0 })
      return { pitch: pitch + semitoneShift, duration }
    })
}

const FRERE_JACQUES = `
  C4q D4q E4q C4q | C4q D4q E4q C4q | E4q F4q G4h | E4q F4q G4h |
  G4e A4e G4e F4e E4q C4q | G4e A4e G4e F4e E4q C4q | C4q G3q C4h | C4q G3q C4h`

const AU_CLAIR_DE_LA_LUNE = `
  C4q C4q C4q D4q | E4h D4h | C4q E4q D4q D4q | C4w |
  C4q C4q C4q D4q | E4h D4h | C4q E4q D4q D4q | C4w |
  D4q D4q D4q D4q | A3h A3h | D4q C4q B3q A3q | G3w |
  C4q C4q C4q D4q | E4h D4h | C4q E4q D4q D4q | C4w`

const ODE_A_LA_JOIE = `
  E4q E4q F4q G4q | G4q F4q E4q D4q | C4q C4q D4q E4q | E4q D4q D4h |
  E4q E4q F4q G4q | G4q F4q E4q D4q | C4q C4q D4q E4q | D4q C4q C4h |
  D4q D4q E4q C4q | D4q E4e F4e E4q C4q | D4q E4e F4e E4q D4q | C4q D4q G3h |
  E4q E4q F4q G4q | G4q F4q E4q D4q | C4q C4q D4q E4q | D4q C4q C4h`

const A_LA_CLAIRE_FONTAINE = `
  F4q F4e A4e A4e G4e A4e G4e | F4q F4e A4e A4e G4e A4q |
  A4q A4e G4e F4e A4e C5e A4e | C5q C5e A4e F4e A4e G4q |
  F4q F4e A4e A4e G4e A4e F4e | A4q A4e G4e A4e G4e F4q`

const VIVE_LE_VENT = `
  E4q E4q E4h | E4q E4q E4h | E4q G4q C4q D4q | E4w |
  F4q F4q F4q F4q | F4q E4q E4q E4e E4e | E4q D4q D4q E4q | D4h G4h`

export const MELODIES: Melody[] = [
  { name: 'Frère Jacques', clef: 'treble', key: 0, tempo: 72, notes: score(FRERE_JACQUES, OCTAVE) },
  {
    name: 'Frère Jacques (clé de fa)',
    clef: 'bass',
    key: 0,
    tempo: 72,
    notes: score(FRERE_JACQUES, -OCTAVE),
  },
  {
    name: 'Au clair de la lune',
    clef: 'treble',
    key: 0,
    tempo: 72,
    notes: score(AU_CLAIR_DE_LA_LUNE, OCTAVE),
  },
  {
    name: 'Ode à la joie',
    clef: 'treble',
    key: 2,
    tempo: 84,
    notes: score(ODE_A_LA_JOIE, OCTAVE + D_MAJOR_SHIFT),
  },
  {
    name: 'À la claire fontaine',
    clef: 'treble',
    key: -1,
    tempo: 80,
    notes: score(A_LA_CLAIRE_FONTAINE),
  },
  {
    name: 'Vive le vent',
    clef: 'treble',
    key: -1,
    tempo: 96,
    notes: score(VIVE_LE_VENT, F_MAJOR_SHIFT),
  },
]
