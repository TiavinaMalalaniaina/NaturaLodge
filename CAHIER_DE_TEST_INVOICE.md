# Cahier de Test — Module Factures & Paiements
**Projet :** NaturaLodge Hotel Management  
**Module :** Invoice & Payment  
**Date :** 2026-05-30  
**Branches :** `feature/reservation-calendar-and-implementation`

---

## Légende

| Symbole | Signification |
|---------|--------------|
| ✅ | Passé |
| ❌ | Échoué |
| ⏭ | Ignoré / Non applicable |
| 🔄 | En cours |

**Colonnes de résultat à remplir :** Statut · Remarques · Date

---

## 1. Prérequis

- Backend démarré sur `http://localhost:4000`
- Frontend démarré sur `http://localhost:3000`
- Base de données PostgreSQL accessible et migrée
- Au moins **une réservation** existante en base (statut `CONFIRMED` ou `CHECKED_IN`)
- Comptes disponibles :
  - `ADMIN` — accès total
  - `MANAGER` — peut annuler les paiements
  - `RECEPTIONIST` — peut générer et encaisser
  - `HOUSEKEEPING` — accès restreint

---

## 2. Tests API Backend

> Utiliser Postman, Insomnia ou `curl`. Tous les endpoints nécessitent un header `Authorization: Bearer <token>`.

### 2.1 Génération de facture

| ID | Description | Méthode & URL | Body | Résultat attendu | Statut | Remarques |
|----|-------------|--------------|------|-----------------|--------|-----------|
| API-01 | Générer une facture pour une réservation valide | `POST /api/invoices/generate` | `{ "bookingId": "<id>", "taxRate": 20 }` | `201` — Facture créée avec `status: PENDING`, lignes de chambre calculées, `taxAmount > 0` | | |
| API-02 | Idempotence : générer deux fois pour la même réservation | `POST /api/invoices/generate` (même bookingId) | idem | `200` — Retourne la facture existante, **pas de doublon** | | |
| API-03 | Générer sans `bookingId` | `POST /api/invoices/generate` | `{}` | `400` — Erreur de validation Zod | | |
| API-04 | Générer pour une réservation inexistante | `POST /api/invoices/generate` | `{ "bookingId": "fakeid" }` | `404` — `Réservation introuvable` | | |
| API-05 | Générer avec `taxRate: 0` | `POST /api/invoices/generate` | `{ "bookingId": "<id>", "taxRate": 0 }` | `201` — `taxAmount: 0`, `totalAmount = subtotal` | | |
| API-06 | Générer avec `notes` et `dueAt` | `POST /api/invoices/generate` | `{ "bookingId": "<id>", "taxRate": 10, "notes": "Paiement à l'arrivée", "dueAt": "2026-06-01T00:00:00.000Z" }` | `201` — Champs `notes` et `dueAt` présents dans la réponse | | |

### 2.2 Lecture des factures

| ID | Description | Méthode & URL | Résultat attendu | Statut | Remarques |
|----|-------------|--------------|-----------------|--------|-----------|
| API-07 | Lister toutes les factures | `GET /api/invoices` | `200` — Objet `{ data: [...], meta: { total, page, limit, totalPages } }` | | |
| API-08 | Filtrer par statut `PENDING` | `GET /api/invoices?status=PENDING` | `200` — Seules les factures `PENDING` retournées | | |
| API-09 | Paginer (page 2, limit 5) | `GET /api/invoices?page=2&limit=5` | `200` — Max 5 résultats, `meta.page = 2` | | |
| API-10 | Récupérer la facture d'une réservation | `GET /api/invoices/booking/<bookingId>` | `200` — Facture avec `booking`, `items`, `payments` inclus | | |
| API-11 | Booking sans facture | `GET /api/invoices/booking/<bookingId-sans-facture>` | `404` — `Aucune facture pour cette réservation` | | |
| API-12 | Récupérer une facture par ID | `GET /api/invoices/<invoiceId>` | `200` — Facture complète | | |
| API-13 | ID de facture inexistant | `GET /api/invoices/fakeid` | `404` — `Facture introuvable` | | |

### 2.3 Mise à jour de facture

| ID | Description | Méthode & URL | Body | Résultat attendu | Statut | Remarques |
|----|-------------|--------------|------|-----------------|--------|-----------|
| API-14 | Modifier les notes | `PATCH /api/invoices/<id>` | `{ "notes": "VIP client" }` | `200` — Champ `notes` mis à jour | | |
| API-15 | Modifier la date d'échéance | `PATCH /api/invoices/<id>` | `{ "dueAt": "2026-07-01T00:00:00.000Z" }` | `200` — `dueAt` mis à jour | | |
| API-16 | Modifier le statut manuellement (ADMIN/MANAGER) | `PATCH /api/invoices/<id>` | `{ "status": "CANCELLED" }` | `200` — Statut `CANCELLED` | | |
| API-17 | Tentative sans droits suffisants (RECEPTIONIST) | `PATCH /api/invoices/<id>` | `{ "notes": "test" }` | `403` — Accès refusé | | |

### 2.4 Paiements

| ID | Description | Méthode & URL | Body | Résultat attendu | Statut | Remarques |
|----|-------------|--------------|------|-----------------|--------|-----------|
| API-18 | Enregistrer un paiement partiel (cash) | `POST /api/invoices/<id>/payments` | `{ "amount": 50000, "method": "CASH" }` | `201` — Facture retournée avec `status: PARTIALLY_PAID`, paiement dans `payments[]` | | |
| API-19 | Enregistrer un paiement soldant la facture | `POST /api/invoices/<id>/payments` | `{ "amount": <montant_restant>, "method": "CARD" }` | `201` — Facture `status: PAID`, `paidAt` renseigné | | |
| API-20 | Payer une facture déjà soldée | `POST /api/invoices/<id>/payments` (status=PAID) | `{ "amount": 1000, "method": "CASH" }` | `409` — `Cette facture ne peut plus recevoir de paiement` | | |
| API-21 | Payer une facture annulée | `POST /api/invoices/<id>/payments` (status=CANCELLED) | `{ "amount": 1000, "method": "CASH" }` | `409` — Même erreur | | |
| API-22 | Paiement avec référence et notes | `POST /api/invoices/<id>/payments` | `{ "amount": 20000, "method": "BANK_TRANSFER", "reference": "TXN-9981", "notes": "Virement reçu" }` | `201` — `reference` et `notes` présents dans le paiement | | |
| API-23 | Paiement avec montant négatif | `POST /api/invoices/<id>/payments` | `{ "amount": -100, "method": "CASH" }` | `400` — Erreur de validation | | |
| API-24 | Annuler (void) un paiement (ADMIN/MANAGER) | `DELETE /api/invoices/<id>/payments/<paymentId>` | — | `200` — Paiement `status: REFUNDED`, statut facture recalculé | | |
| API-25 | Void interdit pour RECEPTIONIST | `DELETE /api/invoices/<id>/payments/<paymentId>` (token RECEPTIONIST) | — | `403` — Accès refusé | | |

---

## 3. Tests Frontend — InvoiceModal (depuis BookingDetail)

> Naviguer vers `Réservations → [une réservation] → bouton "Invoice"`.

### 3.1 État "Pas de facture"

| ID | Description | Précondition | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|-------------|--------|-----------------|--------|-----------|
| UI-01 | Affichage de l'état vide | Aucune facture pour la réservation | Ouvrir la modal | Icône alerte + texte `"No invoice for this booking"` + formulaire de génération visible | | |
| UI-02 | Champ Taux TVA par défaut | — | Observer le champ TVA | Valeur `0` par défaut | | |
| UI-03 | Champ date d'échéance vide | — | Observer le champ | Champ vide, optionnel | | |
| UI-04 | Génération sans TVA | — | Laisser TVA à 0, cliquer "Generate Invoice" | Spinner affiché → facture créée → document affiché automatiquement | | |
| UI-05 | Génération avec TVA 20% | — | Saisir `20` dans TVA, cliquer "Generate Invoice" | Facture créée avec `taxAmount = 20% du subtotal` | | |
| UI-06 | Génération avec date d'échéance | — | Saisir une date, générer | Champ `Due date` affiché dans le document | | |
| UI-07 | Bouton désactivé pendant la requête | — | Cliquer "Generate Invoice" rapidement | Bouton avec texte `"Generating…"`, non cliquable | | |
| UI-08 | HOUSEKEEPING ne voit pas le formulaire | Se connecter en HOUSEKEEPING | Ouvrir la modal | Message "no invoice" visible mais **pas de formulaire** de génération | | |

### 3.2 Document de facture

| ID | Description | Précondition | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|-------------|--------|-----------------|--------|-----------|
| UI-09 | Numéro de facture affiché | Facture existante | Ouvrir la modal | Format `INV-2026-XXXX` dans le header et dans le document | | |
| UI-10 | Badge de statut correct | Facture `PENDING` | Ouvrir | Badge `"Pending"` avec fond amber | | |
| UI-11 | Infos client | — | Lire section "Bill To" | Nom et email du client correct | | |
| UI-12 | Lignes de facture | Réservation multi-chambres | Ouvrir | Une ligne par chambre avec : description (type + numéro), quantité (nuits), P.U. (tarif nuitée), total | | |
| UI-13 | Calcul sous-total | — | Observer section totaux | Sous-total = somme des lignes | | |
| UI-14 | Calcul TVA | Facture avec taxRate > 0 | Observer | Ligne TVA affichée avec montant correct | | |
| UI-15 | Total général | — | Observer | Total = Sous-total + TVA | | |
| UI-16 | Montant restant | Paiement partiel enregistré | Ouvrir | Ligne "Remaining" affichée en rouge avec solde correct | | |
| UI-17 | Montant payé | — | Observer | Ligne "Paid" en vert | | |
| UI-18 | Notes de facture | Facture avec `notes` | Ouvrir | Notes affichées en bas du document en italique | | |
| UI-19 | Bouton Print | — | Cliquer "Print" | Dialogue d'impression navigateur ouvert | | |

### 3.3 Enregistrement d'un paiement

| ID | Description | Précondition | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|-------------|--------|-----------------|--------|-----------|
| UI-20 | Section "Record Payment" absente si facture PAID | Facture `PAID` | Ouvrir la modal | Section "Record Payment" **non visible** | | |
| UI-21 | Section absente si facture CANCELLED | Facture `CANCELLED` | Ouvrir | Idem | | |
| UI-22 | Afficher le formulaire | Facture `PENDING` | Cliquer "Record Payment" | Formulaire animé apparaît (height 0 → auto) | | |
| UI-23 | Champs du formulaire | — | Observer | Champs : Montant, Méthode (select), Référence, Notes | | |
| UI-24 | Méthodes disponibles | — | Ouvrir le select Méthode | Options : Cash, Card, Bank Transfer, Online | | |
| UI-25 | Enregistrer un paiement cash | — | Saisir montant, méthode Cash, confirmer | Modal mise à jour : paiement dans l'historique, statut recalculé | | |
| UI-26 | Solde automatique | Montant = reste à payer | Enregistrer | Statut facture passe à `PAID`, badge vert | | |
| UI-27 | Paiement partiel | Montant < total | Enregistrer | Statut passe à `PARTIALLY_PAID`, badge bleu | | |
| UI-28 | Bouton Confirm désactivé si montant vide | — | Laisser montant vide | Bouton `"Confirm"` grisé/désactivé | | |
| UI-29 | Fermer le formulaire sans payer | — | Cliquer "Cancel" | Formulaire se ferme avec animation | | |
| UI-30 | État chargement pendant envoi | — | Cliquer "Confirm" | Texte `"Saving…"`, bouton désactivé | | |
| UI-31 | Formulaire réinitialisé après succès | — | Enregistrer un paiement | Champs vidés, formulaire fermé | | |

### 3.4 Historique des paiements

| ID | Description | Précondition | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|-------------|--------|-----------------|--------|-----------|
| UI-32 | Message "No payments" | Aucun paiement | Observer section historique | Texte `"No payments recorded"` | | |
| UI-33 | Affichage d'un paiement | Un paiement enregistré | Observer | Montant, méthode traduite, date, nom du staff | | |
| UI-34 | Badge statut paiement | Paiement `completed` | Observer | Badge `"completed"` vert | | |
| UI-35 | Référence affichée | Paiement avec référence | Observer | `#<référence>` en police mono sous la date | | |
| UI-36 | Bouton void visible (ADMIN/MANAGER) | Paiement `completed` | Se connecter ADMIN, ouvrir | Icône poubelle visible sur le paiement | | |
| UI-37 | Bouton void absent (RECEPTIONIST) | — | Se connecter RECEPTIONIST | Icône poubelle **non visible** | | |
| UI-38 | Annuler un paiement | ADMIN ou MANAGER connecté | Cliquer la poubelle | Paiement passe à `"refunded"` (badge violet), statut facture recalculé | | |
| UI-39 | Paiement annulé ne peut plus être void | — | Observer après void | Bouton void absent sur le paiement `refunded` | | |

---

## 4. Tests Frontend — Page Invoices (`/invoices`)

### 4.1 Affichage général

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| UI-40 | Accès via navigation | Cliquer "Invoices" dans le sidebar | Page `/invoices` chargée, titre affiché | | |
| UI-41 | Compteur de factures | Observer le sous-titre | Affiche `"X invoice(s)"` avec le total réel | | |
| UI-42 | Liste des factures | Factures en base | Observer | Cartes avec : numéro (mono), badge statut, nom client, date d'émission, montant total | | |
| UI-43 | Montant restant affiché | Factures `PARTIALLY_PAID` | Observer les cartes | Ligne `"Remaining: X Ar"` en rouge sous le montant | | |
| UI-44 | Montant restant absent si PAID | Facture PAID | Observer | Pas de ligne "Remaining" | | |
| UI-45 | Animation d'entrée | Charger la page | Les cartes apparaissent avec animation décalée | | |
| UI-46 | État vide | Aucune facture | Observer | Icône FileText + message `"No invoices found"` | | |

### 4.2 Filtres par statut

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| UI-47 | Filtre "All" par défaut | Charger la page | Bouton "All" actif (fond primary) | | |
| UI-48 | Filtrer par "Pending" | Cliquer "Pending" | Seules les factures `pending` affichées, page remise à 1 | | |
| UI-49 | Filtrer par "Paid" | Cliquer "Paid" | Seules les factures `paid` | | |
| UI-50 | Filtrer par "Part. paid" | Cliquer tab | Factures `partially_paid` | | |
| UI-51 | Filtrer par "Refunded" | Cliquer tab | Factures `refunded` | | |
| UI-52 | Filtrer par "Cancelled" | Cliquer tab | Factures `cancelled` | | |
| UI-53 | Retour à "All" | Cliquer "All" après un filtre | Toutes les factures à nouveau | | |

### 4.3 Recherche

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| UI-54 | Recherche par numéro de facture | Saisir `INV-2026` dans le champ | Seules les factures dont le numéro contient la chaîne | | |
| UI-55 | Recherche par nom de client | Saisir le nom d'un client | Factures filtrées par nom | | |
| UI-56 | Recherche insensible à la casse | Saisir en majuscules | Résultats identiques à une recherche en minuscules | | |
| UI-57 | Bouton clear (×) | Saisir du texte, observer | Bouton `×` apparaît | | |
| UI-58 | Vider la recherche | Cliquer `×` | Champ vidé, liste complète restaurée | | |
| UI-59 | Aucun résultat | Saisir texte sans correspondance | Message `"No invoices found"` avec icône | | |

### 4.4 Pagination

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| UI-60 | Pagination absente si ≤ 20 factures | < 20 factures en base | Pas de contrôles de pagination | | |
| UI-61 | Contrôles visibles si > 20 factures | > 20 factures | Boutons `← Prev` / `Next →` et `Page X of Y` | | |
| UI-62 | Bouton Prev désactivé (page 1) | Être sur page 1 | Bouton `← Prev` grisé | | |
| UI-63 | Bouton Next désactivé (dernière page) | Aller à la dernière page | Bouton `Next →` grisé | | |
| UI-64 | Navigation vers page suivante | Cliquer `Next →` | Page 2 chargée, factures suivantes affichées | | |
| UI-65 | Changement de filtre remet page à 1 | Être sur page 2, changer filtre | Retour à page 1 | | |

### 4.5 Ouverture de la modal

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| UI-66 | Cliquer une carte | Cliquer n'importe quelle carte | `InvoiceModal` s'ouvre avec la facture correcte | | |
| UI-67 | Fermer la modal | Cliquer `×` ou le fond | Modal fermée, liste inchangée | | |
| UI-68 | Payer depuis la liste | Ouvrir modal, enregistrer un paiement | Modal mise à jour en temps réel | | |
| UI-69 | Changer de facture | Fermer modal, en ouvrir une autre | La bonne facture s'affiche | | |

---

## 5. Tests d'intégration — Flux complet

| ID | Scénario | Étapes | Résultat attendu | Statut | Remarques |
|----|---------|--------|-----------------|--------|-----------|
| INT-01 | Flux complet : réservation → facture → paiement total | 1. Créer réservation · 2. Ouvrir BookingDetail · 3. Générer facture · 4. Enregistrer paiement égal au total | Facture `PAID`, `paidAt` renseigné, badge vert | | |
| INT-02 | Flux paiement partiel puis solde | 1. Générer facture · 2. Payer 50% · 3. Vérifier `PARTIALLY_PAID` · 4. Payer le reste · 5. Vérifier `PAID` | Transitions de statut correctes à chaque étape | | |
| INT-03 | Void d'un paiement repasse en PENDING | 1. Payer intégralement (PAID) · 2. Void le paiement (ADMIN) | Statut repasse à `PENDING`, "Remaining" correct | | |
| INT-04 | Cohérence entre BookingDetail et page /invoices | 1. Générer facture depuis BookingDetail · 2. Naviguer vers /invoices | La facture apparaît dans la liste | | |
| INT-05 | Idempotence affichée en UI | 1. Ouvrir modal sans facture · 2. Générer · 3. Fermer et rouvrir la modal | La même facture est affichée (pas de doublon) | | |
| INT-06 | Rechargement de page préserve l'état | 1. Générer facture · 2. Rafraîchir le navigateur · 3. Rouvrir la modal | Facture toujours présente | | |

---

## 6. Tests de contrôle d'accès (RBAC)

| ID | Rôle | Action | Résultat attendu | Statut | Remarques |
|----|------|--------|-----------------|--------|-----------|
| RBAC-01 | ADMIN | Toutes les actions | Accès complet | | |
| RBAC-02 | MANAGER | Générer, payer, void | Accès complet | | |
| RBAC-03 | RECEPTIONIST | Générer, payer | Succès | | |
| RBAC-04 | RECEPTIONIST | Void d'un paiement | Bouton void **absent** en UI · `403` en API direct | | |
| RBAC-05 | RECEPTIONIST | PATCH /invoices/:id | `403` en API direct | | |
| RBAC-06 | HOUSEKEEPING | Voir le formulaire de génération | Formulaire **non affiché** en UI | | |
| RBAC-07 | Non authentifié | N'importe quel endpoint | `401 Unauthorized` | | |

---

## 7. Tests de robustesse UI

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| ROB-01 | Backend indisponible — liste | Couper le backend, charger /invoices | Composant `PageError` affiché | | |
| ROB-02 | Backend indisponible — modal | Ouvrir la modal sans backend | Spinner puis pas de crash (erreur gérée) | | |
| ROB-03 | Fermer la modal pendant le chargement | Ouvrir et fermer immédiatement | Pas d'erreur React, pas de memory leak | | |
| ROB-04 | Double clic sur "Generate" | Cliquer deux fois rapidement | Une seule facture créée (bouton désactivé pendant la requête) | | |
| ROB-05 | Double clic sur "Confirm" (paiement) | Cliquer deux fois rapidement | Un seul paiement créé | | |
| ROB-06 | i18n — passer en Français | Changer la langue → FR | Tous les labels traduits : `"Facture"`, `"Payée"`, `"En attente"`, `"Espèces"`, etc. | | |
| ROB-07 | i18n — passer en Malagasy | Changer la langue → MG | Labels traduits en malgache | | |
| ROB-08 | Scroll dans la modal | Facture avec beaucoup de lignes | Scroll interne sans déplacer la page derrière | | |
| ROB-09 | Responsive mobile | Réduire à < 640px | Modal et page liste utilisables, pas de débordement | | |

---

## 8. Récapitulatif

| Catégorie | Nb de tests | Passés | Échoués | Ignorés |
|-----------|-------------|--------|---------|---------|
| API Backend | 25 | | | |
| UI InvoiceModal | 39 | | | |
| UI Page /invoices | 30 | | | |
| Intégration | 6 | | | |
| RBAC | 7 | | | |
| Robustesse | 9 | | | |
| **TOTAL** | **116** | | | |

---

*Cahier généré le 2026-05-30 — NaturaLodge Hotel Management*
