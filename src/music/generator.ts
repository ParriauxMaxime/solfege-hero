import { barLength } from '../hero/meter'
import { COMMON_TIME, type Duration, type Melody, type NoteSpec, type TimeSignature } from '../hero/types'
import { seededRandom } from '../random'
import { pitchClass, pitchesInRange, type Clef } from './notes'

export type Difficulty = 1 | 2 | 3 | 4 | 5
export type Mode = 'major' | 'minor'

export interface GeneratorOptions {
  clef: Clef
  armures: boolean
  difficulty: Difficulty
  bars?: number
  key?: number
  time?: TimeSignature
  mode?: Mode
}

export type BarKind =
  | 'motif'
  | 'repeat'
  | 'sequence'
  | 'inversion'
  | 'retrograde'
  | 'run'
  | 'variation'
  | 'cadence'

export interface BarPlan {
  kind: BarKind
  /** Index of the earlier bar this one was derived from. */
  source: number | null
}

export interface GeneratedMelody {
  melody: Melody & { timeSignature: TimeSignature }
  plan: BarPlan[]
  mode: Mode
  /** Pitch class of the tonic. */
  tonic: number
}

const DEFAULT_BARS = 8
const PHRASE_BARS = 4
const MAX_ATTEMPTS = 80
const SEMITONES_PER_OCTAVE = 12
const DEGREES_PER_OCTAVE = 7
const TRITONE = 6
const MIN_MOTIF_NOTES = 3
const MAX_MOTIF_NOTES = 6
const MIN_RUN_NOTES = 4
const MAX_RUN_NOTES = 8
const MIN_REPEATED_SHARE = 0.5
const MAX_CHROMATIC_SHARE = 0.05
const CHROMATIC_CHANCE = 0.6
const MAJOR_CHANCE = 0.7
const WALTZ_CHANCE = 0.3
const TRIES_PER_KIND = 10

const SCALES: Record<Mode, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
}

/** Largest melodic interval in scale degrees: step, third, fourth, sixth, octave. */
const INTERVAL_CAP: Record<Difficulty, number> = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 7 }

/** Degrees the melody may use around the tonic; null means the whole clef range. */
const WINDOW: Record<Difficulty, readonly [number, number] | null> = {
  1: [0, 4],
  2: [-2, 5],
  3: [-3, 5],
  4: [-4, 7],
  5: null,
}

const KEY_WEIGHTS: readonly (readonly [number, number])[] = [
  [0, 5],
  [1, 4],
  [-1, 3],
  [2, 3],
  [-2, 1.5],
  [3, 1.5],
  [-3, 0.7],
  [4, 0.5],
  [-4, 0.3],
]

const WRITTEN: Record<number, Pick<NoteSpec, 'duration' | 'dots'>> = {
  4: { duration: 'whole' },
  3: { duration: 'half', dots: 1 },
  2: { duration: 'half' },
  1.5: { duration: 'quarter', dots: 1 },
  1: { duration: 'quarter' },
  0.5: { duration: 'eighth' },
  0.25: { duration: 'sixteenth' },
}

interface RhythmPattern {
  beats: readonly number[]
  from: Difficulty
  weight: number
  fits(position: number, length: number): boolean
}

const onBeat = (position: number) => Number.isInteger(position)

const RHYTHM_PATTERNS: readonly RhythmPattern[] = [
  { beats: [1], from: 1, weight: 6, fits: onBeat },
  { beats: [2], from: 1, weight: 2.5, fits: (p, length) => onBeat(p) && (p % 2 === 0 || length === 3) },
  { beats: [3], from: 2, weight: 0.8, fits: (p, length) => p === 0 && length >= 3 },
  { beats: [4], from: 2, weight: 0.6, fits: (p, length) => p === 0 && length >= 4 },
  { beats: [0.5, 0.5], from: 3, weight: 3, fits: onBeat },
  { beats: [1.5, 0.5], from: 4, weight: 1.5, fits: onBeat },
  { beats: [0.5, 1, 0.5], from: 5, weight: 1.2, fits: onBeat },
  { beats: [0.5, 0.25, 0.25], from: 5, weight: 0.9, fits: onBeat },
  { beats: [0.25, 0.25, 0.5], from: 5, weight: 0.7, fits: onBeat },
]

interface Bar {
  degrees: number[]
  beats: number[]
}

interface Context {
  random: () => number
  difficulty: Difficulty
  length: number
  cap: number
  min: number
  max: number
  midiOf: (degree: number) => number
  tonicDegrees: number[]
}

interface Candidate {
  bar: Bar
  plan: BarPlan
}

const mod = (n: number, m: number) => ((n % m) + m) % m

function weighted<T>(items: readonly T[], weights: readonly number[], random: () => number): T {
  let threshold = random() * weights.reduce((sum, weight) => sum + weight, 0)
  for (const [index, item] of items.entries()) {
    threshold -= weights[index] ?? 0
    if (threshold < 0) return item
  }
  return items[items.length - 1] as T
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j] as T, result[i] as T]
  }
  return result
}

function createContext(
  random: () => number,
  options: GeneratorOptions,
  mode: Mode,
  tonic: number,
  length: number,
): Context {
  const steps = SCALES[mode]
  const midiAt = (tonicMidi: number) => (degree: number) =>
    tonicMidi +
    SEMITONES_PER_OCTAVE * Math.floor(degree / DEGREES_PER_OCTAVE) +
    (steps[mod(degree, DEGREES_PER_OCTAVE)] as number)

  const range = pitchesInRange(options.clef, true)
  const low = range[0] as number
  const high = range[range.length - 1] as number
  const window = WINDOW[options.difficulty]
  const degrees = Array.from({ length: 61 }, (_, index) => index - 30)

  const middle = (low + high) / 2
  let chosen: { tonicMidi: number; allowed: number[] } | null = null
  for (let tonicMidi = low - SEMITONES_PER_OCTAVE; tonicMidi <= high + SEMITONES_PER_OCTAVE; tonicMidi++) {
    if (pitchClass(tonicMidi) !== tonic) continue
    const midiOf = midiAt(tonicMidi)
    const allowed = degrees.filter(
      (degree) =>
        midiOf(degree) >= low &&
        midiOf(degree) <= high &&
        (window === null || (degree >= window[0] && degree <= window[1])),
    )
    if (!allowed.includes(0)) continue
    const better =
      chosen === null ||
      allowed.length > chosen.allowed.length ||
      (allowed.length === chosen.allowed.length &&
        Math.abs(tonicMidi - middle) < Math.abs(chosen.tonicMidi - middle))
    if (better) chosen = { tonicMidi, allowed }
  }
  if (!chosen) throw new Error('Tonic outside the clef range')

  const dominant = chosen.allowed.includes(4) ? 4 : chosen.allowed.includes(-3) ? -3 : 0
  return {
    random,
    difficulty: options.difficulty,
    length,
    cap: INTERVAL_CAP[options.difficulty],
    min: Math.min(...chosen.allowed),
    max: Math.max(...chosen.allowed),
    midiOf: midiAt(chosen.tonicMidi),
    tonicDegrees: [0, dominant],
  }
}

/** Stays in range, within the interval cap, without tritones, 4 equal notes, or an unanswered leap. */
function isPlayable(sequence: readonly number[], ctx: Context): boolean {
  let equalRun = 1
  for (let i = 0; i < sequence.length; i++) {
    const degree = sequence[i] as number
    if (degree < ctx.min || degree > ctx.max) return false
    if (i === 0) continue

    const previous = sequence[i - 1] as number
    const move = degree - previous
    if (Math.abs(move) > ctx.cap) return false
    if (Math.abs(ctx.midiOf(degree) - ctx.midiOf(previous)) === TRITONE) return false

    equalRun = move === 0 ? equalRun + 1 : 1
    if (equalRun >= 4) return false

    if (i >= 2) {
      const before = previous - (sequence[i - 2] as number)
      if (Math.abs(before) >= 3 && move !== -Math.sign(before)) return false
    }
  }
  return true
}

function randomRhythm(ctx: Context, minNotes: number, maxNotes: number): number[] {
  const patterns = RHYTHM_PATTERNS.filter((pattern) => pattern.from <= ctx.difficulty)
  let fallback: number[] = Array.from({ length: ctx.length }, () => 1)
  for (let attempt = 0; attempt < 30; attempt++) {
    const beats: number[] = []
    let position = 0
    while (position < ctx.length - 1e-9) {
      const options = patterns.filter(
        (pattern) =>
          position + pattern.beats.reduce((sum, beat) => sum + beat, 0) <= ctx.length + 1e-9 &&
          pattern.fits(position, ctx.length),
      )
      const pattern = weighted(options, options.map((option) => option.weight), ctx.random)
      beats.push(...pattern.beats)
      position += pattern.beats.reduce((sum, beat) => sum + beat, 0)
    }
    if (beats.length >= minNotes && beats.length <= maxNotes) return beats
    fallback = beats
  }
  return fallback
}

function chooseMove(ctx: Context, heading: number, previousMove: number): number {
  if (Math.abs(previousMove) >= 3) return -Math.sign(previousMove)
  const roll = ctx.random()
  if (roll < 0.54) return heading
  if (roll < 0.71) return 0
  if (roll < 0.86) return Math.min(2, ctx.cap) * heading
  return (1 + Math.floor(ctx.random() * ctx.cap)) * heading
}

/** An arch: heads one way for half the notes, then back, so that repeating the bar always joins up. */
function makeContour(start: number, count: number, prefix: readonly number[], ctx: Context): number[] | null {
  const turn = Math.floor(count / 2)
  for (let attempt = 0; attempt < 40; attempt++) {
    const direction = ctx.random() < 0.5 ? 1 : -1
    const degrees = [start]
    let previousMove = 0
    for (let i = 1; i < count; i++) {
      const heading = i <= turn ? direction : -direction
      const move = chooseMove(ctx, heading, previousMove)
      previousMove = move
      degrees.push((degrees[i - 1] as number) + move)
    }
    const net = Math.abs((degrees[count - 1] as number) - start)
    if (net <= ctx.cap && isPlayable([...prefix, ...degrees], ctx)) return degrees
  }
  return null
}

function makeMotif(ctx: Context): Candidate | null {
  const beats = randomRhythm(ctx, MIN_MOTIF_NOTES, MAX_MOTIF_NOTES)
  const start = ctx.random() < 0.55 ? 0 : (ctx.tonicDegrees[1] as number)
  const degrees = makeContour(start, beats.length, [], ctx)
  return degrees && { bar: { degrees, beats }, plan: { kind: 'motif', source: null } }
}

function finalBeats(ctx: Context): number[] {
  if (ctx.difficulty >= 2 && ctx.length <= 4) return [ctx.length]
  return [...Array.from({ length: ctx.length - 2 }, () => 1), 2]
}

/** Approach paths ending on the tonic, from above or below. */
function cadencePaths(ctx: Context): number[][] {
  const count = finalBeats(ctx).length
  return [1, -1].map((side) => Array.from({ length: count }, (_, k) => side * (count - 1 - k)))
}

function canCadence(sequence: readonly number[], ctx: Context): boolean {
  return cadencePaths(ctx).some((path) => isPlayable([...sequence.slice(-3), ...path], ctx))
}

function makeCadence(sequence: readonly number[], ctx: Context): Candidate | null {
  const paths = shuffled(cadencePaths(ctx), ctx.random).filter((path) =>
    isPlayable([...sequence.slice(-3), ...path], ctx),
  )
  const degrees = paths[0]
  return degrees ? { bar: { degrees, beats: finalBeats(ctx) }, plan: { kind: 'cadence', source: null } } : null
}

function safeBar(sequence: readonly number[], beats: readonly number[], towardTonic: boolean, ctx: Context): Bar {
  const last = sequence[sequence.length - 1] as number
  const lastMove = sequence.length >= 2 ? last - (sequence[sequence.length - 2] as number) : 0
  let direction: number
  if (Math.abs(lastMove) >= 3) direction = -Math.sign(lastMove)
  else if (towardTonic && last !== 0) direction = -Math.sign(last)
  else direction = last > 2 ? -1 : last < -2 ? 1 : ctx.random() < 0.5 ? 1 : -1

  const degrees: number[] = []
  let current = last
  for (let i = 0; i < beats.length; i++) {
    if (current + direction > ctx.max || current + direction < ctx.min) direction = -direction
    current += direction
    degrees.push(current)
  }
  return { degrees, beats: [...beats] }
}

type Transform = 'repeat' | 'sequence' | 'inversion' | 'retrograde'

function transformed(source: Bar, transform: Transform, offset: number): number[] {
  const first = source.degrees[0] as number
  if (transform === 'inversion') return source.degrees.map((degree) => 2 * first - degree + offset)
  if (transform === 'retrograde') return [...source.degrees].reverse().map((degree) => degree + offset)
  return source.degrees.map((degree) => degree + offset)
}

const OFFSETS: Record<Transform, readonly number[]> = {
  repeat: [0],
  sequence: [1, -1, 2, -2],
  inversion: [0, 1, -1],
  retrograde: [0, 1, -1],
}

const countsAsRepeat = (kind: BarKind) => kind === 'repeat' || kind === 'sequence'

function composeBars(ctx: Context, barCount: number): { bars: Bar[]; plan: BarPlan[] } | null {
  const motif = makeMotif(ctx)
  if (!motif) return null

  const bars: Bar[] = [motif.bar]
  const plan: BarPlan[] = [motif.plan]
  const sequence: number[] = [...motif.bar.degrees]
  const needed = Math.min(Math.ceil(barCount * MIN_REPEATED_SHARE), barCount - 2)

  for (let index = 1; index < barCount - 1; index++) {
    const prefix = sequence.slice(-3)
    const prepares = index === barCount - 2
    const accepts = (degrees: number[]) =>
      isPlayable([...prefix, ...degrees], ctx) && (!prepares || canCadence([...prefix, ...degrees], ctx))

    const derive = (transform: Transform, sourceIndex: number, offset: number): Candidate | null => {
      const source = bars[sourceIndex] as Bar
      const degrees = transformed(source, transform, offset)
      return accepts(degrees)
        ? { bar: { degrees, beats: source.beats }, plan: { kind: transform, source: sourceIndex } }
        : null
    }

    const deriveSomehow = (transform: Transform, preferred: number | null): Candidate | null => {
      for (let t = 0; t < TRIES_PER_KIND; t++) {
        const sourceIndex = preferred ?? Math.floor(ctx.random() * index)
        const offsets = OFFSETS[transform]
        const offset = offsets[Math.floor(ctx.random() * offsets.length)] as number
        const found = derive(transform, sourceIndex, offset)
        if (found && (transform !== 'sequence' || offset !== 0)) return found
      }
      return null
    }

    const varied = (sourceIndex: number | null): Candidate | null => {
      for (let t = 0; t < TRIES_PER_KIND * 2; t++) {
        if (sourceIndex === null) {
          const beats = ctx.random() < 0.6 ? (bars[0] as Bar).beats : randomRhythm(ctx, MIN_MOTIF_NOTES, MAX_MOTIF_NOTES)
          const last = sequence[sequence.length - 1] as number
          const start = last + Math.floor(ctx.random() * 3) - 1
          const degrees = makeContour(start, beats.length, prefix, ctx)
          if (degrees && accepts(degrees)) return { bar: { degrees, beats }, plan: { kind: 'variation', source: null } }
        } else {
          const source = bars[sourceIndex] as Bar
          const degrees = source.degrees.map((degree, position) =>
            position > 0 && ctx.random() < 0.5 ? degree + (ctx.random() < 0.5 ? 1 : -1) : degree,
          )
          const shared = degrees.filter((degree, position) => degree === source.degrees[position]).length
          if (shared < degrees.length && accepts(degrees)) {
            return { bar: { degrees, beats: source.beats }, plan: { kind: 'variation', source: sourceIndex } }
          }
        }
      }
      return null
    }

    const run = (): Candidate | null => {
      for (let t = 0; t < TRIES_PER_KIND; t++) {
        const beats = randomRhythm(ctx, MIN_RUN_NOTES, MAX_RUN_NOTES)
        if (beats.length < MIN_RUN_NOTES || beats.length > MAX_RUN_NOTES) continue
        const direction = ctx.random() < 0.5 ? 1 : -1
        const last = sequence[sequence.length - 1] as number
        const degrees = beats.map((_, k) => last + direction * (k + 1))
        if (accepts(degrees)) return { bar: { degrees, beats }, plan: { kind: 'run', source: null } }
      }
      return null
    }

    const exhaustive = (): Candidate | null => {
      const options = shuffled(
        Array.from({ length: index }, (_, source) => source).flatMap((source) =>
          [0, 1, -1, 2, -2].map((offset) => ({ source, offset })),
        ),
        ctx.random,
      )
      for (const { source, offset } of options) {
        const found = derive(offset === 0 ? 'repeat' : 'sequence', source, offset)
        if (found) return found
      }
      return null
    }

    const oddPhrase = Math.floor(index / PHRASE_BARS) % 2 === 1
    const position = index % PHRASE_BARS
    const answered = index - PHRASE_BARS
    const attempts: (() => Candidate | null)[] = []
    if (oddPhrase) {
      const choice = weighted(['repeat', 'variation', 'sequence'] as const, [0.5, 0.35, 0.15], ctx.random)
      attempts.push(() => (choice === 'variation' ? varied(answered) : deriveSomehow(choice, answered)))
    } else {
      const table: readonly (readonly [string, number])[] =
        position === 0
          ? [['variation', 0.35], ['sequence', 0.35], ['repeat', 0.3]]
          : position === 1
            ? [['repeat', 0.35], ['sequence', 0.45], ['inversion', 0.2]]
            : position === 2
              ? [['sequence', 0.45], ['inversion', 0.15], ['run', 0.15], ['retrograde', 0.05], ['variation', 0.2]]
              : [['repeat', 0.3], ['sequence', 0.3], ['run', 0.2], ['variation', 0.2]]
      const choice = weighted(table.map(([name]) => name), table.map(([, weight]) => weight), ctx.random)
      const near = position === 0 ? null : index - 1
      attempts.push(() => {
        if (choice === 'variation') return varied(null)
        if (choice === 'run') return run()
        return deriveSomehow(choice as Transform, near)
      })
    }

    const counted = plan.filter((entry) => countsAsRepeat(entry.kind)).length
    const urgent = counted + (barCount - 1 - index) <= needed
    if (urgent) attempts.unshift(exhaustive)
    attempts.push(exhaustive, () => varied(null), run)

    let chosen: Candidate | null = null
    for (const attempt of attempts) {
      chosen = attempt()
      if (chosen) break
    }
    if (!chosen) {
      const beats = (bars[0] as Bar).beats
      chosen = { bar: safeBar(sequence, beats, prepares, ctx), plan: { kind: 'run', source: null } }
    }
    bars.push(chosen.bar)
    plan.push(chosen.plan)
    sequence.push(...chosen.bar.degrees)
  }

  const cadence = makeCadence(sequence, ctx)
  if (!cadence) return null
  bars.push(cadence.bar)
  plan.push(cadence.plan)
  sequence.push(...cadence.bar.degrees)

  const flat = bars.flatMap((bar) => bar.degrees)
  const repeated = plan.filter((entry) => countsAsRepeat(entry.kind)).length
  if (repeated < needed || !isPlayable(flat, ctx)) return null
  return { bars, plan }
}

interface Sounded {
  pitch: number
  beats: number
}

function addChromaticPassingTones(sounded: Sounded[], ctx: Context): Sounded[] {
  const limit = Math.floor(sounded.length * MAX_CHROMATIC_SHARE)
  const eligible = sounded
    .map((_, index) => index)
    .filter((index) => {
      const next = sounded[index + 1]
      const current = sounded[index] as Sounded
      return next !== undefined && current.beats === 1 && Math.abs(next.pitch - current.pitch) === 2
    })
  const chosen = shuffled(eligible, ctx.random)
    .filter(() => ctx.random() < CHROMATIC_CHANCE)
    .slice(0, limit)
    .sort((a, b) => b - a)

  const result = [...sounded]
  for (const index of chosen) {
    const current = result[index] as Sounded
    const next = result[index + 1] as Sounded
    const passing = current.pitch + Math.sign(next.pitch - current.pitch)
    result.splice(index, 1, { pitch: current.pitch, beats: 0.5 }, { pitch: passing, beats: 0.5 })
  }
  return result
}

function written(beats: number): { duration: Duration; dots?: number } {
  return WRITTEN[beats] as { duration: Duration; dots?: number }
}

function chooseKey(random: () => number): number {
  return weighted(
    KEY_WEIGHTS.map(([fifths]) => fifths),
    KEY_WEIGHTS.map(([, weight]) => weight),
    random,
  )
}

function attemptRandom(seed: number, attempt: number): () => number {
  return seededRandom((seed + Math.imul(attempt, 0x9e3779b1)) >>> 0)
}

export function generateMelodyWithPlan(seed: number, options: GeneratorOptions): GeneratedMelody {
  const setup = seededRandom(seed >>> 0)
  const drawnKey = chooseKey(setup)
  const drawnMode: Mode = setup() < MAJOR_CHANCE ? 'major' : 'minor'
  const drawnWaltz = setup() < WALTZ_CHANCE

  const key = options.armures ? (options.key ?? drawnKey) : 0
  const mode = options.mode ?? drawnMode
  const time = options.time ?? (drawnWaltz ? { beats: 3, beatType: 4 } : COMMON_TIME)
  const barCount = Math.max(2, options.bars ?? DEFAULT_BARS)
  const majorTonic = mod(7 * key, SEMITONES_PER_OCTAVE)
  const tonic = mode === 'major' ? majorTonic : mod(majorTonic + 9, SEMITONES_PER_OCTAVE)

  let ctx = createContext(attemptRandom(seed, 0), options, mode, tonic, barLength(time))
  let composed = composeBars(ctx, barCount)
  for (let attempt = 1; attempt < MAX_ATTEMPTS && !composed; attempt++) {
    ctx = createContext(attemptRandom(seed, attempt), options, mode, tonic, barLength(time))
    composed = composeBars(ctx, barCount)
  }
  if (!composed) throw new Error(`Aucune mélodie composée pour la graine ${seed}`)
  const { bars, plan } = composed

  let sounded: Sounded[] = bars.flatMap((bar) =>
    bar.degrees.map((degree, index) => ({ pitch: ctx.midiOf(degree), beats: bar.beats[index] as number })),
  )
  if (options.armures && options.difficulty >= 3) sounded = addChromaticPassingTones(sounded, ctx)

  return {
    melody: {
      name: `Mélodie ${seed}`,
      clef: options.clef,
      key,
      tempo: 60 + 10 * options.difficulty,
      timeSignature: time,
      notes: sounded.map(({ pitch, beats }) => ({ pitch, ...written(beats) })),
    },
    plan,
    mode,
    tonic,
  }
}

export function generateMelody(seed: number, options: GeneratorOptions): Melody & { timeSignature: TimeSignature } {
  return generateMelodyWithPlan(seed, options).melody
}
