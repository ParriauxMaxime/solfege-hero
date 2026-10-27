export const level = {
  tier: { beginner: 'Débutant', apprentice: 'Apprenti', reader: 'Lecteur', virtuoso: 'Virtuose' },
  caps: {
    noKeys: 'Pas d’armure',
    allKeys: 'Toutes les armures',
    keysUpTo: 'Armures jusqu’à {count}♯/{count}♭',
    noLedger: 'pas de ligne supplémentaire',
    ledger: '{count, plural, one {# ligne supplémentaire} other {# lignes supplémentaires}}',
    accidentals: 'altérations',
    noAccidentals: 'pas d’altérations',
  },
  pill: { label: 'Niveau {level} · {tier}', aria: 'Niveau {level}, {tier}. Régler' },
  up: 'Niveau {from} → {to}',
  tip: { bass: 'Prêt pour la clé de fa ?', alto: 'Et la clé d’ut ?', add: 'Ajouter' },
} as const
