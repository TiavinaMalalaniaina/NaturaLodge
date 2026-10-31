# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/). Ce fichier n'existait
pas avant cette release — créé à cette occasion.

## [2.3.0] — 2026-10-29

> `package.json` (client et serveur), `server.ts` (`/health`) et `Settings.tsx` bumpés à `2.3.0`.
>
> Version **mineure** : uniquement additive — nouvelles colonnes/table nullables, nouvelle
> côté API ou UI existante. Aucune rupture de compatibilité.

### Ajouté

**Fonction de définition de mot de passe à la première connection**
- Migration SQL
  - colonne `resetPasswordToken`,`resetPasswordExpiries`,`isFirstLogin` sur la table user
- 

**Mis en place d'eslint**
- Vérification des plain-text



## [2.2.0] — 2026-09-15

> `package.json` (client et serveur), `server.ts` (`/health`) et `Settings.tsx` bumpés à `2.2.0`.
>
> Version **mineure** : uniquement de l'observabilité et un fix de déploiement, aucun changement de
> schéma ni de comportement fonctionnel. Rien à migrer ni à reseeder.

### Ajouté

**Stack de monitoring (VPS de production)**
- `docker-compose.monitoring.yml` : Prometheus, Grafana (dashboard « NaturaLodge — App Performance »
  préprovisionné), Loki + Promtail, node-exporter, cAdvisor, postgres-exporter, nginx-exporter,
  Uptime Kuma — voir `monitoring/README.md` pour l'installation et l'accès.
- `GET /metrics` (Prometheus, `server/src/middleware/metrics.ts`) : latence/débit/erreurs par route
  + métriques Node par défaut, jamais exposé publiquement (scrapé via le réseau Docker interne).
- Logs structurés JSON (`server/src/lib/logger.ts`, pino + `pino-http`), journalisation des requêtes
  Prisma lentes (`server/src/lib/prisma.ts`, seuil `SLOW_QUERY_THRESHOLD_MS`, 200 ms par défaut).
- `make monitoring-up` / `make monitoring-down` / `make monitoring-logs`.

### Corrigé
- Déploiement Coolify du conteneur `client` : `nginx.conf` proxyait `/api/` vers l'hôte fixe
  `server`, qui n'existe que dans le `docker-compose.yml` local — sur la VPS, `db`/`server`/`client`
  sont 3 ressources Coolify séparées et le conteneur backend n'a jamais eu ce nom, ce qui faisait
  planter nginx au démarrage (`host not found in upstream "server"`, crash loop). Remplacé par
  `client/nginx.conf.template` + `ENV API_UPSTREAM` (défaut `server`, substitué au démarrage du
  conteneur par l'entrypoint nginx officiel) — un seul Dockerfile pour les deux environnements.

### Notes de déploiement
```bash
# Ressource Coolify "client" : ajouter la variable d'environnement runtime
API_UPSTREAM=naturalodge-server-container
# (nom du conteneur backend sur la VPS — voir monitoring/README.md), puis redéployer.
```

## [2.1.0] — 2026-09-12

> `package.json` (client et serveur), `server.ts` (`/health`) et `Settings.tsx` bumpés à `2.1.0`.
>
> Version **mineure** : uniquement additive — nouvelles colonnes/table nullables, nouvelle
> permission qui dégrade proprement tant qu'elle n'est pas reseedée, aucun renommage ni suppression
> côté API ou UI existante. Aucune rupture de compatibilité.

### Ajouté

**Tableau de bord KPI hôteliers, réparti sur 3 pages**
- `/kpi` (occupation & revenu), `/kpi/billing` (facturation & encaissement), `/kpi/profitability`
  (rentabilité & structure des charges) — remplace l'ancien écran unique qui empilait les 3
  sections sans hiérarchie visuelle.
- Hiérarchie façon Z/F sur chaque page : un chiffre héros qui résume la page (taux d'occupation /
  encaissement net / résultat net), 2 métriques de second plan juste à côté, le détail (stats +
  tableaux) lu ensuite.
- Comparaison « vs mois précédent » (delta coloré) sur les métriques principales de chaque page.
- Objectif d'occupation mensuel éditable (`KpiOccupancyTarget`, nouvelle permission
  `kpi.manage_target`, ADMIN/MANAGER) comparé au taux réel directement sur `/kpi`.
- ADR/RevPAR théoriques et ligne TOTAL sur les tableaux « par type de chambre » / « par chambre ».
- `GET /kpi` accepte `detail=0` pour un calcul allégé (sans le détail par chambre) — utilisé pour
  le mois de comparaison, évite de doubler inutilement le coût de calcul par visite de page.

**Horodatage réel du check-in / check-out**
- `Booking.checkedInAt` / `checkedOutAt` : horodatage réel du geste (distinct des dates prévues
  `arrival`/`departure`), écrit par `PATCH /bookings/:id/status`, effacé si le geste est annulé
  (revert check-in).
- Nouveau statut effectif `due_checkout` : le jour du départ prévu, un séjour en cours passe en
  « Doit quitter » (alerte visuelle) avant de devenir « En retard » le lendemain seulement — sans
  aucun recalcul de facture automatique.
- Facture : dates réelles d'arrivée/départ affichées (repli sur les dates prévues tant que le
  check-in/check-out n'a pas eu lieu).

### Modifié
- Facture (`InvoiceView.tsx` / `InvoiceDocument.tsx`) : extraction de composants partagés
  (`InvoiceDocumentCard`, `InvoicePaymentForm`, `InvoicePaymentHistory`) qui éliminaient des
  divergences entre les deux pages (auteur/note d'un paiement absents sur l'une, date d'émission
  d'un brouillon mal protégée sur l'autre, libellés non traduits).
- Mise en page à l'impression de la facture : la barre latérale masquée ne laisse plus un tiers de
  page vide, marges de page ajoutées, une ligne du tableau ne se coupe plus entre deux pages.
- Bloc des totaux de facture rendu responsive (largeur bornée + alignement `justify-between`
  plutôt qu'un espacement fixe qui s'étirait sur grand écran).

### Corrigé
- Le mois sélectionné sur le tableau de bord KPI se réinitialisait en changeant d'onglet — le
  chargement à la demande du nouvel onglet remontait tout le layout parent (et son état local) ;
  le mois vit désormais dans l'URL et un `Suspense` local isole le rechargement à l'onglet lui-même.
- Libellés codés en dur non traduits sur la facture (en-têtes de tableau, statut de paiement,
  bouton Imprimer, champs « Notes ») — jamais rendus correctement en anglais ou en malgache.

### Notes de déploiement
```bash
cd server
npx prisma migrate deploy        # KpiOccupancyTarget + Booking.checkedInAt/checkedOutAt
                                  # (déjà câblé au démarrage du conteneur, rien à faire de plus)
npx tsx prisma/seedPermissions.ts # ou seed.init.ts — nécessaire pour que ADMIN/MANAGER voient le
                                   # contrôle d'édition de l'objectif d'occupation (kpi.manage_target)
```

## [2.0.0] — 2026-09-06

> `package.json` (client et serveur), `server.ts` (`/health`) et `Settings.tsx` bumpés à `2.0.0`.
>
> Version **majeure** : la mise à niveau n'est pas transparente — migrations de schéma **et** reseed
> des permissions obligatoires (voir *Rupture* et *Notes de déploiement*) — et le cycle de vie de la
> facturation change pour le personnel (brouillon → visé avant toute écriture comptable).

### Ajouté

**Cycle de vie des documents de facturation (brouillon → visé)**
- Une facture, un acompte ou un avoir naît en **brouillon** (`Invoice.validatedAt` nul) : librement
  modifiable, sans numéro, invisible du grand livre. `POST /invoices/:id/validate`
  (`can('invoices.validate')`) lui assigne son numéro définitif, cale sa date d'émission sur le visa
  et poste l'écriture comptable — seul et unique moment où un document touche le grand livre.
- `Invoice.number` devient nullable (attribué au visa) ; séquence propre par type — `INV-` / `ACO-`
  / `AVO-` —, comptée uniquement sur les documents déjà visés (aucun trou en cas de brouillon
  abandonné).
- Suppression d'un brouillon jamais visé — `DELETE /invoices/:id` (`can('invoices.delete_draft')`),
  aucun impact comptable.
- Modification du montant d'un brouillon d'acompte — `PATCH /invoices/:id` avec `amount`.
- Filtre « Brouillons uniquement » sur `/invoices`.

**Factures d'acompte (`DEPOSIT` / `ACO-`)**
- `POST /invoices/deposit` (`can('invoices.issue_deposit')`) — crée un brouillon d'acompte pour une
  réservation, indépendamment de la facture définitive ; montant et notes éditables tant qu'il n'est
  pas visé.
- Au visa : `411000` créance / `419100` « Clients — avances et acomptes reçus » (nouveau compte de
  passif) — aucun produit tant que le séjour n'a pas eu lieu.
- Au visa de la facture définitive : les acomptes visés de la réservation viennent en déduction
  (lignes négatives) et `419100` est soldé contre `411000`.
- Encaissement d'un acompte visé depuis sa page dédiée (`/invoices/document/:id`).
- Panneau « Acomptes en cours » sur `/reports` — acomptes visés pas encore absorbés par une facture
  définitive, pour tracer le solde `419100` réservation par réservation.

**Factures d'avoir (`CREDIT_NOTE` / `AVO-`)**
- Émises automatiquement à l'annulation d'un document **déjà visé** (jamais en modifiant l'original)
  — brouillon, `relatesToInvoiceId` vers le document crédité, montant = `refundRatePercent` % du
  total (défaut 70 %), le reste retenu comme frais d'annulation. Le personnel doit encore viser
  l'avoir pour qu'il produise ses effets.
- Taux de remboursement ajustable au moment du geste — champ dans la modale d'annulation de
  réservation (`refundRatePercent` sur `PATCH /bookings/:id/status`) et sur `POST /invoices/:id/cancel`.
- Visa d'un avoir sur **facture** : extourne produit / TVA / créance au prorata.
- Visa d'un avoir sur **acompte** : solde `419100` en entier — part remboursée vers `411000`, part
  retenue vers `708500` « Frais d'annulation retenus » (nouveau compte de produit).
- Remboursement d'un avoir visé : mouvement de trésorerie sortant depuis sa page (`411000` débit /
  compte de trésorerie crédit), borné à ce qui a réellement été encaissé sur le document crédité.
- Statut d'un avoir affiché avec le vocabulaire adapté (« À rembourser » / « Part. remboursé » /
  « Remboursé ») plutôt que « Payé ».

**Lignes de facture personnalisées et remises**
- Ligne libre (`InvoiceItem.source = MANUAL`) — charge exceptionnelle (prix unitaire positif) ou
  geste commercial ponctuel (négatif) : `POST /invoices/:id/items` + `PATCH` / `DELETE` associés
  (`can('invoices.update')`). Préservées lors des resynchronisations avec la réservation, qui ne
  réécrivent que les lignes `BOOKING`.
- Remises sur facture — `POST /invoices/:id/discounts` : en pourcentage (recalculée à chaque
  resynchronisation) ou en montant fixe, portées en contra-produit `709000`.

**Contrôle d'accès à la trésorerie par rôle**
- `RoleLedgerAccount` (`roleId × accountId` + `canTransferFrom` / `canTransferTo` /
  `canPayExpenses`) — l'administrateur décide, compte de trésorerie par compte de trésorerie, quels
  rôles le voient, peuvent le mettre en source ou en arrivée d'un virement, ou régler des charges
  depuis.
- Écran d'administration `/treasury-access` (ADMIN, `ledger.manage_accounts`).
- `ledger.access_all_accounts` (ADMIN / MANAGER) — voit tous les comptes et transfère sans
  restriction ; les rôles sans cette clé sont soumis aux grants `RoleLedgerAccount`.
- Contrôles `assertCanViewCashAccount` / `assertCanTransfer` / `assertCanPayExpenseFrom` appliqués
  sur l'encaissement, les virements et les dépenses.
- Accès à la page Trésorerie (`ledger.view_cash_accounts`) distinct de l'accès aux Rapports
  (`ledger.view_reports`).

**Configuration comptable (administration)**
- Plan comptable éditable depuis l'UI (création / modification de compte), types de dépense
  configurables.

**Réservation**
- La page réservation liste tous les documents de facturation (facture, acomptes, avoirs) avec accès
  direct à chacun, et permet de créer un acompte — la création redirige vers le document produit.

### Modifié
- `POST /invoices/generate` crée un **brouillon** — ne poste plus au grand livre (voir *Rupture*).
- `POST /invoices/:id/payments` refuse (409) un document non visé et devient directionnel :
  encaissement pour une facture / un acompte, remboursement pour un avoir.
- `DELETE /invoices/:id/payments/:paymentId` (`voidPayment`) — contre-écriture directionnelle selon
  le type de document.
- `syncInvoiceStatus` ne recalcule plus un statut terminal (`CANCELLED` / `REFUNDED`) à partir des
  seuls paiements.
- L'annulation d'une réservation produit une facture d'avoir **par document visé** (facture ET
  acompte) au lieu d'une extourne immédiate unique.
- `PATCH /invoices/:id` accepte `amount` (brouillon d'acompte uniquement).
- `ledger.manage_accounts` couvre désormais aussi la gestion des accès trésorerie.

### Corrigé
- Avoir sur un acompte jamais transformé en facture : l'extourne fabriquait un produit `706000`
  inexistant et laissait `419100` bloqué au bilan indéfiniment — désormais routée `419100` /
  `708500`, le passif soldé en entier.
- Une facture annulée repassait en « non payée » après annulation de son paiement (`voidPayment` →
  `syncInvoiceStatus` recalculait le statut à partir des seuls paiements) — les statuts terminaux
  sont maintenant préservés.
- Corrections d'affichage de la vue Trésorerie.

### Rupture
- **`POST /invoices/generate` ne poste plus au grand livre.** Le document créé est un brouillon ; il
  faut `POST /invoices/:id/validate` pour qu'il constate créance / produit / TVA. Toute automatisation
  qui supposait une facture immédiatement « vivante » doit ajouter cette étape.
- **`POST /invoices/:id/payments` renvoie 409 sur un document non visé.**
- **L'annulation d'une réservation ne solde plus la facture immédiatement** : elle crée des avoirs en
  brouillon, à viser puis à rembourser pour que le grand livre bouge.
- **`Invoice.number` est nullable** — tout code qui le lisait comme toujours défini doit gérer le cas
  brouillon.

### Notes de déploiement
```bash
cd server
npx prisma migrate deploy         # migrations 20260903* et 20260905* : InvoiceKind, Invoice.validatedAt,
                                  # number nullable, relatesToInvoiceId, InvoiceItem.source/discountRate,
                                  # RoleLedgerAccount, comptes 419100 / 708500, enum JournalSource CREDIT_NOTE
npx tsx prisma/seed.init.ts        # nouvelles clés de permission (invoices.issue_deposit, invoices.validate,
                                  # invoices.update, invoices.cancel, invoices.delete_draft,
                                  # ledger.access_all_accounts…) + comptes 419100 / 708500 — idempotent, additif
```
Puis **redémarrer le serveur** : le cache mémoire de la matrice de permissions (`lib/permissions.ts`)
n'est pas rafraîchi par un seed exécuté hors du process. Sans reseed + redémarrage, les nouvelles
fonctionnalités (création d'acompte, visa, suppression de brouillon…) restent masquées, sans erreur.

Recommandé : câbler le seed dans la commande de démarrage du conteneur —
`npx prisma migrate deploy && npm run db:seed:init && node dist/server.js` — `seed:init` étant
idempotent, rôles / permissions / plan comptable se resynchronisent à chaque déploiement.

⚠️ `DATABASE_SSL=false` ne vaut que pour une Postgres strictement locale : le laisser alors que
`DATABASE_URL` pointe une base gérée (Render…) coupe le SSL et la connexion échoue (`P1017`).

## [1.0.4] — 2026-08-30

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
