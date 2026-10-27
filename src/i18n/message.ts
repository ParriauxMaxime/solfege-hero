import type { Language } from './language'

export type MessageParams = Record<string, string | number>

interface PluralCase {
  selector: string
  body: Part[]
}
type Part = { text: string } | { param: string } | { plural: string; cases: PluralCase[] }

const NARROW_NO_BREAK_SPACE = ' '

function closingBrace(template: string, open: number): number {
  let depth = 0
  for (let index = open; index < template.length; index++) {
    if (template[index] === '{') depth++
    else if (template[index] === '}' && --depth === 0) return index
  }
  throw new Error(`unbalanced braces in "${template}"`)
}

function parseCases(source: string): PluralCase[] {
  const cases: PluralCase[] = []
  let index = 0
  while (index < source.length) {
    const rest = source.slice(index)
    const match = /^\s*(=\d+|zero|one|two|few|many|other)\s*\{/.exec(rest)
    if (!match) {
      if (rest.trim() === '') break
      throw new Error(`invalid plural case in "${source}"`)
    }
    const open = index + match[0].length - 1
    const close = closingBrace(source, open)
    cases.push({ selector: match[1] as string, body: parse(source.slice(open + 1, close)) })
    index = close + 1
  }
  if (!cases.some((entry) => entry.selector === 'other')) throw new Error(`plural without "other" in "${source}"`)
  return cases
}

function parse(template: string): Part[] {
  const parts: Part[] = []
  let index = 0
  while (index < template.length) {
    const open = template.indexOf('{', index)
    if (open === -1) break
    if (open > index) parts.push({ text: template.slice(index, open) })
    const close = closingBrace(template, open)
    const inner = template.slice(open + 1, close)
    const plural = /^\s*(\w+)\s*,\s*plural\s*,([\s\S]*)$/.exec(inner)
    if (plural) parts.push({ plural: plural[1] as string, cases: parseCases(plural[2] as string) })
    else if (/^\s*\w+\s*$/.test(inner)) parts.push({ param: inner.trim() })
    else throw new Error(`invalid placeholder {${inner}} in "${template}"`)
    index = close + 1
  }
  if (index < template.length) parts.push({ text: template.slice(index) })
  return parts
}

function collectNames(parts: Part[], names: Set<string>): void {
  for (const part of parts) {
    if ('param' in part) names.add(part.param)
    else if ('plural' in part) {
      names.add(part.plural)
      for (const entry of part.cases) collectNames(entry.body, names)
    }
  }
}

/** Parameter names used by a template; throws on invalid syntax. */
export function placeholderNames(template: string): string[] {
  const names = new Set<string>()
  collectNames(parse(template), names)
  return [...names].sort()
}

function render(parts: Part[], params: MessageParams, language: Language, formatNumber: (value: number) => string): string {
  const rules = new Intl.PluralRules(language === 'fr' ? 'fr-FR' : 'en-GB')
  const show = (value: string | number | undefined): string => (typeof value === 'number' ? formatNumber(value) : (value ?? ''))
  return parts
    .map((part) => {
      if ('text' in part) return part.text
      if ('param' in part) return show(params[part.param])
      const count = Number(params[part.plural] ?? 0)
      const chosen =
        part.cases.find((entry) => entry.selector === `=${count}`) ??
        part.cases.find((entry) => entry.selector === rules.select(count)) ??
        part.cases.find((entry) => entry.selector === 'other')
      return render(chosen?.body ?? [], params, language, formatNumber).replaceAll('#', formatNumber(count))
    })
    .join('')
}

/** French: narrow no-break space before ; : ! ? % and inside « ». */
export function typography(text: string, language: Language): string {
  if (language !== 'fr') return text
  return text.replace(/ (?=[;:!?%»])/g, NARROW_NO_BREAK_SPACE).replace(/(?<=«) /g, NARROW_NO_BREAK_SPACE)
}

export function formatMessage(
  template: string,
  params: MessageParams,
  language: Language,
  formatNumber: (value: number) => string,
): string {
  return typography(render(parse(template), params, language, formatNumber), language)
}
