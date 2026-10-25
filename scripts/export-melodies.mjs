import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'vite'

const EXPORTS = [
  { name: 'Ode à la joie', title: 'Ode à la joie', composer: 'Ludwig van Beethoven', file: 'ode-a-la-joie.musicxml' },
  { name: 'Greensleeves', title: 'Greensleeves', composer: 'Traditionnel', file: 'greensleeves.musicxml' },
  { name: 'Canon (Pachelbel)', title: 'Canon (Pachelbel)', composer: 'Johann Pachelbel', file: 'canon-pachelbel.musicxml' },
]

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const { MELODIES } = await server.ssrLoadModule('/src/music/melodies.ts')
  const { toMusicXml } = await server.ssrLoadModule('/src/music/musicxmlExport.ts')
  await mkdir('public/scores', { recursive: true })
  for (const { name, title, composer, file } of EXPORTS) {
    const melody = MELODIES.find((candidate) => candidate.name === name)
    if (!melody) throw new Error(`Mélodie introuvable : ${name}`)
    const timeSignature = melody.timeSignature ?? { beats: 4, beatType: 4 }
    await writeFile(`public/scores/${file}`, toMusicXml({ ...melody, timeSignature, name: title, composer }) + '\n')
    console.log(file)
  }
} finally {
  await server.close()
}
