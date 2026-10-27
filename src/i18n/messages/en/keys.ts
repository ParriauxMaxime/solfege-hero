import type { Messages } from '../../messages'

export const keys: Messages['keys'] = {
  title: 'Key signatures',
  intro: 'Read the key signature and tap the tonic of the scale.',
  target: 'Key to find',
  play: 'Play',
  mode: { major: 'Major', minor: 'Relative minor', both: 'Both' },
  question: { major: 'Major scale?', minor: 'Relative minor?' },
  reveal: {
    majorWithRelative: '{major} · relative {minor}',
    minorWithRelative: '{minor} · relative of {major}',
  },
  hint: '{major}: {mnemonic}',
}
