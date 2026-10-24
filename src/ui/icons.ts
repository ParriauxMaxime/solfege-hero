export type IconName = 'back' | 'pause' | 'play' | 'sound-on' | 'sound-off' | 'settings' | 'stats' | 'close'

const SVG_NS = 'http://www.w3.org/2000/svg'

const PATHS: Record<IconName, string> = {
  back: '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
  pause: '<path d="M8 5v14"/><path d="M16 5v14"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  'sound-on': '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
  'sound-off': '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M22 9l-6 6"/><path d="M16 9l6 6"/>',
  settings:
    '<path d="M4 6h10"/><path d="M18 6h2"/><circle cx="16" cy="6" r="2"/><path d="M4 12h2"/><path d="M10 12h10"/><circle cx="8" cy="12" r="2"/><path d="M4 18h10"/><path d="M18 18h2"/><circle cx="16" cy="18" r="2"/>',
  stats: '<path d="M5 20V11"/><path d="M12 20V4"/><path d="M19 20v-7"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
}

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  svg.innerHTML = PATHS[name]
  return svg
}
