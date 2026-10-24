import { describe, expect, it } from 'vitest'
import { makeZip } from '../../scripts/zip.mjs'
import { unzip } from './unzip'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const toBuffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

describe('unzip', () => {
  it('reads deflated and stored entries', async () => {
    const text = 'Do Ré Mi '.repeat(50)
    const zip = await makeZip([
      { name: 'a.txt', data: encoder.encode(text) },
      { name: 'dir/b.txt', data: encoder.encode('stored'), deflate: false },
      { name: 'empty.txt', data: new Uint8Array(0) },
    ])
    const files = await unzip(toBuffer(zip))
    expect([...files.keys()]).toEqual(['a.txt', 'dir/b.txt', 'empty.txt'])
    expect(decoder.decode(files.get('a.txt'))).toBe(text)
    expect(decoder.decode(files.get('dir/b.txt'))).toBe('stored')
    expect(files.get('empty.txt')?.length).toBe(0)
  })

  it('actually compresses repetitive content', async () => {
    const data = encoder.encode('abcabcabc'.repeat(500))
    const zip = await makeZip([{ name: 'a.txt', data }])
    expect(zip.length).toBeLessThan(data.length / 4)
  })

  it('skips directory entries', async () => {
    const zip = await makeZip([
      { name: 'META-INF/', data: new Uint8Array(0), deflate: false },
      { name: 'META-INF/x.xml', data: encoder.encode('<x/>') },
    ])
    expect([...(await unzip(toBuffer(zip))).keys()]).toEqual(['META-INF/x.xml'])
  })

  it('rejects data that is not an archive', async () => {
    await expect(unzip(toBuffer(encoder.encode('definitely not a zip file at all')))).rejects.toThrow(
      'Archive .mxl illisible',
    )
    await expect(unzip(new ArrayBuffer(0))).rejects.toThrow('Archive .mxl illisible')
  })

  it('rejects a truncated archive', async () => {
    const zip = await makeZip([{ name: 'a.txt', data: encoder.encode('hello') }])
    await expect(unzip(toBuffer(zip.slice(0, zip.length - 10)))).rejects.toThrow('Archive .mxl illisible')
  })

  it('rejects unsupported compression methods in French', async () => {
    const zip = await makeZip([{ name: 'a.txt', data: encoder.encode('hello'), deflate: false }])
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
    for (let offset = 0; offset < zip.length - 4; offset++) {
      if (view.getUint32(offset, true) === 0x02014b50) view.setUint16(offset + 10, 12, true)
    }
    await expect(unzip(toBuffer(zip))).rejects.toThrow('Compression')
  })
})
