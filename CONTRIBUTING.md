# Proposer une partition

Le catalogue vit dans `public/scores/` : chaque fichier MusicXML y apparaît dans l'onglet Partitions, comme une partition intégrée.

## Avant de proposer

- La partition doit être dans le domaine public ou sous licence libre (CC0, CC BY, CC BY-SA). Indique la source et la licence dans la description de la PR.
- Une seule voix lisible : l'app lit la première partie, voix 1, et garde la note la plus haute des accords.
- Format `.musicxml` ou `.xml` non compressé (pas de `.mxl`), avec un `work-title` (ou `movement-title`) et, si possible, un compositeur (`creator type="composer"`).

## Étapes

1. Forke le dépôt et crée une branche.
2. Ajoute ton fichier dans `public/scores/` (nom en minuscules, sans accents ni dossiers, ex. `gymnopedie-1.musicxml`).
3. Lance `npm run dev` : l'index `public/scores/index.json` se régénère tout seul (il n'est pas versionné, ne le commite pas).
4. Ouvre Partitions, vérifie que le titre et le compositeur s'affichent, puis lance la partition en Hero et en Série.
5. Lance `npm test` : chaque fichier de `public/scores/` doit s'importer avec des notes.
6. Ouvre la PR.
