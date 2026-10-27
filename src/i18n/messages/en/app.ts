import type { Messages } from '../../messages'

export const app: Messages['app'] = {
  topBar: { home: 'Home', sound: 'Sound' },
  forcedLanguage: { message: 'Language of this link: {language}. Keep it?', keep: 'Keep' },
  abandon: { message: 'Quit the current game?', confirm: 'Quit', cancel: 'Continue' },
  soundBlocked: 'Sound blocked, tap the screen',
  dictationUnmuted: 'Sound back on for the dictation',
  scoreNotFound: 'Score not found',
  invalidScoreLink: 'Invalid score link',
  scoreAdded: 'Added to your library',
  scoreAlreadyAdded: 'Already in your library',
}
