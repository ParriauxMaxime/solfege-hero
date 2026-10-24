import type { Duration, Melody, NoteSpec } from '../hero/types'
import { midi, type Letter } from './notes'

const DURATION_BY_SYMBOL: Record<string, Duration> = {
  w: 'whole',
  h: 'half',
  q: 'quarter',
  e: 'eighth',
  s: 'sixteenth',
}

const OCTAVE = 12
const D_MAJOR_SHIFT = 2
const F_MAJOR_SHIFT = 5
const TOKEN = /^(?:([A-G])([#b]?)(\d)|(R))([whqes])(\.?)$/
const ALTER_BY_SIGN: Record<string, number> = { '': 0, '#': 1, b: -1 }

/**
 * Notes read like "C4q": letter, optional # or b, octave, then w/h/q/e/s for whole/half/quarter/eighth/sixteenth,
 * and a trailing "." for a dotted value. "Rq" is a rest; "|" marks bars.
 */
function score(source: string, semitoneShift = 0): NoteSpec[] {
  return source
    .split(/\s+/)
    .filter((token) => token !== '' && token !== '|')
    .map((token) => {
      const [, letter, sign, octave, rest, symbol, dot] = TOKEN.exec(token) ?? []
      const duration = DURATION_BY_SYMBOL[symbol ?? '']
      if (!duration || !(rest || (letter && octave))) throw new Error(`Invalid melody token: ${token}`)
      const dots = dot ? { dots: 1 } : {}
      if (rest) return { pitch: null, duration, ...dots }
      const natural = midi({ letter: letter as Letter, octave: Number(octave), alter: 0 })
      return { pitch: natural + (ALTER_BY_SIGN[sign ?? ''] as number) + semitoneShift, duration, ...dots }
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

const MENUET_EN_SOL = `
  D5q G4e A4e B4e C5e | D5q G4q G4q | E5q C5e D5e E5e F#5e | G5q G4q G4q |
  C5q D5e C5e B4e A4e | B4q C5e B4e A4e G4e | F#4q G4e A4e B4e G4e | A4h.`

const AH_VOUS_DIRAI_JE = `
  C4q C4q | G4q G4q | A4q A4q | G4h | F4q F4q | E4q E4q | D4q D4q | C4h |
  G4q G4q | F4q F4q | E4q E4q | D4h`

const TWINKLE_TWINKLE = `
  D4q D4q A4q A4q | B4q B4q A4h | G4q G4q F#4q F#4q | E4q E4q D4h |
  A4q A4q G4q G4q | F#4q F#4q E4h | A4q A4q G4q G4q | F#4q F#4q E4h |
  D4q D4q A4q A4q | B4q B4q A4h | G4q G4q F#4q F#4q | E4q E4q D4h`

const GREENSLEEVES = `
  Rq Rq Re A4e | C5q D5e E5q F5e | E5q D5e B4q G4e | A4q B4e C5q A4e |
  A4q G#4e A4q B4e | G#4q. E4q. | Rq Rq Re A4e | C5q D5e E5q F5e`

const FUR_ELISE = `
  Rq E5s D#5s | E5s D#5s E5s B4s D5s C5s | A4e Rs C4s E4s A4s | B4e Rs E4s G#4s B4s |
  C5e Rs E4s E5s D#5s | E5s D#5s E5s B4s D5s C5s | A4e Rs C4s E4s A4s | B4e Rs E4s C5s B4s`

const CANON_DE_PACHELBEL = `
  F#5h E5h | D5h C#5h | B4h A4h | B4h C#5h |
  F#5q E5q D5q C#5q | B4q A4q B4q C#5q | D5q C#5q B4q A4q | G4q F#4q G4q A4q`

const AMAZING_GRACE = `
  Rh D4q | G4h B4e G4e | B4h A4q | G4h E4q | D4h.`

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
  {
    name: 'Menuet en sol (Bach)',
    clef: 'treble',
    key: 1,
    tempo: 108,
    timeSignature: { beats: 3, beatType: 4 },
    notes: score(MENUET_EN_SOL),
  },
  {
    name: 'Ah ! vous dirai-je, maman',
    clef: 'treble',
    key: 0,
    tempo: 108,
    timeSignature: { beats: 2, beatType: 4 },
    notes: score(AH_VOUS_DIRAI_JE, OCTAVE),
  },
  {
    name: 'Twinkle Twinkle Little Star',
    clef: 'treble',
    key: 2,
    tempo: 100,
    notes: score(TWINKLE_TWINKLE),
  },
  {
    name: 'Greensleeves',
    clef: 'treble',
    key: 0,
    tempo: 100,
    timeSignature: { beats: 6, beatType: 8 },
    notes: score(GREENSLEEVES),
  },
  {
    name: 'Lettre à Élise (Beethoven)',
    clef: 'treble',
    key: 0,
    tempo: 66,
    timeSignature: { beats: 3, beatType: 8 },
    notes: score(FUR_ELISE),
  },
  {
    name: 'Canon (Pachelbel)',
    clef: 'treble',
    key: 2,
    tempo: 72,
    notes: score(CANON_DE_PACHELBEL),
  },
  {
    name: 'Amazing Grace',
    clef: 'treble',
    key: 1,
    tempo: 84,
    timeSignature: { beats: 3, beatType: 4 },
    notes: score(AMAZING_GRACE),
  },
]
