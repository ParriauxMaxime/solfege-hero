export const share = {
  header: 'Solfège hero · {title} · ⏱ {time}',
  firstTry: '{hits}/{total} du premier coup',
  firstTryPenalty: '{hits}/{total} du premier coup (+{seconds} s)',
  cta: 'Bats-moi !',
  ctaDaily: 'Joue aussi !',
  survivalLine: 'Solfège hero · Survie #{seed} · 🎯 {notes} · {hearts}',
  title: {
    series: 'Série #{seed}',
    score: '« {name} »',
    dictation: 'Dictée #{seed}',
    daily: 'Défi du jour {date}',
  },
  dialog: {
    daily: 'Solfège hero : défi du jour',
    series: 'Solfège hero : défi Séries',
    survival: 'Solfège hero : défi Survie',
    dictation: 'Solfège hero : défi Dictée',
  },
} as const
