import type { Messages } from '../../messages'

export const level: Messages['level'] = {
  tier: { beginner: 'Beginner', apprentice: 'Apprentice', reader: 'Reader', virtuoso: 'Virtuoso' },
  caps: {
    noKeys: 'No key signature',
    allKeys: 'All key signatures',
    keysUpTo: 'Keys up to {count}♯/{count}♭',
    noLedger: 'no ledger lines',
    ledger: '{count, plural, one {# ledger line} other {# ledger lines}}',
    accidentals: 'accidentals',
    noAccidentals: 'no accidentals',
  },
  pill: { label: 'Level {level} · {tier}', aria: 'Level {level}, {tier}. Adjust' },
  up: 'Level {from} → {to}',
  tip: { bass: 'Ready for the bass clef?', alto: 'And the alto clef?', add: 'Add' },
}
