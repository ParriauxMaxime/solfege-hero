// Usage: node scripts/make-mxl.mjs score.musicxml [out.mxl]
import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { makeZip } from './zip.mjs'

const [input, output = input.replace(/\.(musicxml|xml)$/i, '') + '.mxl'] = process.argv.slice(2)
if (!input) {
  console.error('Usage: node scripts/make-mxl.mjs score.musicxml [out.mxl]')
  process.exit(1)
}

const scoreName = basename(input)
const container = `<?xml version="1.0" encoding="UTF-8"?>
<container><rootfiles><rootfile full-path="${scoreName}" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>
`

const archive = await makeZip([
  { name: 'META-INF/container.xml', data: new TextEncoder().encode(container) },
  { name: scoreName, data: await readFile(input) },
])
await writeFile(output, archive)
console.log(`${output} written (${archive.length} bytes)`)
