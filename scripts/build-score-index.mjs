import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'

const SCORES_DIR = new URL('../public/scores/', import.meta.url)
const EXTENSIONS = /\.(musicxml|xml)$/i

const decodeEntities = (text) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&')

function firstText(xml, pattern) {
  const match = xml.match(pattern)
  const text = match ? decodeEntities(match[1].replace(/<[^>]*>/g, '')).trim() : ''
  return text || undefined
}

function describeScore(file, xml) {
  const title =
    firstText(xml, /<work-title[^>]*>([\s\S]*?)<\/work-title>/) ??
    firstText(xml, /<movement-title[^>]*>([\s\S]*?)<\/movement-title>/) ??
    file.replace(EXTENSIONS, '')
  const composer = firstText(xml, /<creator[^>]*type="composer"[^>]*>([\s\S]*?)<\/creator>/)
  return composer ? { file, title, composer } : { file, title }
}

const files = (await readdir(SCORES_DIR)).filter((file) => EXTENSIONS.test(file))
const entries = []
for (const file of files) entries.push(describeScore(file, await readFile(new URL(file, SCORES_DIR), 'utf8')))
entries.sort((a, b) => a.title.localeCompare(b.title, 'fr') || a.file.localeCompare(b.file))
await mkdir(SCORES_DIR, { recursive: true })
await writeFile(new URL('index.json', SCORES_DIR), JSON.stringify(entries, null, 2) + '\n')
console.log(`${entries.length} partition(s) indexée(s)`)
