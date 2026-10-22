# Feuille de route

## Version 1 (actuelle)

Cours 0, 1, 2 ; TD1, TD2 ; parcours, QCM, examen, flashcards, statistiques, PWA, export/import.

## Prochaines étapes de contenu

1. Cours 3 (diodes) + TD3 et TD4 : réutiliser la jonction PN ; nouveaux générateurs (point de fonctionnement, Zener).
2. Cours 4-5 (BJT) + TD5, TD6 ; cours 7 (FET) + TD7, TD8 ; cours 8 (CMOS) + TD9, TD10 ; TD11 de révisions.
3. Pour chaque ajout : notions et leçons (`src/content`), exercices avec 3 indices, QCM, flashcards, puis
   mise à jour de `CONTENT_AUDIT.md`. `npm test` contrôle la cohérence.

## Améliorations fonctionnelles envisagées

- Reproduction des figures du livret sous forme de schémas redessinés (si la diffusion est autorisée).
- Audit d’accessibilité automatisé (axe-core) dans la CI.
- Synchronisation entre appareils via un backend authentifié (format d’export déjà prêt).
- Assistant IA contextuel via backend sécurisé (jamais de clé dans le frontend).
- Statistiques par TD et prédiction de note à partir des examens blancs.

## Limites connues

- Pas de synchronisation automatique PC ↔ téléphone (export/import manuel).
- Q2.12 et ES2.7 demandent la lecture de figures du livret (autocorrection guidée).
- Les corrections des TD 1.5, 1.6, 2.4 et 2.5 sont calculées par ECE STUDY (absentes du livret).
