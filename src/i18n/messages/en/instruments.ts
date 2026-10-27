import type { Messages } from '../../messages'

export const instruments: Messages['instruments'] = {
  label: { sine: 'Pure sine', piano: 'Piano', organ: 'Organ', guitar: 'Guitar' },
  description: {
    sine: 'A pure, soft tone',
    piano: 'Crisp attack, long resonance',
    organ: 'Sustained, warm tone',
    guitar: 'Plucked string, bright and lively',
  },
}
