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
- Plan comptable configurable (`LedgerAccount`) — 19 comptes de départ : trésorerie (Caisse,
  Mvola, 2× Orange Money, Banque BMOI, Banque BNI), tiers (Clients, Fournisseurs, TVA), charges
  (dont frais bancaires et de transfert), produits, capitaux propres.
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
- Virements entre comptes de trésorerie (`TRANSFER`) — ex: dépôt d'espèces en banque, avec frais
  de transfert optionnels (à la charge du compte source, comptabilisés en charge séparée
  `627000 Frais bancaires et de transfert`).
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

**Module de gestion des permissions**
- Matrice de permissions en base (`Permission` / `RolePermission`, 46 clés) remplaçant le
  contrôle d'accès codé en dur — chaque route est désormais gardée par `can(permissionKey)`
  (`middleware/can.ts`) au lieu de `authorize(...roles)`, résolu via un cache mémoire invalidé à
  chaque modification (`lib/permissions.ts`).
- Écran d'administration `/permissions` (ADMIN uniquement) — matrice à cocher par domaine,
  modification effective immédiatement, sans redéploiement. Garde-fou anti-verrouillage : impossible
  de retirer le dernier rôle habilité à gérer les permissions.
- `/auth/login` et `/auth/me` renvoient les permissions effectives du rôle ; le client s'appuie
  sur cette même source (`useAuth().can(key)`) au lieu de rejouer des vérifications de rôle
  dispersées dans chaque page.
- Boutons d'action reflétant désormais la permission réelle plutôt qu'une simple présence de
  route : équipements/suppléments consultables en lecture par tous mais modifiables seulement
  avec la permission dédiée, création de personnel réservée à `staff.create` (auparavant
  visible dès `staff.view`), etc. — audit exhaustif de tous les boutons de mutation de l'app.
- Deux nouvelles permissions dédiées au cycle de vie post-check-out (voir ci-dessous) :
  `bookings.checkout_unpaid` et `bookings.modify_after_checkout`.
- Rôle `RECEPTIONIST` renommé en `GERANT` (voir Modifié).

**Cycle de vie des réservations**
- Statut `CHECKED_OUT` scindé en `CHECKED_OUT_UNPAID` / `CHECKED_OUT_PAID`, déterminé
  automatiquement au moment du check-out selon l'état de la facture (jamais choisi par le client).
- Clôture définitive (`PATCH /:id/close`, statut `CLOSED`) — action manuelle séparée, réservée à
  la permission `bookings.close`, possible uniquement depuis `CHECKED_OUT_PAID`.
- Resynchronisation automatique : un paiement enregistré ou annulé après le check-out fait
  basculer le statut entre `CHECKED_OUT_UNPAID`/`CHECKED_OUT_PAID` tout seul, sans repasser par
  un geste manuel.
- Check-out d'une réservation impayée ou partiellement payée réservé à `bookings.checkout_unpaid`.
- Réassignation de chambre et gestion des chambres/suppléments d'une réservation déjà
  check-outée (mais pas encore clôturée) réservées à `bookings.modify_after_checkout` — ce
  garde-fou couvre aussi désormais la réassignation et la suppression de réservation
  (`reassign`/`remove`), qui n'étaient auparavant protégées par aucune vérification de statut.
- Statut de la réservation visible en badge sur la liste des factures (`/invoices`).
- Filtre par date ajouté à la liste des dépenses.

**Divers**
- Sidebar réorganisée en groupes dépliables (Général / Comptabilité / Administration) — le
  groupe contenant la page active s'ouvre automatiquement.

### Modifié
- `PATCH /invoices/:id` ne permet plus de modifier `status` directement (risque de désynchroniser
  la facture du grand livre) — passe désormais par le flux d'annulation dédié.
- Formulaire de paiement et filtres de la liste des paiements limités à Espèces / Mvola / Orange
  Money — Carte, Virement et En ligne retirés de l'UI tant qu'aucun compte bancaire réel n'existe.
- Rôle `RECEPTIONIST` renommé en `GERANT` — migration `ALTER TYPE ... RENAME VALUE`, atomique,
  sans script de correction séparé (comptes et permissions déjà en base migrés automatiquement).
- Réponses des listes paginées (réservations, factures, clients, chambres) allégées des relations
  jamais affichées par la vue liste (notes, suppléments, lignes de facture détaillées, historique
  de paiement complet…) — conservées sur les vues détail correspondantes.

### Corrigé
- Filtres de date (Trésorerie, Rapports) qui excluaient silencieusement une partie de la journée
  sélectionnée (`new Date("YYYY-MM-DD")` ancré à minuit UTC plutôt qu'en heure locale — décalage
  de 3h à Madagascar).
- Édition de `taxAmount` sur une facture déjà générée sans recalcul de `totalAmount` ni de
  l'écriture comptable associée (montant affiché et grand livre pouvaient diverger).
- Caractère non-ASCII dans le libellé automatique d'un virement provoquant une erreur d'encodage
  pour les clients `psql` non-UTF8 (courant sous Windows/FR).
- `ledger.view_cash_accounts` jamais accordée à RECEPTIONIST/HOUSEKEEPING en base malgré le
  catalogue de permissions qui le prévoyait — dérive entre le seed initial et le catalogue
  source, jamais rattrapée par un reseed (empêchait un réceptionniste de choisir un compte au
  moment d'enregistrer un paiement).

### Notes de déploiement
Nouvelles étapes à exécuter une fois lors de la mise en production (voir aussi
`prisma/seedChartOfAccounts.ts` et `prisma/seed.init.ts`, déjà existants) :
```bash
cd server
npx tsx prisma/seed.init.ts             # compte ADMIN + plan comptable + permissions (idempotent)
npx tsx prisma/backfillLedgerHistory.ts # écritures pour l'historique déjà en base (une fois)
npx tsx prisma/backfillCheckoutStatus.ts # convertit les CHECKED_OUT historiques en UNPAID/PAID (une fois)
```
`seed.init.ts` seed désormais aussi la matrice de permissions (`seedPermissions`) et les 3 comptes
ajoutés depuis (Banque BMOI, Banque BNI, frais bancaires) — rien de plus à faire pour ceux-ci que
relancer `seed.init.ts`, upsert idempotent et additif comme le reste.

Les migrations de schéma s'appliquent automatiquement au démarrage du conteneur
(`prisma migrate deploy`, déjà câblé dans `server/Dockerfile`), y compris le renommage
`RECEPTIONIST` → `GERANT` et l'ajout des statuts `CHECKED_OUT_UNPAID`/`CHECKED_OUT_PAID`/`CLOSED`.
