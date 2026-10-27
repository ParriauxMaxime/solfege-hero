import { t } from '../i18n'

const END_OF_CENTRAL_DIRECTORY = 0x06054b50
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50
const LOCAL_FILE_HEADER = 0x04034b50
const END_RECORD_SIZE = 22
const MAX_COMMENT_SIZE = 0xffff
const STORED = 0
const DEFLATED = 8

const archiveError = () => new Error(t('library.errors.unreadableArchive'))

function findEndRecord(view: DataView): number {
  const lowest = Math.max(0, view.byteLength - END_RECORD_SIZE - MAX_COMMENT_SIZE)
  for (let offset = view.byteLength - END_RECORD_SIZE; offset >= lowest; offset--) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY) return offset
  }
  throw archiveError()
}

async function inflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([compressed as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function unzip(data: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const view = new DataView(data)
  const bytes = new Uint8Array(data)
  const decoder = new TextDecoder()
  const files = new Map<string, Uint8Array>()

  try {
    const end = findEndRecord(view)
    const entryCount = view.getUint16(end + 10, true)
    let entry = view.getUint32(end + 16, true)

    for (let index = 0; index < entryCount; index++) {
      if (view.getUint32(entry, true) !== CENTRAL_DIRECTORY_ENTRY) throw archiveError()
      const method = view.getUint16(entry + 10, true)
      const compressedSize = view.getUint32(entry + 20, true)
      const nameLength = view.getUint16(entry + 28, true)
      const extraLength = view.getUint16(entry + 30, true)
      const commentLength = view.getUint16(entry + 32, true)
      const localOffset = view.getUint32(entry + 42, true)
      const name = decoder.decode(bytes.subarray(entry + 46, entry + 46 + nameLength))
      entry += 46 + nameLength + extraLength + commentLength

      if (name.endsWith('/')) continue
      if (view.getUint32(localOffset, true) !== LOCAL_FILE_HEADER) throw archiveError()
      const dataStart =
        localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true)
      const content = bytes.subarray(dataStart, dataStart + compressedSize)

      if (method === STORED) files.set(name, content.slice())
      else if (method === DEFLATED) files.set(name, await inflateRaw(content))
      else throw new Error(t('library.errors.unsupportedCompression'))
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Compression')) throw error
    throw archiveError()
  }
  return files
}
