import { describe, expect, it } from 'vitest'
import { child, children, parseXml, textOf } from './xml'

describe('parseXml', () => {
  it('parses nested elements, attributes and text', () => {
    const root = parseXml('<a id="1"><b>one</b><b>two</b><c x=\'y\'/></a>')
    expect(root.name).toBe('a')
    expect(root.attributes).toEqual({ id: '1' })
    expect(root.children.map((element) => element.name)).toEqual(['b', 'b', 'c'])
    expect(root.children[0]?.text).toBe('one')
    expect(root.children[2]?.attributes).toEqual({ x: 'y' })
  })

  it('skips the prolog, DOCTYPE and comments', () => {
    const root = parseXml(
      '﻿<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "x.dtd" [ <!ENTITY a "b"> ]>\n' +
        '<!-- a <fake> comment -->\n<root><!-- inside --><k>v</k></root>',
    )
    expect(root.name).toBe('root')
    expect(textOf(root, 'k')).toBe('v')
  })

  it('reads CDATA verbatim', () => {
    expect(parseXml('<a><![CDATA[<x> & y]]></a>').text).toBe('<x> & y')
  })

  it('decodes named and numeric entities in text and attributes', () => {
    const root = parseXml('<a t="&quot;q&quot; &amp; &#65;">&lt;&gt;&apos;&#x42;&amp;amp;</a>')
    expect(root.attributes.t).toBe('"q" & A')
    expect(root.text).toBe("<>'B&amp;")
  })

  it('keeps namespaces as plain names', () => {
    const root = parseXml('<ns:a xmlns:ns="urn:x"><ns:b xlink:href="u"/></ns:a>')
    expect(root.name).toBe('ns:a')
    expect(root.children[0]?.name).toBe('ns:b')
    expect(root.children[0]?.attributes['xlink:href']).toBe('u')
  })

  it('allows a greater-than sign inside an attribute value', () => {
    expect(parseXml('<a v="1 > 0"/>').attributes.v).toBe('1 > 0')
  })

  it('trims text around child elements', () => {
    expect(textOf(parseXml('<a>\n  <b>\n  hi \n</b>\n</a>'), 'b')).toBe('hi')
  })

  it('rejects malformed documents', () => {
    for (const bad of ['', 'text', '<a>', '<a></b>', '<a><b></a>', '<a b></a>', '<a b=c/>', '<a/><b/>', '<a><!-- x </a>']) {
      expect(() => parseXml(bad)).toThrow()
    }
  })
})

describe('helpers', () => {
  const root = parseXml('<r><a><b>deep</b></a><a>second</a><c/></r>')

  it('child returns the first match or undefined', () => {
    expect(child(root, 'a')?.children).toHaveLength(1)
    expect(child(root, 'zzz')).toBeUndefined()
  })

  it('children returns every match in order', () => {
    expect(children(root, 'a').map((element) => element.text)).toEqual(['', 'second'])
  })

  it('textOf follows a path and returns undefined when it breaks', () => {
    expect(textOf(root, 'a/b')).toBe('deep')
    expect(textOf(root, 'a/zzz')).toBeUndefined()
    expect(textOf(root, 'c')).toBe('')
  })
})
