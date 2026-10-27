export const keys = {
  title: 'Armures',
  intro: 'Lis l’armure et touche la tonique de la gamme.',
  target: 'Tonalité à trouver',
  play: 'Jouer',
  mode: { major: 'Majeur', minor: 'Mineur relatif', both: 'Les deux' },
  question: { major: 'Gamme majeure ?', minor: 'Relatif mineur ?' },
  reveal: {
    majorWithRelative: '{major} · relatif {minor}',
    minorWithRelative: '{minor} · relatif de {major}',
  },
  hint: '{major} : {mnemonic}',
} as const
