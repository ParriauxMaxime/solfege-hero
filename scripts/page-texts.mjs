export const PAGE_IMAGES = {
  home: 'og.png',
  learn: 'og-learn.png',
  keys: 'og-keys.png',
  series: 'og-series.png',
  dictation: 'og-dictee.png',
  survival: 'og-survie.png',
  hero: 'og-hero.png',
  scores: 'og-scores.png',
  stats: 'og.png',
  settings: 'og.png',
  daily: 'og-jour.png',
  challenge: 'og-defi.png',
  score: 'og-partition.png',
}

const HOME_DESCRIPTION =
  'Application gratuite pour apprendre à lire les notes sur la portée : clés de sol, fa et ut, séries chronométrées, survie, mode rythmique et partitions MusicXML, hors ligne.'

export const PAGE_TEXTS = {
  fr: {
    lang: 'fr',
    pages: {
      home: {
        title: 'Solfège hero : apprendre à lire les notes',
        description: HOME_DESCRIPTION,
        h1: 'Solfège hero',
        intro:
          'Application gratuite pour apprendre à lire les notes sur la portée, hors ligne. Apprendre, Séries, Dictée, Armures, Survie, Solfège hero et Partitions.',
        imageAlt: 'Solfège hero : apprendre à lire les notes',
      },
      learn: {
        title: 'Apprendre les notes · Solfège hero',
        description: 'Apprendre à lire les notes sur la portée, une à la fois, avec un tirage adapté à vos erreurs.',
        h1: 'Apprendre les notes',
        intro:
          'Une note à la fois sur la portée, à retrouver sur le clavier. Le tirage est adaptatif : les notes ratées ou lentes reviennent plus souvent, avec un chrono de 60 s en option.',
        imageAlt: 'Apprendre à lire les notes sur la portée',
      },
      keys: {
        title: 'Armures · Solfège hero',
        description: 'Reconnaître la tonalité d’une armure : dièses et bémols, tonalité majeure ou relative mineure.',
        h1: 'Armures',
        intro:
          'Une armure s’affiche après la clé, de 0 à 7 dièses ou bémols. Il faut répondre la tonique majeure, la relative mineure ou les deux, selon le réglage.',
        imageAlt: 'Armures : reconnaître la tonalité',
      },
      series: {
        title: 'Séries · Solfège hero',
        description: 'Séries de 20 notes chronométrées, +5 s par erreur, avec des défis à partager à un ami.',
        h1: 'Séries',
        intro:
          'Vingt notes à lire le plus vite possible, avec 5 s de pénalité par erreur. Chaque série peut être partagée par lien pour qu’un ami joue la même et batte votre temps.',
        imageAlt: 'Séries : 20 notes à lire le plus vite possible',
      },
      dictation: {
        title: 'Dictée musicale · Solfège hero',
        description: 'Dictée musicale : 20 notes à retrouver à l’oreille, chronométrées, avec des défis à partager.',
        h1: 'Dictée musicale',
        intro:
          'Vingt notes sont jouées, à retrouver à l’oreille sur le clavier. Le temps est compté, 5 s s’ajoutent par erreur, et la série peut être partagée en défi.',
        imageAlt: 'Dictée : 20 notes à retrouver à l’oreille',
      },
      survival: {
        title: 'Survie · Solfège hero',
        description: 'Survie : 3 vies, un temps limité par note et une difficulté qui monte, tiens le plus longtemps possible.',
        h1: 'Survie',
        intro:
          'Trois vies, 3 s ou 5 s par note avec une barre qui se vide. La difficulté augmente toutes les 20 bonnes réponses, et un score peut être partagé en défi.',
        imageAlt: 'Survie : 3 vies, tiens plus longtemps',
      },
      hero: {
        title: 'Solfège hero : lire en rythme',
        description: 'Une portée qui défile : jouez les notes en rythme sur un métronome, avec des défis de 16 mesures à partager.',
        h1: 'Solfège hero',
        intro:
          'La portée défile et chaque note doit être jouée au bon moment, avec les durées réelles et un métronome. Le tempo s’adapte à vos réussites, et un défi de 16 mesures peut être partagé.',
        imageAlt: 'Solfège hero : 16 mesures en rythme',
      },
      scores: {
        title: 'Partitions · Solfège hero',
        description: 'Bibliothèque de partitions MusicXML à jouer en Solfège hero ou en série, avec import de fichiers, PDF et photos.',
        h1: 'Partitions',
        intro:
          'Une bibliothèque de partitions MusicXML à jouer en mode Solfège hero ou en série. Vos fichiers MusicXML, PDF ou photos peuvent être importés et restent sur votre appareil.',
        imageAlt: 'Partitions MusicXML à jouer',
      },
      stats: {
        title: 'Statistiques · Solfège hero',
        description: 'Statistiques de progression : activité, précision et temps de réponse par mode, notes à retravailler.',
        h1: 'Statistiques',
        intro:
          'Un calendrier d’activité sur 16 semaines et des courbes de précision et de temps de réponse pour chaque mode. Les notes et armures les plus difficiles y sont listées.',
        imageAlt: 'Statistiques de progression sur Solfège hero',
      },
      settings: {
        title: 'Réglages · Solfège hero',
        description: 'Réglages de Solfège hero : niveau, clés, armures, affichage, son et sauvegarde des données.',
        h1: 'Réglages',
        intro:
          'Le niveau, les clés et les armures travaillées, l’affichage (thème, daltonisme, mouvement réduit) et le son se règlent ici. Les données se sauvegardent et se restaurent en JSON.',
        imageAlt: 'Réglages de Solfège hero',
      },
      daily: {
        title: 'Défi du jour · Solfège hero',
        description: 'Défi du jour Solfège hero : la même série de notes pour tout le monde aujourd’hui',
        h1: 'Défi du jour',
        intro:
          'Chaque jour, une série de 20 notes identique pour tous les joueurs, à un niveau fixe. Les essais suivants sont comptés comme entraînement, et le lien se partage.',
        imageAlt: 'Défi du jour : la même série pour tout le monde',
      },
      challenge: {
        title: 'Défi Séries · Solfège hero',
        description: 'Un ami te défie sur Solfège hero : 20 notes, bats son temps',
        h1: 'Défi Séries',
        intro: 'Un ami te défie sur Solfège hero : 20 notes, bats son temps. Ouvre le lien pour jouer la même série que lui.',
        imageAlt: 'Défi Séries : 20 notes à lire le plus vite possible',
      },
      score: {
        title: 'Partition partagée · Solfège hero',
        description: 'Une partition partagée sur Solfège hero : ouvre-la et joue-la',
        h1: 'Partition partagée',
        intro: 'Une partition partagée sur Solfège hero : ouvre-la et joue-la. Elle peut être ajoutée à votre bibliothèque.',
        imageAlt: 'Une partition partagée à jouer sur Solfège hero',
      },
    },
  },
  en: {
    lang: 'en',
    pages: {
      home: {
        title: 'Solfège hero: learn to read music notes',
        description:
          'Free app to learn to read notes on the staff: treble, bass and alto clefs, timed series, survival, rhythm mode and MusicXML scores, offline.',
        h1: 'Solfège hero',
        intro:
          'Free app to learn to read notes on the staff, offline. Learn, Key signatures, Series, Dictation, Survival, Solfège hero and Scores.',
        imageAlt: 'Solfège hero: learn to read music notes',
      },
      learn: {
        title: 'Learn the notes · Solfège hero',
        description: 'Learn to read notes on the staff, one at a time, with a draw that adapts to your mistakes.',
        h1: 'Learn the notes',
        intro:
          'One note at a time on the staff, to find on the keyboard. The draw is adaptive: missed or slow notes come back more often, with an optional 60 s timer.',
        imageAlt: 'Learn to read notes on the staff',
      },
      keys: {
        title: 'Key signatures · Solfège hero',
        description: 'Recognise the key of a key signature: sharps and flats, major key or relative minor.',
        h1: 'Key signatures',
        intro:
          'A key signature appears after the clef, with 0 to 7 sharps or flats. Answer with the major tonic, the relative minor or both, depending on the setting.',
        imageAlt: 'Key signatures: recognise the key',
      },
      series: {
        title: 'Series · Solfège hero',
        description: 'Timed series of 20 notes, +5 s per mistake, with challenges to share with a friend.',
        h1: 'Series',
        intro:
          'Twenty notes to read as fast as you can, with a 5 s penalty per mistake. Every series can be shared by link so a friend plays the same one and tries to beat your time.',
        imageAlt: 'Series: 20 notes to read as fast as possible',
      },
      dictation: {
        title: 'Music dictation · Solfège hero',
        description: 'Music dictation: 20 notes to find by ear, against the clock, with challenges to share.',
        h1: 'Music dictation',
        intro:
          'Twenty notes are played, to find by ear on the keyboard. Time is counted, 5 s are added per mistake, and the series can be shared as a challenge.',
        imageAlt: 'Dictation: 20 notes to find by ear',
      },
      survival: {
        title: 'Survival · Solfège hero',
        description: 'Survival: 3 lives, a time limit per note and a rising difficulty. Last as long as you can.',
        h1: 'Survival',
        intro:
          'Three lives, 3 s or 5 s per note with a draining bar. Difficulty goes up every 20 correct answers, and a score can be shared as a challenge.',
        imageAlt: 'Survival: 3 lives, last longer',
      },
      hero: {
        title: 'Solfège hero: read in rhythm',
        description: 'A scrolling staff: play the notes in rhythm over a metronome, with 16-bar challenges to share.',
        h1: 'Solfège hero',
        intro:
          'The staff scrolls and each note must be played at the right moment, with real durations and a metronome. The tempo adapts to how well you play, and a 16-bar challenge can be shared.',
        imageAlt: 'Solfège hero: 16 bars in rhythm',
      },
      scores: {
        title: 'Scores · Solfège hero',
        description: 'Library of MusicXML scores to play in Solfège hero or as a series, with file, PDF and photo import.',
        h1: 'Scores',
        intro:
          'A library of MusicXML scores to play in Solfège hero mode or as a series. Your MusicXML files, PDFs or photos can be imported and stay on your device.',
        imageAlt: 'MusicXML scores to play',
      },
      stats: {
        title: 'Stats · Solfège hero',
        description: 'Progress stats: activity, accuracy and response time per mode, and the notes to work on.',
        h1: 'Stats',
        intro:
          'A 16-week activity calendar and accuracy and response time curves for each mode. The hardest notes and key signatures are listed there.',
        imageAlt: 'Progress stats on Solfège hero',
      },
      settings: {
        title: 'Settings · Solfège hero',
        description: 'Solfège hero settings: level, clefs, key signatures, display, sound and data backup.',
        h1: 'Settings',
        intro:
          'Level, practised clefs and key signatures, display (theme, colour blindness, reduced motion) and sound are set here. Data can be saved and restored as JSON.',
        imageAlt: 'Solfège hero settings',
      },
      daily: {
        title: 'Daily challenge · Solfège hero',
        description: 'Solfège hero daily challenge: the same series of notes for everyone today',
        h1: 'Daily challenge',
        intro:
          'Every day, a series of 20 notes identical for all players, at a fixed level. Later attempts count as practice, and the link can be shared.',
        imageAlt: 'Daily challenge: the same series for everyone',
      },
      challenge: {
        title: 'Series challenge · Solfège hero',
        description: 'A friend challenges you on Solfège hero: 20 notes, beat their time',
        h1: 'Series challenge',
        intro: 'A friend challenges you on Solfège hero: 20 notes, beat their time. Open the link to play the same series.',
        imageAlt: 'Series challenge: 20 notes to read as fast as possible',
      },
      score: {
        title: 'Shared score · Solfège hero',
        description: 'A score shared on Solfège hero: open it and play it',
        h1: 'Shared score',
        intro: 'A score shared on Solfège hero: open it and play it. It can be added to your library.',
        imageAlt: 'A shared score to play on Solfège hero',
      },
    },
  },
}
