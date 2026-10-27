import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { normalizeSiteUrl, sitePaths } from './site-url.mjs'

const SITE = normalizeSiteUrl(process.env.VITE_SITE_URL)
const PAGES = sitePaths()
const REQUIRED = [
  'og:title',
  'og:description',
  'og:image',
  'og:url',
  'og:type',
  'og:image:width',
  'og:image:height',
  'twitter:card',
  'twitter:image',
]
const IMAGE_WIDTH = 1200
const IMAGE_HEIGHT = 630
const MAX_IMAGE_BYTES = 150 * 1024
const PNG_SIGNATURE = '89504e470d0a1a0a'
const IHDR_WIDTH_OFFSET = 16

const baseUrl = process.argv[2] ? new URL(process.argv[2]).href : null
const distDir = process.env.DIST_DIR ? pathToFileURL(`${resolve(process.env.DIST_DIR)}/`) : new URL('../dist/', import.meta.url)

async function loadBytes(path) {
  if (baseUrl) {
    const response = await fetch(new URL(path, baseUrl))
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`)
    return Buffer.from(await response.arrayBuffer())
  }
  return readFile(fileURLToPath(new URL(path, distDir)))
}

function parseTags(html) {
  const tags = new Map()
  for (const [tag] of html.matchAll(/<meta\s[^>]*>/gi)) {
    const key = /(?:property|name)\s*=\s*"([^"]+)"/i.exec(tag)?.[1]
    const content = /content\s*=\s*"([^"]*)"/i.exec(tag)?.[1]
    if (key && content !== undefined && /^(og|twitter):/.test(key)) tags.set(key, content)
  }
  return tags
}

function checkUrl(name, value, failures) {
  if (!value?.startsWith(SITE)) failures.push(`${name} is not an absolute URL under ${SITE}: ${value}`)
}

async function checkImage(imageUrl, failures) {
  const path = imageUrl.slice(SITE.length)
  let bytes
  try {
    bytes = await loadBytes(path)
  } catch (error) {
    failures.push(`og:image not readable (${path}): ${error.message}`)
    return
  }
  if (bytes.subarray(0, 8).toString('hex') !== PNG_SIGNATURE) {
    failures.push(`og:image is not a PNG: ${path}`)
    return
  }
  const width = bytes.readUInt32BE(IHDR_WIDTH_OFFSET)
  const height = bytes.readUInt32BE(IHDR_WIDTH_OFFSET + 4)
  if (width !== IMAGE_WIDTH || height !== IMAGE_HEIGHT) failures.push(`og:image is ${width}x${height}, expected ${IMAGE_WIDTH}x${IMAGE_HEIGHT}`)
  if (bytes.length >= MAX_IMAGE_BYTES) failures.push(`og:image is ${Math.round(bytes.length / 1024)} kB, expected < 150 kB`)
}

let failed = false

for (const page of PAGES) {
  const label = page === '' ? '(home)' : page
  const failures = []
  let tags = new Map()
  let canonical
  let lang
  try {
    const html = (await loadBytes(`${page}${baseUrl ? '' : 'index.html'}`)).toString('utf8')
    tags = parseTags(html)
    canonical = /<link\s+rel="canonical"\s+href="([^"]*)"/i.exec(html)?.[1]
    lang = /<html\s[^>]*lang="([^"]+)"/i.exec(html)?.[1]
  } catch (error) {
    failures.push(`page not readable: ${error.message}`)
  }

  console.log(`\n${label}`)
  for (const [key, value] of tags) console.log(`  ${key} = ${value}`)

  for (const key of REQUIRED) if (!tags.get(key)) failures.push(`missing ${key}`)
  if (!lang) failures.push('missing <html lang>')
  if (canonical !== tags.get('og:url')) failures.push(`canonical is ${canonical}, expected og:url ${tags.get('og:url')}`)
  checkUrl('og:url', tags.get('og:url'), failures)
  checkUrl('og:image', tags.get('og:image'), failures)
  checkUrl('twitter:image', tags.get('twitter:image'), failures)
  if (tags.get('og:url') && tags.get('og:url') !== `${SITE}${page}`) failures.push(`og:url is ${tags.get('og:url')}, expected ${SITE}${page}`)
  if (tags.get('og:image')?.startsWith(SITE)) await checkImage(tags.get('og:image'), failures)

  for (const failure of failures) console.log(`  FAIL ${failure}`)
  if (failures.length === 0) console.log('  OK')
  else failed = true
}

process.exit(failed ? 1 : 0)
