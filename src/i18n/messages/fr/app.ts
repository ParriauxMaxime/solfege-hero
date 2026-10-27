export const app = {
  documentTitle: 'Solfège hero : apprendre à lire les notes',
  topBar: { home: 'Accueil', sound: 'Son' },
  forcedLanguage: { message: 'Langue de ce lien : {language}. La garder ?', keep: 'Garder' },
  abandon: { message: 'Abandonner la partie en cours ?', confirm: 'Abandonner', cancel: 'Continuer' },
  soundBlocked: 'Son bloqué, touche l’écran',
  dictationUnmuted: 'Son réactivé pour la dictée',
  scoreNotFound: 'Partition introuvable',
  invalidScoreLink: 'Lien de partition invalide',
  scoreAdded: 'Ajoutée à ta bibliothèque',
  scoreAlreadyAdded: 'Déjà dans ta bibliothèque',
} as const
