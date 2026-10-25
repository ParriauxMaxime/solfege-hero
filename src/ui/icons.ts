export type IconName = 'back' | 'pause' | 'play' | 'sound-on' | 'sound-off' | 'settings' | 'stats' | 'close' | 'wave' | 'piano' | 'organ' | 'guitar' | 'check' | 'flame' | 'rotate'

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
  wave: '<path d="M2 12c2-7 4-7 6 0s4 7 6 0 4-7 6 0 1.5 3.5 2 3.5"/>',
  piano:
    '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M9 5v14"/><path d="M15 5v14"/><path d="M7 5v7"/><path d="M13 5v7"/><path d="M19 5v7"/>',
  organ: '<path d="M5 20V9l2-4 2 4v11"/><path d="M10 20V6l2-4 2 4v14"/><path d="M15 20V9l2-4 2 4v11"/><path d="M3 20h18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.5 1 2 1.5 2 .5-2 0-5 1.5-7.5z"/>',
  rotate: '<rect x="3" y="9" width="12" height="9" rx="2"/><path d="M7 5.5A8 8 0 0 1 20 8"/><path d="M20 3.5V8h-4.5"/>',
  guitar:
    '<path d="M14.5 9.5 20 4"/><path d="M18 3l3 3"/><path d="M11 7.5c2.5-.5 5 2 4.5 4.5 1.5.5 2 3 .5 5-2 2.5-5 3-7 2-1 1-4 1-5-1s-1-4 1-5c-.5-2 1.5-4.5 4-4.5"/><circle cx="10" cy="14" r="1.2"/>',
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
