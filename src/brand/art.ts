export type Relief = 1 | 2

export interface ReliefParams {
  back: number
  darkRim: number
  lightEdge: number
  streak: number
  core: number
  hot: number
  shadow: number
  bevel: number
  spec: number
  fill: number
  stemEdge: number
}

export const RELIEF: Record<Relief, ReliefParams> = {
  1: { back: 0.45, darkRim: 0.55, lightEdge: 0.35, streak: 0.5, core: 0.8, hot: 0, shadow: 0.35, bevel: 0.28, spec: 0.55, fill: 1, stemEdge: 0.5 },
  2: { back: 0.75, darkRim: 0.85, lightEdge: 0.15, streak: 0.85, core: 1, hot: 0.85, shadow: 0.55, bevel: 0.5, spec: 0.9, fill: 1, stemEdge: 0.9 },
}

export const WISP = 'M28 4C33 -22 14 -40 13 -64C12 -90 2 -110 -6 -138C-4 -114 -17 -98 -19 -76C-22 -52 -34 -32 -30 4C-30 26 28 26 28 4Z'
export const CORE = 'M1 -8C7 -30 -3 -48 -1 -68C0 -82 -3 -94 -6 -106C-10 -88 -12 -76 -12 -60C-12 -38 -8 -22 1 -8Z'
export const HOT = 'M-2 -12C2 -30 -5 -44 -4 -60C-4 -68 -5 -74 -7 -82C-9 -70 -10 -62 -10 -52C-10 -36 -7 -24 -2 -12Z'
export const STREAK = 'M-21 -16C-22 -42 -13 -62 -11 -82C-9 -98 -6 -110 -6 -124'
export const CLEF = [
  'M58 152 C58 162 46 162 47 153',
  'M58 152 L61 70 C62 52 68 38 73 38 C80 40 72 62 58 90 C42 116 48 135 62 135 C77 135 80 114 67 107 C55 101 46 111 53 122 C57 127 64 124 62 118',
]

export const BRAND_HEAD_RX = 33
export const BRAND_HEAD_RY = 24.5
export const NOTE_TILT = -20

export interface BrandColors {
  gold: [string, string, string]
  stemLit: string
}

export const DARK_COLORS: BrandColors = { gold: ['#fff3c4', '#ffc24a', '#f0a020'], stemLit: '#fffbe6' }

type Stop = [offset: number, color: string, opacity?: number]

const stopColor = (color: string) => (color.startsWith('var(') ? `style="stop-color:${color}"` : `stop-color="${color}"`)

const stops = (list: Stop[]) => list.map(([offset, color, opacity = 1]) => `<stop offset="${offset}" ${stopColor(color)}${opacity === 1 ? '' : ` stop-opacity="${opacity}"`}/>`).join('')

export const brandDefs = (prefix: string, { gold }: Pick<BrandColors, 'gold'> = DARK_COLORS) => `<defs>
  <radialGradient id="${prefix}-glow">${stops([[0, '#ffb04a', 0.8], [0.45, '#f97316', 0.35], [1, '#f97316', 0]])}</radialGradient>
  <radialGradient id="${prefix}-wglow" cx="0.5" cy="0.62" r="0.5">${stops([[0, '#ff8a1f', 0.9], [1, '#f97316', 0]])}</radialGradient>
  <linearGradient id="${prefix}-back" x1="0" y1="1" x2="0" y2="0">${stops([[0, '#c2410c', 0.9], [0.5, '#8a1c08', 0.6], [1, '#5a0f04', 0]])}</linearGradient>
  <linearGradient id="${prefix}-fill" x1="0" y1="1" x2="0" y2="0">${stops([[0, '#ffc24a', 0.95], [0.3, '#ff8a1f', 0.8], [0.7, '#e0400f', 0.38], [1, '#b91c1c', 0]])}</linearGradient>
  <linearGradient id="${prefix}-edge" x1="0" y1="1" x2="0" y2="0">${stops([[0, '#ffd36b'], [0.55, '#ffb35a', 0.85], [1, '#ff8a1f', 0.15]])}</linearGradient>
  <linearGradient id="${prefix}-rim" x1="0" y1="1" x2="0" y2="0">${stops([[0, '#ffb35a'], [0.35, '#d9480f', 0.9], [0.8, '#8a1c08', 0.4], [1, '#8a1c08', 0]])}</linearGradient>
  <linearGradient id="${prefix}-core" x1="0" y1="1" x2="0" y2="0">${stops([[0, '#fffbe6', 0.95], [0.55, '#ffd36b', 0.55], [1, '#ffd36b', 0]])}</linearGradient>
  <linearGradient id="${prefix}-streak" x1="0" y1="1" x2="0" y2="0">${stops([[0, '#fffbe6', 0], [0.2, '#fffbe6'], [1, '#ffe7a8', 0]])}</linearGradient>
  <linearGradient id="${prefix}-gold" x1="0" y1="0" x2="0" y2="1">${stops([[0, gold[0]], [0.45, gold[1]], [1, gold[2]]])}</linearGradient>
  <radialGradient id="${prefix}-hfill" cx="0.36" cy="0.3" r="0.78">${stops([[0, '#fff8dc'], [0.32, '#ffcf5a'], [0.72, '#f0a020'], [1, '#b06508']])}</radialGradient>
  <radialGradient id="${prefix}-bevel" cx="0.42" cy="0.36" r="0.66">${stops([[0.72, '#5a2a00', 0], [1, '#5a2a00', 1]])}</radialGradient>
  <radialGradient id="${prefix}-spec">${stops([[0, '#ffffff'], [1, '#ffffff', 0]])}</radialGradient>
  <radialGradient id="${prefix}-shadow">${stops([[0, '#000000'], [0.6, '#000000', 0.5], [1, '#000000', 0]])}</radialGradient>
  <radialGradient id="${prefix}-spark">${stops([[0, '#fff3c4'], [0.5, '#ffd36b'], [1, '#ff8a1f', 0]])}</radialGradient>
</defs>`

export interface WispOptions {
  tilt?: number
  height?: number
  glow?: number
}

export const flameWisp = (prefix: string, relief: Relief, { tilt = -14, height = 1, glow = 1 }: WispOptions = {}) => {
  const params = RELIEF[relief]
  return `<ellipse cx="0" cy="-40" rx="46" ry="74" transform="rotate(${tilt})" fill="url(#${prefix}-wglow)" opacity="${(0.24 * glow).toFixed(3)}"/>
  <g transform="rotate(${tilt}) scale(1 ${height})">
    <path d="${WISP}" transform="translate(-3 2) scale(1.08)" fill="url(#${prefix}-back)" opacity="${params.back}"/>
    <path d="${WISP}" fill="url(#${prefix}-fill)"/>
    <path class="core" d="${CORE}" fill="url(#${prefix}-core)" opacity="${params.core}"/>
    <path d="${HOT}" fill="#fffbe6" opacity="${params.hot}"/>
    <path d="${STREAK}" fill="none" stroke="url(#${prefix}-streak)" stroke-width="2.6" stroke-linecap="round" opacity="${params.streak}"/>
    <path d="${WISP}" fill="none" stroke="url(#${prefix}-edge)" stroke-width="2.2" stroke-linejoin="round" opacity="${params.lightEdge}"/>
    <path d="${WISP}" fill="none" stroke="url(#${prefix}-rim)" stroke-width="2.6" stroke-linejoin="round" opacity="${params.darkRim}"/>
  </g>`
}

export interface HeadOptions {
  rx: number
  ry: number
  tilt?: number
}

export interface GoldHeadOptions extends HeadOptions {
  rim?: string
  rimWidth: number
}

export const goldHead = (prefix: string, relief: Relief, { rx, ry, tilt = NOTE_TILT, rim = DARK_COLORS.stemLit, rimWidth }: GoldHeadOptions) => {
  const params = RELIEF[relief]
  return `<g transform="rotate(${tilt})">
  <ellipse rx="${rx}" ry="${ry}" fill="url(#${prefix}-gold)"/>
  <ellipse rx="${rx}" ry="${ry}" fill="url(#${prefix}-hfill)" opacity="${params.fill}"/>
  <ellipse rx="${rx}" ry="${ry}" fill="url(#${prefix}-bevel)" opacity="${params.bevel}"/>
  <ellipse cx="${-rx * 0.34}" cy="${-ry * 0.42}" rx="${rx * 0.36}" ry="${ry * 0.2}" fill="url(#${prefix}-spec)" opacity="${params.spec}"/>
  <ellipse rx="${rx}" ry="${ry}" fill="none" stroke="${rim}" stroke-width="${rimWidth}" opacity="0.85"/>
</g>`
}

export const headShadow = (prefix: string, relief: Relief, { rx, ry, tilt = NOTE_TILT }: HeadOptions) =>
  `<ellipse cx="${rx * 0.16}" cy="${ry * 0.42}" rx="${rx * 1.18}" ry="${ry * 1.12}" transform="rotate(${tilt})" fill="url(#${prefix}-shadow)" opacity="${RELIEF[relief].shadow}"/>`

export interface LitStemOptions {
  x: number
  y1: number
  y2: number
  width: number
  color?: string
}

export const litStem = (relief: Relief, { x, y1, y2, width, color = DARK_COLORS.stemLit }: LitStemOptions) =>
  `<path d="M${x} ${y1}V${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>
  <path d="M${x - width * 0.22} ${Math.min(y1, y2) + width}V${Math.max(y1, y2) - width}" stroke="#ffffff" stroke-width="${width * 0.3}" stroke-linecap="round" opacity="${RELIEF[relief].stemEdge}"/>`

export type SparkDot = [x: number, y: number, radius: number]

export const sparkDots = (prefix: string, scale: number, dots: SparkDot[]) =>
  dots.map(([x, y, radius]) => `<circle cx="${x * scale}" cy="${y * scale}" r="${radius}" fill="url(#${prefix}-spark)"/>`).join('')

export interface LitStaffOptions {
  x: number
  reach: number
  lines: number[]
  width: number
  opacity: number
}

export const litStaff = (prefix: string, { x, reach, lines, width, opacity }: LitStaffOptions) =>
  `<linearGradient id="${prefix}-lit" gradientUnits="userSpaceOnUse" x1="${x - reach}" y1="0" x2="${x + reach}" y2="0">${stops([[0, '#ffb35a', 0], [0.5, '#ffb35a'], [1, '#ffb35a', 0]])}</linearGradient>
  <g stroke="url(#${prefix}-lit)" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}">${lines.map((y) => `<path d="M${x - reach} ${y}H${x + reach}"/>`).join('')}</g>`
