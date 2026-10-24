const encoder = new TextEncoder()

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let value = n
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

async function deflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function concat(parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function record(size, write) {
  const bytes = new Uint8Array(size)
  write(new DataView(bytes.buffer))
  return bytes
}

const UTF8_FLAG = 0x0800
const DOS_DATE_1980 = 0x21

/**
 * Builds a zip archive. Each entry is stored or deflated (raw deflate, method 8).
 * @param {{ name: string, data: Uint8Array, deflate?: boolean }[]} entries
 * @returns {Promise<Uint8Array>}
 */
export async function makeZip(entries) {
  const chunks = []
  const directory = []
  let offset = 0

  for (const { name, data, deflate = true } of entries) {
    const nameBytes = encoder.encode(name)
    const payload = deflate ? await deflateRaw(data) : data
    const method = deflate ? 8 : 0
    const crc = crc32(data)

    const local = record(30, (view) => {
      view.setUint32(0, 0x04034b50, true)
      view.setUint16(4, 20, true)
      view.setUint16(6, UTF8_FLAG, true)
      view.setUint16(8, method, true)
      view.setUint16(12, DOS_DATE_1980, true)
      view.setUint32(14, crc, true)
      view.setUint32(18, payload.length, true)
      view.setUint32(22, data.length, true)
      view.setUint16(26, nameBytes.length, true)
    })
    const central = record(46, (view) => {
      view.setUint32(0, 0x02014b50, true)
      view.setUint16(4, 20, true)
      view.setUint16(6, 20, true)
      view.setUint16(8, UTF8_FLAG, true)
      view.setUint16(10, method, true)
      view.setUint16(14, DOS_DATE_1980, true)
      view.setUint32(16, crc, true)
      view.setUint32(20, payload.length, true)
      view.setUint32(24, data.length, true)
      view.setUint16(28, nameBytes.length, true)
      view.setUint32(42, offset, true)
    })

    chunks.push(local, nameBytes, payload)
    directory.push(central, nameBytes)
    offset += local.length + nameBytes.length + payload.length
  }

  const directoryBytes = concat(directory)
  const end = record(22, (view) => {
    view.setUint32(0, 0x06054b50, true)
    view.setUint16(8, entries.length, true)
    view.setUint16(10, entries.length, true)
    view.setUint32(12, directoryBytes.length, true)
    view.setUint32(16, offset, true)
  })
  return concat([...chunks, directoryBytes, end])
}
