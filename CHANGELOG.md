# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/). Ce fichier n'existait
pas avant cette release — créé à cette occasion.

## [1.0.4] — Non publié

> `package.json` (client et serveur), `server.ts` (`/health`) et `Settings.tsx` (build
> identifier) bumpés à `1.0.4`, cohérents avec le nom de la branche `release/V1.0.4`.
>
> ⚠️ `release/V1.0.4` diverge de `main` (6 merges `develop` absents) et est en retard sur
> `preprod` (10 merges `develop` supplémentaires absents). À synchroniser avant merge si besoin —
> non traité dans ce document, qui ne couvre que le contenu de la release.

### Ajouté

**Module de comptabilité (partie double)**
- Plan comptable configurable (`LedgerAccount`) — 16 comptes de départ : trésorerie (Caisse,
  Mvola, 2× Orange Money), tiers (Clients, Fournisseurs, TVA), charges, produits, capitaux propres.
- Grand livre (`JournalEntry` / `JournalLine`) — chaque facturation, encaissement, dépense,
  virement, apport ou annulation poste automatiquement une écriture équilibrée (Σdébit = Σcrédit
  vérifié avant tout commit).
- Facturation → écriture `INVOICE` (créance client + produit + TVA collectée), y compris
  l'ajustement automatique quand une facture déjà générée est resynchronisée après modification
  de la réservation.
- Encaissement → écriture `PAYMENT` ; le compte de trésorerie réel (Caisse, Mvola, Orange
  Money N°1/N°2) est choisi au moment du paiement, et le sélecteur ne propose que les comptes
  compatibles avec la méthode choisie (`allowedMethods`).
- Annulation de paiement → écriture `PAYMENT_VOID`.
- Dépenses (`Expense`, catégorisées : fournitures, eau/électricité, entretien, marketing,
  salaires, autres) → écriture `EXPENSE`.
- Virements entre comptes de trésorerie (`TRANSFER`) — ex: dépôt d'espèces en banque.
- Apports externes / capital propriétaire (`CONTRIBUTION`) — alimente le compte `101000 Capital`.
- Annulation de facture (`POST /invoices/:id/cancel`) — extourne automatiquement la part non
  encaissée (créance + produit + TVA au prorata) ; déclenchée aussi automatiquement, dans la même
  transaction, quand la réservation liée est annulée.
- Tableau de bord Trésorerie (`/treasury`) — solde en temps réel par compte, relevé façon relevé
  bancaire filtrable par période, résumé revenu facturé vs réellement encaissé, dépenses par
  catégorie.
- Rapports (`/reports`) — bilan simplifié (actif / passif / capitaux propres) à une date donnée
  avec vérification d'équilibre, compte de résultat sur une période, export CSV du grand livre
  pour transmission à un expert-comptable.
- Script `prisma/backfillLedgerHistory.ts` — reconstitue rétroactivement les écritures
  comptables pour les factures/paiements créés avant l'introduction du module (idempotent,
  rejouable sans risque de doublon).

**Système d'audit**
- Journalisation automatique de toute requête mutante authentifiée (qui, quelle action, sur
  quelle ressource, avec quel résultat, quand) — capture générique au niveau middleware, couvre
  l'ensemble de l'API sans instrumentation route par route.
- Mots de passe automatiquement masqués dans les corps de requête enregistrés.
- Consultation sur `/audit-log`, réservée aux comptes ADMIN.

**Divers**
- Sidebar réorganisée en groupes dépliables (Général / Comptabilité / Administration) — le
  groupe contenant la page active s'ouvre automatiquement.

### Modifié
- `PATCH /invoices/:id` ne permet plus de modifier `status` directement (risque de désynchroniser
  la facture du grand livre) — passe désormais par le flux d'annulation dédié.
- Formulaire de paiement et filtres de la liste des paiements limités à Espèces / Mvola / Orange
  Money — Carte, Virement et En ligne retirés de l'UI tant qu'aucun compte bancaire réel n'existe.

### Corrigé
- Filtres de date (Trésorerie, Rapports) qui excluaient silencieusement une partie de la journée
  sélectionnée (`new Date("YYYY-MM-DD")` ancré à minuit UTC plutôt qu'en heure locale — décalage
  de 3h à Madagascar).
- Édition de `taxAmount` sur une facture déjà générée sans recalcul de `totalAmount` ni de
  l'écriture comptable associée (montant affiché et grand livre pouvaient diverger).
- Caractère non-ASCII dans le libellé automatique d'un virement provoquant une erreur d'encodage
  pour les clients `psql` non-UTF8 (courant sous Windows/FR).

### Notes de déploiement
Nouvelles étapes à exécuter une fois lors de la mise en production (voir aussi
`prisma/seedChartOfAccounts.ts` et `prisma/seed.init.ts`, déjà existants) :
```bash
cd server
npx tsx prisma/seed.init.ts             # compte ADMIN + plan comptable (idempotent)
npx tsx prisma/backfillLedgerHistory.ts # écritures pour l'historique déjà en base (une fois)
```
Les migrations de schéma s'appliquent automatiquement au démarrage du conteneur
(`prisma migrate deploy`, déjà câblé dans `server/Dockerfile`).
