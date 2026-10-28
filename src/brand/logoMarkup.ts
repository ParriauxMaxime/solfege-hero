import { BRAND_HEAD_RX, CLEF, NOTE_TILT, brandDefs, flameWisp, goldHead, headShadow, type Relief } from './art.ts'

/** Leaves headroom above the staff for the tallest flame, so nothing is clipped on the highest note. */
export const LOGO_VIEW_BOX = '24 4 146 162'
export const LOGO_WIDTH = 96
export const LOGO_HEIGHT = 107

export const TOP_LINE_Y = 68
export const BOTTOM_LINE_Y = 132
export const STEP_HEIGHT = 8
export const HIT_X = 128
export const PX_PER_BEAT = 24
export const FADE_LEFT_X = 82
export const FADE_LEFT_WIDTH = 10
export const FADE_RIGHT_X = 172
export const FADE_RIGHT_WIDTH = 14

const STAFF_LEFT_X = 24
const STAFF_RIGHT_X = 170
const STAFF_STROKE = 1.6
const CLEF_STROKE = 4
const RELIEF_LEVEL: Relief = 2
const HEAD_RX = 9
const HEAD_RY = 6.5
const ART_SCALE = Number((HEAD_RX / BRAND_HEAD_RX).toFixed(4))
const STEM_OFFSET = 8.2
const STEM_LENGTH = 28
const STEM_WIDTH = 2.4
const BAR_OFFSET = 0.45 * PX_PER_BEAT
const GLOW_RADIUS = 15
const SPARK_RADIUS = 1.3
const PUFF_RADIUS = 3
const STATIC_GLOW_OPACITY = 0.2
const STEM_LIT = 'var(--logo-stem-lit)'
const WRONG = 'var(--error)'

const GOLD: [string, string, string] = ['var(--logo-gold-1)', 'var(--logo-gold-2)', 'var(--logo-gold-3)']

export const staffY = (step: number) => BOTTOM_LINE_Y - step * STEP_HEIGHT

/** Notes appear at the right edge and dissolve under the clef. */
export const edgeOpacity = (x: number) => Math.max(0, Math.min(1, (x - FADE_LEFT_X) / FADE_LEFT_WIDTH, (FADE_RIGHT_X - x) / FADE_RIGHT_WIDTH))

export const stemPath = (up: boolean) => `M${up ? STEM_OFFSET : -STEM_OFFSET} 0V${up ? -STEM_LENGTH : STEM_LENGTH}`

const round = (value: number) => Number(value.toFixed(2))

const gradientDefs = (prefix: string) => brandDefs(prefix, { gold: GOLD })

const puffDefs = (prefix: string) =>
  `<defs><radialGradient id="${prefix}-puff"><stop offset="0" stop-color="#b8b2ac" stop-opacity="0.55"/><stop offset="1" stop-color="#b8b2ac" stop-opacity="0"/></radialGradient></defs>`

const staffMarkup = () =>
  `<path d="${[0, 2, 4, 6, 8].map((step) => `M${STAFF_LEFT_X} ${staffY(step)}H${STAFF_RIGHT_X}`).join('')}" stroke="currentColor" stroke-width="${STAFF_STROKE}"/>`

const clefMarkup = () =>
  `<g fill="none" stroke="currentColor" stroke-width="${CLEF_STROKE}" stroke-linecap="round" stroke-linejoin="round">${CLEF.map((d) => `<path d="${d}"/>`).join('')}</g>`

const headMarkup = (fill: string) => `<ellipse rx="${HEAD_RX}" ry="${HEAD_RY}" transform="rotate(${NOTE_TILT})" fill="${fill}"/>`

const stemMarkup = (color: string, d = '') => `<path data-k="stem" d="${d}" stroke="${color}" stroke-width="${STEM_WIDTH}" stroke-linecap="round" fill="none"/>`

const goldHeadMarkup = (prefix: string) => goldHead(prefix, RELIEF_LEVEL, { rx: HEAD_RX, ry: HEAD_RY, rim: STEM_LIT, rimWidth: 0.8 })

const headShadowMarkup = (prefix: string) => headShadow(prefix, RELIEF_LEVEL, { rx: HEAD_RX, ry: HEAD_RY })

const wispMarkup = (prefix: string) => `<g transform="scale(${ART_SCALE})">${flameWisp(prefix, RELIEF_LEVEL)}</g>`

const glowMarkup = (prefix: string, opacity: number) => `<circle r="${GLOW_RADIUS}" fill="url(#${prefix}-glow)" opacity="${opacity}"/>`

/** One recyclable note of the scrolling logo; the runtime drives every layer through its `data-k` attribute. */
export const noteSlotMarkup = (prefix: string) => `<g data-k="slot">
<path data-k="bar" d="M${-BAR_OFFSET} ${TOP_LINE_Y}V${BOTTOM_LINE_Y}" stroke="currentColor" stroke-width="${STAFF_STROKE}" opacity="0"/>
<g data-k="note">
<circle data-k="glow" r="${GLOW_RADIUS}" fill="url(#${prefix}-glow)" opacity="0"/>
<g data-k="ink">${stemMarkup('currentColor')}${headMarkup('currentColor')}</g>
<g data-k="lit" opacity="0">${headShadowMarkup(prefix)}${stemMarkup(STEM_LIT)}<g data-k="pop">${goldHeadMarkup(prefix)}</g></g>
<g data-k="miss" opacity="0">${stemMarkup(WRONG)}${headMarkup(WRONG)}</g>
<g data-k="wisp" opacity="0"><g data-k="sway">${wispMarkup(prefix)}</g></g>
<circle data-k="spark" r="${SPARK_RADIUS}" fill="url(#${prefix}-spark)" opacity="0"/>
<circle data-k="puff" r="${PUFF_RADIUS}" fill="url(#${prefix}-puff)" opacity="0"/>
<circle data-k="puff" r="${PUFF_RADIUS}" fill="url(#${prefix}-puff)" opacity="0"/>
</g>
</g>`

export const POOL_SIZE = 8

export const animatedLogoContent = (prefix: string) =>
  `${gradientDefs(prefix)}${puffDefs(prefix)}${staffMarkup()}<g data-k="scroll">${Array.from({ length: POOL_SIZE }, () => noteSlotMarkup(prefix)).join('')}</g>${clefMarkup()}`

interface StaticNote {
  x: number
  step: number
  flame?: number
}

const STATIC_NOTES: StaticNote[] = [
  { x: 90, step: 2, flame: 0.78 },
  { x: 114, step: 4, flame: 0.9 },
  { x: 138, step: 3, flame: 1.02 },
  { x: 162, step: 5 },
]
const STATIC_BAR_X = 150

const staticNoteMarkup = (prefix: string, { x, step, flame }: StaticNote) => {
  const up = step < 4
  const opacity = round(edgeOpacity(x))
  const head = flame === undefined
    ? `<path d="${stemPath(up)}" stroke="currentColor" stroke-width="${STEM_WIDTH}" stroke-linecap="round" fill="none"/>${headMarkup('currentColor')}`
    : `${glowMarkup(prefix, STATIC_GLOW_OPACITY)}<use href="#${prefix}-cast"/><path d="${stemPath(up)}" stroke="${STEM_LIT}" stroke-width="${STEM_WIDTH}" stroke-linecap="round" fill="none"/><use href="#${prefix}-head"/><use href="#${prefix}-flame" transform="scale(${flame})"/>`
  return `<g transform="translate(${x} ${staffY(step)})" opacity="${opacity}">${head}</g>`
}

const staticDefs = (prefix: string) =>
  `${gradientDefs(prefix)}<defs><g id="${prefix}-flame">${wispMarkup(prefix)}</g><g id="${prefix}-cast">${headShadowMarkup(prefix)}</g><g id="${prefix}-head">${goldHeadMarkup(prefix)}</g></defs>`

/** Still frame: burning notes trailing from the hit spot, plain ink notes still to come. */
export const staticLogoContent = (prefix: string) =>
  `${staticDefs(prefix)}${staffMarkup()}<path d="M${STATIC_BAR_X} ${TOP_LINE_Y}V${BOTTOM_LINE_Y}" stroke="currentColor" stroke-width="${STAFF_STROKE}" opacity="${round(edgeOpacity(STATIC_BAR_X))}"/>${STATIC_NOTES.map((note) => staticNoteMarkup(prefix, note)).join('')}${clefMarkup()}`

export const logoSvg = (className: string, content: string, { sized = false } = {}) =>
  `<svg class="${className}" viewBox="${LOGO_VIEW_BOX}"${sized ? ` width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}"` : ''} aria-hidden="true">${content}</svg>`

/** Logo of the pre-rendered pages, drawn before any script runs. */
export const splashLogoSvg = () => logoSvg('brand-logo brand-logo-splash', staticLogoContent('b'), { sized: true })
