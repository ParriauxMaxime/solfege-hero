import { CLEF, NOTE_TILT } from './art.ts'
import { FX_RIM, fxBehindMarkup, fxDefs, fxFrontMarkup, hotHeadMarkup, hotNoteStatic } from './streakFx.ts'

/** Wide staff (420 x 160, clef at the far left) with headroom above for the embers and the aura of the highest note. */
export const LOGO_VIEW_BOX = '24 6 420 160'
export const LOGO_WIDTH = 420
export const LOGO_HEIGHT = 160

export const TOP_LINE_Y = 68
export const BOTTOM_LINE_Y = 132
export const MIDDLE_LINE_Y = 100
export const STEP_HEIGHT = 8
export const HIT_X = 252
export const PX_PER_BEAT = 52
export const FADE_LEFT_X = 82
export const FADE_LEFT_WIDTH = 10
export const FADE_RIGHT_X = 446
export const FADE_RIGHT_WIDTH = 22

/** Same drawing as `QUARTER_REST_PATH` in src/ui/glyphs.ts (copied: this module must stay importable from Node). */
export const QUARTER_REST_PATH = 'M-4 -16 L3 -9 L-3 -1 L4 7 C-4 8 -5 14 2 18'

const STAFF_LEFT_X = 24
const STAFF_RIGHT_X = 444
const STAFF_STROKE = 1.6
const CLEF_STROKE = 4
const REST_STROKE = 3
const HEAD_RX = 10.5
const HEAD_RY = 7.5
const STEM_OFFSET = 9.6
const STEM_LENGTH = 33
const STEM_WIDTH = 2.4
const BAR_OFFSET = 0.45 * PX_PER_BEAT
const STEM_LIT = FX_RIM
const WRONG = 'var(--error, #ff4d6d)'

export const staffY = (step: number) => BOTTOM_LINE_Y - step * STEP_HEIGHT

/** Notes appear at the right edge and dissolve under the clef. */
export const edgeOpacity = (x: number) => Math.max(0, Math.min(1, (x - FADE_LEFT_X) / FADE_LEFT_WIDTH, (FADE_RIGHT_X - x) / FADE_RIGHT_WIDTH))

export const stemPath = (up: boolean) => `M${up ? STEM_OFFSET : -STEM_OFFSET} 0V${up ? -STEM_LENGTH : STEM_LENGTH}`

const round = (value: number) => Number(value.toFixed(2))

const staffMarkup = () =>
  `<path d="${[0, 2, 4, 6, 8].map((step) => `M${STAFF_LEFT_X} ${staffY(step)}H${STAFF_RIGHT_X}`).join('')}" stroke="currentColor" stroke-width="${STAFF_STROKE}"/>`

const clefMarkup = () =>
  `<g fill="none" stroke="currentColor" stroke-width="${CLEF_STROKE}" stroke-linecap="round" stroke-linejoin="round">${CLEF.map((d) => `<path d="${d}"/>`).join('')}</g>`

const headMarkup = (fill: string) => `<ellipse rx="${HEAD_RX}" ry="${HEAD_RY}" transform="rotate(${NOTE_TILT})" fill="${fill}"/>`

const stemMarkup = (color: string, d = '') => `<path data-k="stem" d="${d}" stroke="${color}" stroke-width="${STEM_WIDTH}" stroke-linecap="round" fill="none"/>`

const restMarkup = (attributes = '') =>
  `<g${attributes}><path d="${QUARTER_REST_PATH}" transform="translate(0 ${MIDDLE_LINE_Y})" fill="none" stroke="currentColor" stroke-width="${REST_STROKE}" stroke-linejoin="round"/></g>`

const barMarkup = (x: number, attributes: string) =>
  `<path ${attributes} d="M${round(x)} ${TOP_LINE_Y}V${BOTTOM_LINE_Y}" stroke="currentColor" stroke-width="${STAFF_STROKE}"/>`

const hotHead = (prefix: string) => hotHeadMarkup(prefix, 'filled', { rx: HEAD_RX, ry: HEAD_RY, tilt: NOTE_TILT })

/** One recyclable beat of the scrolling logo (a note or a rest); the runtime drives every layer through its `data-k` attribute. */
export const noteSlotMarkup = (prefix: string) => `<g data-k="slot">
${barMarkup(-BAR_OFFSET, 'data-k="bar" opacity="0"')}
${restMarkup(' data-k="rest" opacity="0"')}
<g data-k="note">
${fxBehindMarkup(prefix)}
<g data-k="ink">${stemMarkup('currentColor')}${headMarkup('currentColor')}</g>
<g data-k="lit" opacity="0">${stemMarkup(STEM_LIT)}<g data-k="pop">${hotHead(prefix)}</g></g>
<g data-k="miss" opacity="0">${stemMarkup(WRONG)}${headMarkup(WRONG)}</g>
${fxFrontMarkup(prefix)}
</g>
</g>`

/** Enough slots to cover the staff from the clef to the right edge. */
export const POOL_SIZE = 10

export const animatedLogoContent = (prefix: string) =>
  `${fxDefs(prefix)}${staffMarkup()}<g data-k="scroll">${Array.from({ length: POOL_SIZE }, () => noteSlotMarkup(prefix)).join('')}</g>${clefMarkup()}`

interface StaticBeat {
  /** Beats from the hit spot. */
  beat: number
  step?: number
  /** Heat of a burning note, 0 to 1; plain ink when absent. */
  intensity?: number
  barStart?: boolean
}

/** One bar of four beats ends on the hit spot: a burning note, a rest, two notes burning fuller; the next bar is still plain ink. */
const STATIC_BEATS: StaticBeat[] = [
  { beat: -3, step: 2, intensity: 0.3, barStart: true },
  { beat: -2 },
  { beat: -1, step: 3, intensity: 0.65 },
  { beat: 0, step: 5, intensity: 1 },
  { beat: 1, step: 6, barStart: true },
  { beat: 2, step: 4 },
  { beat: 3, step: 2 },
]

const staticBeatMarkup = (prefix: string, { beat, step, intensity, barStart }: StaticBeat) => {
  const x = HIT_X + beat * PX_PER_BEAT
  const opacity = round(edgeOpacity(x))
  const barOpacity = round(edgeOpacity(x - BAR_OFFSET))
  const bar = barStart && barOpacity > 0 ? barMarkup(x - BAR_OFFSET, `opacity="${barOpacity}"`) : ''
  if (step === undefined) return `${bar}<g transform="translate(${x} 0)" opacity="${opacity}">${restMarkup()}</g>`
  const up = step < 4
  const body =
    intensity === undefined
      ? `${stemMarkup('currentColor', stemPath(up))}${headMarkup('currentColor')}`
      : `${stemMarkup(STEM_LIT, stemPath(up))}${hotNoteStatic(prefix, { shape: 'filled', rx: HEAD_RX, ry: HEAD_RY, tilt: NOTE_TILT, intensity, detail: 'full' })}`
  return `${bar}<g transform="translate(${x} ${staffY(step)})" opacity="${opacity}">${body}</g>`
}

/** Still frame (reduced motion, pre-rendered pages): burning notes trailing from the hit spot with a rest among them, plain ink notes still to come. */
export const staticLogoContent = (prefix: string) =>
  `${fxDefs(prefix)}${staffMarkup()}${STATIC_BEATS.map((beat) => staticBeatMarkup(prefix, beat)).join('')}${clefMarkup()}`

export const logoSvg = (className: string, content: string, { sized = false } = {}) =>
  `<svg class="${className}" viewBox="${LOGO_VIEW_BOX}"${sized ? ` width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}"` : ''} aria-hidden="true">${content}</svg>`

/** Logo of the pre-rendered pages, drawn before any script runs. */
export const splashLogoSvg = () => logoSvg('brand-logo brand-logo-splash', staticLogoContent('b'), { sized: true })
