import type { Messages } from '../../messages'

export const home: Messages['home'] = {
  tagline: 'Learn to read notes on the staff',
  streakDays: '{days} d',
  accuracy: 'accuracy',
  time: 'time',
  score: 'score',
  scores: 'scores',
  lastImport: 'import',
  daily: { title: 'Daily challenge', notes: '20 notes' },
  modes: {
    learn: 'Learn',
    series: 'Series',
    dictation: 'Dictation',
    keys: 'Key signatures',
    survival: 'Survival',
    hero: 'Solfège hero',
    scores: 'Scores',
  },
  settings: 'Settings',
  stats: 'Stats',
  answers: '{count, plural, one {# answer} other {# answers}}',
}
