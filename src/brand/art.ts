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

export interface LitStemOptions {
  x: number
  y1: number
  y2: number
  width: number
  color?: string
}

export const litStem = ({ x, y1, y2, width, color = DARK_COLORS.stemLit }: LitStemOptions) =>
  `<path d="M${x} ${y1}V${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>
  <path d="M${x - width * 0.22} ${Math.min(y1, y2) + width}V${Math.max(y1, y2) - width}" stroke="#ffffff" stroke-width="${width * 0.3}" stroke-linecap="round" opacity="0.5"/>`

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
