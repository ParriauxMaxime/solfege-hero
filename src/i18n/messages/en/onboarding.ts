import type { Messages } from '../../messages'

export const onboarding: Messages['onboarding'] = {
  title: 'Where are you at?',
  lead: 'The game then adapts to you.',
  skip: 'Skip',
  beginner: { title: 'I’m a beginner', description: 'Notes on the staff, no key signature or accidentals' },
  slow: { title: 'I read slowly', description: 'Accidentals and simple key signatures' },
  fluent: { title: 'I already read', description: 'Key signatures up to 4 sharps or flats, one more ledger line' },
}
