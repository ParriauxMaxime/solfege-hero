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
  en: { lang: 'en', pages: {} },
}
