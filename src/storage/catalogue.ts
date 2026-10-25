export interface CatalogueEntry {
  file: string
  title: string
  composer?: string
}

const SAFE_FILE_NAME = /^[\w][\w .()'-]*\.(musicxml|xml)$/i
const MAX_ENTRIES = 500
const MAX_TEXT_LENGTH = 120

function cleanText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.trim().slice(0, MAX_TEXT_LENGTH) || undefined
}

export function parseCatalogueIndex(raw: unknown): CatalogueEntry[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const entries: CatalogueEntry[] = []
  for (const item of raw.slice(0, MAX_ENTRIES)) {
    const candidate = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
    const file = cleanText(candidate.file)
    const title = cleanText(candidate.title)
    if (!file || !title || !SAFE_FILE_NAME.test(file) || seen.has(file)) continue
    seen.add(file)
    const composer = cleanText(candidate.composer)
    entries.push(composer ? { file, title, composer } : { file, title })
  }
  return entries
}

const normalizeTitle = (title: string) => title.trim().toLowerCase()

export function withoutCatalogued<T extends { name: string }>(builtins: T[], catalogue: CatalogueEntry[]): T[] {
  const catalogued = new Set(catalogue.map((entry) => normalizeTitle(entry.title)))
  return builtins.filter((builtin) => !catalogued.has(normalizeTitle(builtin.name)))
}

export function catalogueUrl(baseUrl: string, path: string): string {
  return `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}scores/${encodeURIComponent(path)}`
}

export async function fetchCatalogueIndex(baseUrl: string, fetcher: typeof fetch = fetch): Promise<CatalogueEntry[]> {
  try {
    const response = await fetcher(catalogueUrl(baseUrl, 'index.json'))
    return response.ok ? parseCatalogueIndex(await response.json()) : []
  } catch {
    return []
  }
}
