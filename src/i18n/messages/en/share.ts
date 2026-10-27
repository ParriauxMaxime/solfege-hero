import type { Messages } from '../../messages'

export const share: Messages['share'] = {
  header: 'Solfège hero · {title} · ⏱ {time}',
  firstTry: '{hits}/{total} on the first try',
  firstTryPenalty: '{hits}/{total} on the first try (+{seconds} s)',
  cta: 'Beat me!',
  ctaDaily: 'Play too!',
  survivalLine: 'Solfège hero · Survival #{seed} · 🎯 {notes} · {hearts}',
  title: {
    series: 'Series #{seed}',
    score: '“{name}”',
    dictation: 'Dictation #{seed}',
    daily: 'Daily challenge {date}',
  },
  dialog: {
    daily: 'Solfège hero: daily challenge',
    series: 'Solfège hero: Series challenge',
    survival: 'Solfège hero: Survival challenge',
    dictation: 'Solfège hero: Dictation challenge',
  },
}
