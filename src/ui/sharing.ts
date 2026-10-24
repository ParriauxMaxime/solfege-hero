import type { Score } from '../hero/types'
import { toMusicXml } from '../music/musicxmlExport'
import { copyText } from '../platform/clipboard'
import { encodeScoreBlob, scoreLinkHash } from '../scores/link'
import { showToast } from './toast'

const MUSICXML_TYPE = 'application/vnd.recordare.musicxml+xml'

type ShareableScore = Pick<Score, 'name' | 'clef' | 'key' | 'tempo' | 'timeSignature' | 'notes'>

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function fileName(score: ShareableScore): string {
  const safe = score.name.replace(/[^\p{L}\p{N} _-]+/gu, '').trim().replace(/\s+/g, '-')
  return `${safe || 'partition'}.musicxml`
}

export async function shareOrCopy(text: string): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ text })
      return
    } catch (error) {
      if (isAbort(error)) return
    }
  }
  showToast((await copyText(text)) ? 'Copié !' : 'Copie impossible')
}

export function downloadScoreFile(score: ShareableScore): void {
  const blob = new Blob([toMusicXml(score)], { type: MUSICXML_TYPE })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName(score)
  link.click()
  URL.revokeObjectURL(link.href)
}

/** Link to open the score in the app, or null when it is too long to fit in a URL. */
export async function scoreLink(score: ShareableScore, timeS: number | null = null): Promise<string | null> {
  const blob = await encodeScoreBlob(score)
  if (blob === null) return null
  const challenge = timeS === null ? '' : `&t=${timeS}`
  return `${location.origin}${location.pathname}#${scoreLinkHash(blob)}${challenge}`
}

async function shareFile(score: ShareableScore): Promise<boolean> {
  const file = new File([toMusicXml(score)], fileName(score), { type: MUSICXML_TYPE })
  if (!navigator.canShare?.({ files: [file] })) return false
  try {
    await navigator.share({ files: [file], title: score.name })
    return true
  } catch (error) {
    return isAbort(error)
  }
}

export async function shareScore(score: ShareableScore): Promise<void> {
  if (await shareFile(score)) return
  const url = await scoreLink(score)
  if (url) {
    await shareOrCopy(`Partition « ${score.name} » sur Solfège hero : ${url}`)
    return
  }
  showToast('Partition trop longue pour un lien, envoie le fichier .musicxml')
  downloadScoreFile(score)
}
