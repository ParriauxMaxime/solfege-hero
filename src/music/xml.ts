export interface XmlElement {
  name: string
  attributes: Record<string, string>
  children: XmlElement[]
  text: string
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (match, body: string) => {
    if (body.startsWith('#x')) return String.fromCodePoint(parseInt(body.slice(2), 16))
    if (body.startsWith('#')) return String.fromCodePoint(parseInt(body.slice(1), 10))
    return NAMED_ENTITIES[body] ?? match
  })
}

function isWhitespace(char: string | undefined): boolean {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t'
}

function indexAfter(text: string, marker: string, from: number): number {
  const index = text.indexOf(marker, from)
  if (index === -1) throw new Error(`Missing ${marker}`)
  return index + marker.length
}

function skipDoctype(text: string, from: number): number {
  let depth = 0
  for (let i = from; i < text.length; i++) {
    if (text[i] === '[') depth++
    else if (text[i] === ']') depth--
    else if (text[i] === '>' && depth <= 0) return i + 1
  }
  throw new Error('Unterminated declaration')
}

interface OpeningTag {
  element: XmlElement
  selfClosing: boolean
  end: number
}

function readOpeningTag(text: string, start: number): OpeningTag {
  let i = start + 1
  const nameStart = i
  while (i < text.length && !isWhitespace(text[i]) && text[i] !== '/' && text[i] !== '>') i++
  const element: XmlElement = { name: text.slice(nameStart, i), attributes: {}, children: [], text: '' }
  if (element.name === '') throw new Error('Empty tag name')

  for (;;) {
    while (isWhitespace(text[i])) i++
    const char = text[i]
    if (char === undefined) throw new Error('Unterminated tag')
    if (char === '>') return { element, selfClosing: false, end: i + 1 }
    if (char === '/' && text[i + 1] === '>') return { element, selfClosing: true, end: i + 2 }

    const attributeStart = i
    while (i < text.length && text[i] !== '=' && !isWhitespace(text[i]) && text[i] !== '>') i++
    const attributeName = text.slice(attributeStart, i)
    while (isWhitespace(text[i])) i++
    if (text[i] !== '=') throw new Error(`Attribute without value: ${attributeName}`)
    i++
    while (isWhitespace(text[i])) i++
    const quote = text[i]
    if (quote !== '"' && quote !== "'") throw new Error('Unquoted attribute value')
    const valueEnd = text.indexOf(quote, i + 1)
    if (valueEnd === -1) throw new Error('Unterminated attribute value')
    element.attributes[attributeName] = decodeEntities(text.slice(i + 1, valueEnd))
    i = valueEnd + 1
  }
}

export function parseXml(source: string): XmlElement {
  const text = source.startsWith('﻿') ? source.slice(1) : source
  const stack: XmlElement[] = []
  let root: XmlElement | null = null
  let i = 0

  while (i < text.length) {
    if (text.startsWith('<!--', i)) {
      i = indexAfter(text, '-->', i + 4)
    } else if (text.startsWith('<![CDATA[', i)) {
      const end = text.indexOf(']]>', i)
      if (end === -1) throw new Error('Unterminated CDATA')
      const current = stack[stack.length - 1]
      if (current) current.text += text.slice(i + 9, end)
      i = end + 3
    } else if (text.startsWith('<?', i)) {
      i = indexAfter(text, '?>', i + 2)
    } else if (text.startsWith('<!', i)) {
      i = skipDoctype(text, i)
    } else if (text.startsWith('</', i)) {
      const end = indexAfter(text, '>', i)
      const closed = stack.pop()
      if (closed?.name !== text.slice(i + 2, end - 1).trim()) throw new Error('Mismatched closing tag')
      closed.text = closed.text.trim()
      i = end
    } else if (text[i] === '<') {
      const { element, selfClosing, end } = readOpeningTag(text, i)
      const parent = stack[stack.length - 1]
      if (parent) parent.children.push(element)
      else if (root) throw new Error('Several root elements')
      else root = element
      if (!selfClosing) stack.push(element)
      i = end
    } else {
      const next = text.indexOf('<', i)
      const end = next === -1 ? text.length : next
      const current = stack[stack.length - 1]
      if (current) current.text += decodeEntities(text.slice(i, end))
      i = end
    }
  }

  if (stack.length > 0) throw new Error('Unclosed element')
  if (!root) throw new Error('No root element')
  return root
}

export function child(element: XmlElement, name: string): XmlElement | undefined {
  return element.children.find((candidate) => candidate.name === name)
}

export function children(element: XmlElement, name: string): XmlElement[] {
  return element.children.filter((candidate) => candidate.name === name)
}

/** Text of the first element reached by following a "a/b/c" path of first children. */
export function textOf(element: XmlElement, path: string): string | undefined {
  let current: XmlElement | undefined = element
  for (const name of path.split('/')) {
    current = current && child(current, name)
  }
  return current?.text
}
