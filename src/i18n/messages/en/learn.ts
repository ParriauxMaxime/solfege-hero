import type { Messages } from '../../messages'

export const learn: Messages['learn'] = {
  title: 'Learn',
  play: 'Play',
  edit: 'Edit',
  clefs: 'Clefs: {names}',
  keyMode: { title: 'Key', random: 'Random', fixed: 'One key' },
  keyChange: { title: 'Key changes', short: '4–5 notes', ten: '10 notes', twenty: '20 notes', never: 'Never' },
  keyChip: 'Key: {label}. Edit',
  clefName: { treble: 'Treble', bass: 'Bass', alto: 'Alto' },
  clefLabel: { treble: 'Treble clef', bass: 'Bass clef', alto: 'Alto clef' },
  clefOf: { treble: 'treble', bass: 'bass', alto: 'alto' },
  aria: {
    note: 'Note on the {clef} clef staff',
    keySignature: 'Key signature on the {clef} clef staff',
    timeline: 'Staff, {clef} clef, {count, plural, one {# note} other {# notes}}',
    timelineEmpty: 'Staff',
  },
  rotate: 'Turn your phone: strict octave needs landscape mode.',
  game: {
    timeUp: 'Time’s up',
    correct: '{count, plural, one {correct answer} other {correct answers}}',
    newRecord: 'New record!',
    record: 'Best: {best}',
    replay: 'Play again',
    wrong: 'It was {note}',
    fast: '+{gained} ×{factor} fast!',
  },
}
