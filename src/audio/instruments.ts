export const INSTRUMENTS = ['sine', 'piano', 'organ', 'guitar'] as const
export type Instrument = (typeof INSTRUMENTS)[number]

export const INSTRUMENT_LABELS: Record<Instrument, string> = {
  sine: 'Sinusoïde pure',
  piano: 'Piano',
  organ: 'Orgue',
  guitar: 'Guitare',
}

export const INSTRUMENT_DESCRIPTIONS: Record<Instrument, string> = {
  sine: 'Un son pur et doux',
  piano: 'Attaque nette, résonance longue',
  organ: 'Son tenu et chaleureux',
  guitar: 'Corde pincée, claire et vive',
}

const MAX_PLUCK_SECONDS = 2
const MIN_PLUCK_SECONDS = 1.2
const PLUCK_DECAY = 0.996
const PLUCK_FADE_SECONDS = 0.06
const FLOOR = 0.0001

/** Karplus-Strong plucked string: a noise burst circulating in an averaging delay line. */
export function pluckSamples(hz: number, sampleRate: number, seconds: number, random: () => number = Math.random): Float32Array {
  const length = Math.max(1, Math.floor(sampleRate * Math.min(MAX_PLUCK_SECONDS, seconds)))
  const period = Math.max(2, Math.round(sampleRate / hz - 0.5))
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    if (i < period) out[i] = random() * 2 - 1
    else out[i] = PLUCK_DECAY * 0.5 * ((out[i - period] as number) + (out[i - period + 1] as number))
  }
  const fade = Math.min(length, Math.floor(sampleRate * PLUCK_FADE_SECONDS))
  for (let i = 0; i < fade; i++) out[length - 1 - i] = (out[length - 1 - i] as number) * (i / fade)
  return out
}

const pluckCache = new Map<string, AudioBuffer>()

function pluckBuffer(ctx: BaseAudioContext, hz: number, duration: number): AudioBuffer {
  const midi = Math.round(12 * Math.log2(hz / 440) + 69)
  const key = `${midi}@${ctx.sampleRate}`
  let buffer = pluckCache.get(key)
  if (!buffer) {
    const samples = pluckSamples(hz, ctx.sampleRate, Math.max(duration, MIN_PLUCK_SECONDS))
    buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate)
    buffer.getChannelData(0).set(samples)
    pluckCache.set(key, buffer)
  }
  return buffer
}

function partial(
  ctx: BaseAudioContext,
  destination: AudioNode,
  hz: number,
  at: number,
  end: number,
  shape: (param: AudioParam) => void,
  detuneCents = 0,
): void {
  const oscillator = ctx.createOscillator()
  const amp = ctx.createGain()
  oscillator.frequency.value = hz
  oscillator.detune.value = detuneCents
  shape(amp.gain)
  oscillator.connect(amp).connect(destination)
  oscillator.start(at)
  oscillator.stop(end)
}

function sine(ctx: BaseAudioContext, out: AudioNode, hz: number, at: number, duration: number): void {
  const end = at + duration + 0.25
  partial(ctx, out, hz, at, end + 0.02, (g) => {
    g.setValueAtTime(FLOOR, at)
    g.exponentialRampToValueAtTime(0.28, at + 0.02)
    g.setValueAtTime(0.28, at + Math.max(0.03, duration * 0.4))
    g.exponentialRampToValueAtTime(FLOOR, end)
  })
}

const PIANO_PARTIALS = [
  { ratio: 1, gain: 0.3, cents: 0 },
  { ratio: 2, gain: 0.14, cents: 0 },
  { ratio: 3, gain: 0.07, cents: 3 },
  { ratio: 4, gain: 0.04, cents: 5 },
]

function piano(ctx: BaseAudioContext, out: AudioNode, hz: number, at: number, duration: number): void {
  const end = at + Math.max(duration, 0.6) + 1.2
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.value = 0.5
  filter.frequency.setValueAtTime(Math.min(9000, hz * 14), at)
  filter.frequency.exponentialRampToValueAtTime(Math.max(600, hz * 2), end)
  filter.connect(out)
  for (const { ratio, gain, cents } of PIANO_PARTIALS) {
    partial(
      ctx,
      filter,
      hz * ratio,
      at,
      end + 0.02,
      (g) => {
        g.setValueAtTime(FLOOR, at)
        g.exponentialRampToValueAtTime(gain, at + 0.006)
        g.exponentialRampToValueAtTime(gain * 0.35, at + 0.25)
        g.exponentialRampToValueAtTime(FLOOR, end)
      },
      cents,
    )
  }
}

const ORGAN_DRAWBARS = [
  { ratio: 1, gain: 0.16 },
  { ratio: 2, gain: 0.12 },
  { ratio: 3, gain: 0.08 },
  { ratio: 4, gain: 0.06 },
  { ratio: 6, gain: 0.04 },
  { ratio: 8, gain: 0.025 },
]
const CHORUS_CENTS = [-3, 3]

function organ(ctx: BaseAudioContext, out: AudioNode, hz: number, at: number, duration: number): void {
  const hold = at + Math.max(duration, 0.3)
  const end = hold + 0.12
  for (const { ratio, gain } of ORGAN_DRAWBARS) {
    for (const cents of CHORUS_CENTS) {
      partial(
        ctx,
        out,
        hz * ratio,
        at,
        end + 0.02,
        (g) => {
          g.setValueAtTime(FLOOR, at)
          g.exponentialRampToValueAtTime(gain, at + 0.04)
          g.setValueAtTime(gain, hold)
          g.exponentialRampToValueAtTime(FLOOR, end)
        },
        cents,
      )
    }
  }
}

function guitar(ctx: BaseAudioContext, out: AudioNode, hz: number, at: number, duration: number): void {
  const source = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const amp = ctx.createGain()
  source.buffer = pluckBuffer(ctx, hz, duration)
  filter.type = 'lowpass'
  filter.frequency.value = Math.min(6000, hz * 8)
  amp.gain.value = 0.6
  source.connect(filter).connect(amp).connect(out)
  source.start(at)
}

const PLAYERS: Record<Instrument, (ctx: BaseAudioContext, out: AudioNode, hz: number, at: number, duration: number) => void> = {
  sine,
  piano,
  organ,
  guitar,
}

export function playInstrument(
  ctx: BaseAudioContext,
  destination: AudioNode,
  instrument: Instrument,
  hz: number,
  at: number,
  duration: number,
): void {
  PLAYERS[instrument](ctx, destination, hz, at, duration)
}
