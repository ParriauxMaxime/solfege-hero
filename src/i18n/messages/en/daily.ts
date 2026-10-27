import type { Messages } from '../../messages'

export const daily: Messages['daily'] = {
  title: 'Daily challenge',
  practice: 'Practice',
  late: 'Challenge of {date} (expired)',
  rankedDetails: '20 notes, treble clef, key signatures',
  practiceDetails: 'Practice, not counted in your score',
  level: 'Level {level} for everyone',
  yourScore: 'Your score today: {time}',
  play: 'Play',
  replayPractice: 'Play again (practice)',
  endHeadline: 'Daily challenge · {date}',
  streak: '{count, plural, one {# day in a row} other {# days in a row}}',
  best: 'Best challenge: {time}',
}
