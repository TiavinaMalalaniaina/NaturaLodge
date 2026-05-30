# Cahier de Test — Module Réservations
**Projet :** NaturaLodge Hotel Management  
**Module :** Reservations / Bookings  
**Date :** 2026-05-30  
**Branche :** `feature/reservation-calendar-and-implementation`

---

## Légende

| Symbole | Signification |
|---------|--------------|
| ✅ | Passé |
| ❌ | Échoué |
| ⏭ | Ignoré / Non applicable |
| 🔄 | En cours |

---

## Prérequis

- Backend démarré sur `http://localhost:4000`
- Frontend démarré sur `http://localhost:3000`
- Base de données PostgreSQL migrée avec données de test
- Au moins **3 chambres** disponibles (dont 1 en maintenance)
- Au moins **2 clients** (guests) créés, dont 1 VIP (classification `VIP_ELITE` ou `PLATINUM_TIER`)
- Comptes disponibles :
  - `ADMIN` — accès total
  - `MANAGER` — peut supprimer
  - `RECEPTIONIST` — peut créer / modifier le statut
  - `HOUSEKEEPING` — lecture seule

---

## 1. Système de Statut Effectif

> Le `effectiveStatus` est une valeur calculée à partir du statut DB + la date/heure actuelle. Il n'est pas persisté.

### Table de correspondance

| DB Status | Condition temporelle | effectiveStatus attendu |
|-----------|---------------------|------------------------|
| `CANCELLED` | toujours | `cancelled` |
| `CHECKED_OUT` | toujours | `checked_out` |
| `CHECKED_IN` | `now <= departure` | `in_progress` |
| `CHECKED_IN` | `now > departure` | `overdue` |
| `CONFIRMED` | `now < arrival` ET arrival ≠ aujourd'hui | `upcoming` |
| `CONFIRMED` | arrival = aujourd'hui (même date calendaire) | `due_checkin` |
| `CONFIRMED` | `arrival <= now <= departure` | `due_checkin` |
| `CONFIRMED` | `now > departure` | `overdue` |

### Tests statut effectif

| ID | Description | Précondition | Résultat attendu | Statut | Remarques |
|----|-------------|-------------|-----------------|--------|-----------|
| EFF-01 | Réservation future (arrivée dans 3 jours) | `CONFIRMED`, arrival = J+3 | Badge `"Upcoming"` · fond teal clair | | |
| EFF-02 | Arrivée aujourd'hui | `CONFIRMED`, arrival = aujourd'hui | Badge `"Due Check-in"` · fond amber | | |
| EFF-03 | Séjour en cours | `CHECKED_IN`, arrival < now < departure | Badge `"In Progress"` · fond zinc-900 blanc | | |
| EFF-04 | Séjour en retard (overdue) | `CHECKED_IN`, now > departure | Badge `"Overdue"` · fond rouge | | |
| EFF-05 | Check-out effectué | `CHECKED_OUT` | Badge `"Checked Out"` · fond stone grisé | | |
| EFF-06 | Réservation annulée | `CANCELLED` | Badge `"Cancelled"` · fond stone grisé | | |
| EFF-07 | CONFIRMED + arrivée dépassée sans check-in | `CONFIRMED`, arrival < now | Badge `"Overdue"` · fond rouge | | |

---

## 2. Tests API Backend

> Header requis sur toutes les requêtes : `Authorization: Bearer <token>`

### 2.1 Lecture des réservations

| ID | Description | Méthode & URL | Params | Résultat attendu | Statut | Remarques |
|----|-------------|--------------|--------|-----------------|--------|-----------|
| API-01 | Lister toutes les réservations | `GET /api/bookings` | — | `200` — `{ data: [...], meta: { total, page, limit, totalPages } }` | | |
| API-02 | Pagination page 2 | `GET /api/bookings?page=2&limit=5` | — | `200` — max 5 résultats, `meta.page=2`, `hasPrevPage=true` | | |
| API-03 | Dernière page | `GET /api/bookings?page=999` | — | `200` — `data: []`, `hasNextPage=false` | | |
| API-04 | Filtrer par statut CONFIRMED | `GET /api/bookings?status=CONFIRMED` | — | `200` — Seules les réservations CONFIRMED | | |
| API-05 | Filtrer par statut CHECKED_IN | `GET /api/bookings?status=CHECKED_IN` | — | `200` — Seules les réservations en cours | | |
| API-06 | Filtrer par date exacte | `GET /api/bookings?date=2026-06-15` | — | `200` — Réservations dont `arrival <= 2026-06-15 <= departure` | | |
| API-07 | Filtrer par plage de dates | `GET /api/bookings?startDate=2026-06-01&endDate=2026-06-30` | — | `200` — Réservations se chevauchant avec juin 2026 | | |
| API-08 | Recherche par nom de client | `GET /api/bookings?search=Dupont` | — | `200` — Réservations du client "Dupont" | | |
| API-09 | Recherche par numéro de chambre | `GET /api/bookings?search=101` | — | `200` — Réservations incluant la chambre 101 | | |
| API-10 | Recherche insensible à la casse | `GET /api/bookings?search=dupont` | — | `200` — Même résultat que "Dupont" | | |
| API-11 | Tri par totalAmount desc | `GET /api/bookings?sort=totalAmount&order=desc` | — | `200` — Réservations triées du plus cher au moins cher | | |
| API-12 | Tri par departure asc | `GET /api/bookings?sort=departure&order=asc` | — | `200` — Triées par date de départ croissante | | |
| API-13 | Récupérer une réservation par ID | `GET /api/bookings/:id` | ID valide | `200` — Réservation avec `rooms`, `guest`, `effectiveStatus` | | |
| API-14 | ID inexistant | `GET /api/bookings/fakeid` | — | `404` — `Réservation introuvable` | | |
| API-15 | Requête sans token | `GET /api/bookings` | Pas de header Auth | `401` — Accès non autorisé | | |

### 2.2 Création de réservation

| ID | Description | Méthode & URL | Body | Résultat attendu | Statut | Remarques |
|----|-------------|--------------|------|-----------------|--------|-----------|
| API-16 | Créer une réservation valide (1 chambre) | `POST /api/bookings` | `{ guestId, arrival, departure, rooms: [{roomId, roomRate}], totalAmount }` | `201` — Réservation créée avec statut `CONFIRMED` | | |
| API-17 | Créer avec plusieurs chambres | `POST /api/bookings` | `rooms: [{roomId, roomRate}, {roomId2, roomRate2}]` | `201` — Deux `BookingRoom` créés | | |
| API-18 | Créer avec dates par chambre différentes | `POST /api/bookings` | `rooms: [{roomId, roomRate, arrival: J+1, departure: J+3}, {roomId2, roomRate2, arrival: J+2, departure: J+4}]` | `201` — Chaque chambre a ses propres dates | | |
| API-19 | Créer avec notes | `POST /api/bookings` | `+ "notes": "Anniversaire de mariage"` | `201` — Champ `notes` présent | | |
| API-20 | Departure = Arrival (même moment) | `POST /api/bookings` | `arrival: "2026-06-10T14:00:00Z", departure: "2026-06-10T14:00:00Z"` | `400` — `La date de départ doit être après l'arrivée` | | |
| API-21 | Departure avant Arrival | `POST /api/bookings` | `arrival: "2026-06-10", departure: "2026-06-08"` | `400` — Même erreur | | |
| API-22 | Chambre en maintenance | `POST /api/bookings` | Room avec `status: MAINTENANCE` | `409` — `La chambre X est en maintenance et ne peut pas être réservée` | | |
| API-23 | Conflit de réservation | `POST /api/bookings` | Chambre déjà réservée sur la même période | `409` — `La chambre est déjà réservée sur cette période` | | |
| API-24 | Conflit partiel (chevauchement) | `POST /api/bookings` | Arrival = milieu d'une réservation existante | `409` — Conflit détecté | | |
| API-25 | Pas de conflit (back-to-back exact) | `POST /api/bookings` | Arrival = departure exacte d'une autre réservation | `409` — Vérifier le comportement (boundaries strictes) | | |
| API-26 | `guestId` manquant | `POST /api/bookings` | Sans `guestId` | `400` — Erreur de validation | | |
| API-27 | `rooms` vide | `POST /api/bookings` | `rooms: []` | `400` — Erreur de validation | | |
| API-28 | `totalAmount` négatif | `POST /api/bookings` | `totalAmount: -100` | `400` — Erreur de validation | | |
| API-29 | RECEPTIONIST crée une réservation | `POST /api/bookings` (token RECEPTIONIST) | Payload valide | `201` — Succès | | |
| API-30 | HOUSEKEEPING tente de créer | `POST /api/bookings` (token HOUSEKEEPING) | Payload valide | `403` — Accès refusé | | |

### 2.3 Mise à jour du statut

| ID | Description | Méthode & URL | Body | Résultat attendu | Statut | Remarques |
|----|-------------|--------------|------|-----------------|--------|-----------|
| API-31 | Check-in (CONFIRMED → CHECKED_IN) | `PATCH /api/bookings/:id/status` | `{ "status": "CHECKED_IN" }` | `200` — Statut mis à jour, chambres passent en `OCCUPIED` | | |
| API-32 | Check-out (CHECKED_IN → CHECKED_OUT) | `PATCH /api/bookings/:id/status` | `{ "status": "CHECKED_OUT" }` | `200` — `guest.totalStays++`, `guest.lifetimeValue` augmenté, chambres recalculées | | |
| API-33 | Annulation (CONFIRMED → CANCELLED) | `PATCH /api/bookings/:id/status` | `{ "status": "CANCELLED" }` | `200` — Statut annulé, chambres libérées | | |
| API-34 | Révocation check-in (CHECKED_IN → CONFIRMED) | `PATCH /api/bookings/:id/status` | `{ "status": "CONFIRMED" }` | `200` — Retour à CONFIRMED | | |
| API-35 | Statut invalide | `PATCH /api/bookings/:id/status` | `{ "status": "INVALID_VALUE" }` | `400` — Erreur de validation | | |
| API-36 | RECEPTIONIST change le statut | Token RECEPTIONIST | `{ "status": "CHECKED_IN" }` | `200` — Succès | | |
| API-37 | HOUSEKEEPING tente un changement | Token HOUSEKEEPING | `{ "status": "CHECKED_IN" }` | `403` — Accès refusé | | |

### 2.4 Suppression

| ID | Description | Méthode & URL | Résultat attendu | Statut | Remarques |
|----|-------------|--------------|-----------------|--------|-----------|
| API-38 | Supprimer une réservation (ADMIN) | `DELETE /api/bookings/:id` | `204` — Réservation et ses BookingRooms supprimées, chambres en `AVAILABLE` | | |
| API-39 | Supprimer (MANAGER) | `DELETE /api/bookings/:id` (token MANAGER) | `204` — Succès | | |
| API-40 | Supprimer (RECEPTIONIST) | `DELETE /api/bookings/:id` (token RECEPTIONIST) | `403` — Accès refusé | | |
| API-41 | ID inexistant | `DELETE /api/bookings/fakeid` | `404` — `Réservation introuvable` | | |
| API-42 | Vérifier libération des chambres | Supprimer une réservation `CHECKED_IN` | `GET /api/rooms/:roomId` → status `AVAILABLE` | | |

---

## 3. Tests Frontend — Page Réservations (`/reservations`)

### 3.1 Navigation entre vues

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| UI-01 | Accès à la page | Cliquer "Reservations" dans le sidebar | Page `/reservations` chargée, titre visible | | |
| UI-02 | Bouton bascule vue Grid | Cliquer le bouton "Grid" | Planning en grille affiché | | |
| UI-03 | Bouton bascule vue List | Cliquer le bouton "List" | Tableau paginé affiché | | |
| UI-04 | Bouton bascule vue Calendar | Cliquer le bouton "Calendar" | Calendrier mensuel affiché | | |
| UI-05 | Bouton actif en surbrillance | Observer les boutons de vue | Le bouton actif a le fond `primary` | | |

---

### 3.2 Vue Grille (Planning Board)

#### Affichage général

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| UI-06 | Colonnes de la semaine | Ouvrir la vue Grille | 7 colonnes (Lun–Dim) avec dates | | |
| UI-07 | Colonne "Aujourd'hui" mise en évidence | Observer | Colonne du jour en fond teal | | |
| UI-08 | Lignes par chambre | Observer les lignes | Une ligne par chambre, numéro à gauche | | |
| UI-09 | Indicateur de statut chambre | Observer les points de couleur | Vert = disponible · Teal = occupée · Jaune = réservée · Gris = maintenance | | |
| UI-10 | Overlay maintenance | Chambre en maintenance | Fond avec rayures diagonales, non cliquable | | |
| UI-11 | Blocs de réservation | Réservations sur la semaine | Blocs colorés positionnés sur les bonnes colonnes | | |
| UI-12 | Bloc multi-nuits | Réservation de 3 nuits | Bloc s'étend sur 3 colonnes | | |
| UI-13 | Badge statut sur bloc | Voir les blocs | Couleur correspond à l'effectiveStatus | | |
| UI-14 | Client VIP (gold) | Réservation d'un client VIP_ELITE | Bloc avec dégradé doré | | |
| UI-15 | Réservations annulées masquées | Annuler une réservation | Bloc disparaît de la grille | | |
| UI-16 | Légende des statuts | Bas de page | Couleurs: Upcoming, Due Check-in, In Progress, Overdue, Checked Out | | |

#### Navigation temporelle

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| UI-17 | Semaine suivante | Cliquer `›` | Semaine décalée de 7 jours en avant | | |
| UI-18 | Semaine précédente | Cliquer `‹` | Semaine décalée de 7 jours en arrière | | |
| UI-19 | Semaine en cours affichée | Observer le titre | Dates de début et fin de la semaine en cours | | |
| UI-20 | Naviguer loin puis revenir | Aller 8 semaines en avant, revenir | Affichage correct à chaque étape | | |

#### Filtres

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| UI-21 | Filtre catégorie "Suite" | Sélectionner "Suite" | Seules les lignes de type Suite visibles | | |
| UI-22 | Filtre statut chambre "Available" | Sélectionner "Available" | Seules les chambres disponibles affichées | | |
| UI-23 | Filtre statut chambre "Maintenance" | Sélectionner "Maintenance" | Seules les chambres en maintenance | | |
| UI-24 | Recherche par numéro de chambre | Saisir "101" dans le champ | Seule la chambre 101 visible | | |
| UI-25 | Recherche par type | Saisir "Suite" | Seules les chambres de type Suite | | |
| UI-26 | Aucun résultat de filtre | Filtre sans correspondance | Message `"No units match filters"` | | |
| UI-27 | Effacer tous les filtres | Cliquer "Clear all filters" | Grille complète restaurée | | |

#### Interactions

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| UI-28 | Cliquer un bloc de réservation | Cliquer un bloc | Panneau d'action rapide (Quick Panel) s'ouvre en bas | | |
| UI-29 | Cliquer une cellule vide | Cliquer une cellule sans réservation | Modal "Add Reservation" s'ouvre avec la chambre et la date pré-remplies | | |
| UI-30 | Hover sur bloc → bouton Reassign | Survoler un bloc | Icône `RefreshCw` apparaît sur le bloc | | |
| UI-31 | Cliquer Reassign sur un bloc | Cliquer l'icône | Modal de réaffectation s'ouvre | | |

---

### 3.3 Vue Liste (Bookings Registry)

#### Affichage

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| UI-32 | Colonnes du tableau | Charger la vue Liste | Colonnes : Guest, Stay Window, Rooms, Status, Total, Actions | | |
| UI-33 | Avatar client | Observer colonne Guest | Initiales dans un cercle + nom + ID court | | |
| UI-34 | Fenêtre de séjour | Observer colonne Stay Window | `arrivée → départ (N nuits)` | | |
| UI-35 | Chambres | Observer colonne Rooms | Types + numéros des chambres | | |
| UI-36 | Badge statut effectif | Observer colonne Status | Badge coloré conforme à la table EFF-* | | |
| UI-37 | Montant total | Observer colonne Total | Montant en Ar | | |
| UI-38 | Bouton Invoice sur chaque ligne | Observer colonne Actions | Icône FileText visible | | |
| UI-39 | Navigation vers détail | Cliquer une ligne | Naviguer vers `/reservations/:id` | | |
| UI-40 | Bouton Invoice ouvre la modal | Cliquer l'icône FileText | `InvoiceModal` s'ouvre | | |
| UI-41 | État vide | Aucune réservation correspondante | Icône Search + `"No matching reservations"` | | |

#### Filtres et recherche

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| UI-42 | Filtre statut "CONFIRMED" | Sélectionner dans le filtre | Seules les réservations CONFIRMED | | |
| UI-43 | Filtre statut "CHECKED_IN" | Sélectionner | Seules les réservations en cours | | |
| UI-44 | Filtre "All" | Revenir à All | Toutes les réservations | | |
| UI-45 | Recherche par nom de client | Saisir un nom | Réservations du client correspondant | | |
| UI-46 | Recherche par numéro de chambre | Saisir "102" | Réservations incluant la chambre 102 | | |
| UI-47 | Debounce de recherche | Taper vite | Requête envoyée après pause, pas à chaque frappe | | |
| UI-48 | Effacer la recherche | Vider le champ | Toutes les réservations rechargées | | |

#### Pagination

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| UI-49 | Indicateur de page | Observer | `"Page X of Y · Z bookings"` | | |
| UI-50 | Bouton Page suivante | Cliquer `›` | Chargement des 20 suivantes | | |
| UI-51 | Bouton Page précédente | Cliquer `‹` | Retour à la page précédente | | |
| UI-52 | Bouton Prev désactivé (page 1) | Être sur page 1 | Bouton `‹` grisé / non cliquable | | |
| UI-53 | Bouton Next désactivé (dernière page) | Aller à la dernière | Bouton `›` grisé | | |
| UI-54 | Cliquer un numéro de page direct | Cliquer `3` dans la pagination | Saut direct à la page 3 | | |
| UI-55 | Changer de filtre remet page à 1 | Être p.2, changer le statut | Retour à la page 1 automatique | | |

---

### 3.4 Vue Calendrier (Monthly Overview)

#### Navigation et rendu

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| UI-56 | Mois en cours par défaut | Ouvrir la vue Calendrier | Mois actuel affiché, titre `"Mai 2026"` | | |
| UI-57 | Mois suivant | Cliquer `›` | Mois +1 affiché | | |
| UI-58 | Mois précédent | Cliquer `‹` | Mois -1 affiché | | |
| UI-59 | Bouton "Today" | Naviguer loin, cliquer "Today" | Retour au mois actuel | | |
| UI-60 | Jours hors mois grisés | Observer les bords | Jours du mois précédent/suivant en `stone-50` | | |
| UI-61 | Week-ends en fond légèrement différent | Observer les colonnes Sam/Dim | Fond légèrement teinté | | |
| UI-62 | Aujourd'hui mis en évidence | Observer | Numéro du jour dans un cercle primary | | |
| UI-63 | Barres de réservation | Réservations sur le mois | Barres colorées s'étalant sur les bonnes dates | | |
| UI-64 | Couleur des barres = effectiveStatus | Observer | Conforme aux couleurs du système de statut | | |
| UI-65 | Réservations annulées masquées | — | Aucune barre pour les réservations annulées | | |
| UI-66 | Troncature du nom si peu d'espace | Réservation d'1 jour | Nom tronqué avec `…` | | |
| UI-67 | Indicateur multi-chambres | Réservation de 2 chambres | `"+1"` ou `"+N"` affiché sur la barre | | |
| UI-68 | Algorithme de lanes (pas de chevauchement) | Plusieurs réservations simultanées | Barres sur des lignes différentes, pas superposées | | |
| UI-69 | Cliquer une barre | Cliquer une barre de réservation | Naviguer vers `/reservations/:id` | | |
| UI-70 | Légende des couleurs | Bas de page | 5 couleurs de statut affichées | | |

#### Panneau de détail du jour

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| UI-71 | Sélectionner un jour | Cliquer sur une case | Panneau latéral droit s'ouvre avec le détail du jour | | |
| UI-72 | Titre du panneau | Observer | Jour de semaine + date formatée | | |
| UI-73 | Section "Arrivals" | Jour avec arrivées | Réservations dont `arrival = selectedDay` | | |
| UI-74 | Section "Departures" | Jour avec départs | Réservations dont `departure = selectedDay` | | |
| UI-75 | Section "In-house" | Jour durant un séjour | Réservations `arrival < today < departure` | | |
| UI-76 | Carte de réservation dans le panneau | Observer | Nom client, chambres, nuits, badge statut | | |
| UI-77 | Cliquer une carte dans le panneau | Cliquer | Naviguer vers `/reservations/:id` | | |
| UI-78 | Jour sans activité | Cliquer un jour vide | Message `"No activity"` ou équivalent | | |
| UI-79 | Jour sélectionné mis en évidence | Observer la grille | Case sélectionnée avec fond teal | | |

---

## 4. Tests Frontend — Panneau d'Action Rapide (Quick Panel)

| ID | Description | Précondition | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|-------------|--------|-----------------|--------|-----------|
| QP-01 | Ouverture | Réservation visible | Cliquer un bloc (grille) ou menu (liste) | Panneau fixe en bas de l'écran s'anime vers le haut | | |
| QP-02 | Infos affichées | — | Observer | Badge statut, ID court, nom client, type/numéro chambre, dates, nuits, total | | |
| QP-03 | Bouton "Check-in" visible | effectiveStatus = `due_checkin` | Observer | Bouton teal "Check-in" visible | | |
| QP-04 | Bouton "Checkout" visible | effectiveStatus = `in_progress` | Observer | Bouton "Checkout" visible | | |
| QP-05 | Bouton "Force Out" (rouge) | effectiveStatus = `overdue` | Observer | Bouton rouge avec icône `AlertTriangle` | | |
| QP-06 | Bouton "Revert" | effectiveStatus = `in_progress` | Observer | Bouton amber "Revert" visible | | |
| QP-07 | Bouton "Cancel" | effectiveStatus = `upcoming` ou `due_checkin` | Observer | Bouton rouge outline "Cancel" visible | | |
| QP-08 | Pas de bouton Cancel si checked_out | effectiveStatus = `checked_out` | Observer | Bouton Cancel **absent** | | |
| QP-09 | Boutons Reassign, Invoice, Details toujours présents | Tout statut | Observer | Ces 3 boutons toujours visibles | | |
| QP-10 | Action Check-in | Cliquer "Check-in" | Statut passe à `CHECKED_IN`, panneau mis à jour | | |
| QP-11 | Action Checkout | Cliquer "Checkout" | Statut passe à `CHECKED_OUT`, panneau mis à jour | | |
| QP-12 | Action Cancel → Confirm Modal | Cliquer "Cancel" | Modal de confirmation s'ouvre | | |
| QP-13 | Confirm modal → annulation | Confirmer | Statut passe à `CANCELLED`, panneau se ferme | | |
| QP-14 | Confirm modal → annuler | Cliquer "Keep it" | Modal fermée, statut inchangé | | |
| QP-15 | Bouton Details | Cliquer "Details" | Naviguer vers `/reservations/:id` | | |
| QP-16 | Bouton Reassign | Cliquer | Modal réaffectation s'ouvre | | |
| QP-17 | Bouton Invoice | Cliquer | InvoiceModal s'ouvre | | |
| QP-18 | Fermeture bouton X | Cliquer X | Panneau se ferme avec animation | | |
| QP-19 | Fermeture clic extérieur | Cliquer hors du panneau | Panneau se ferme | | |
| QP-20 | État chargement pendant action | Cliquer "Check-in" | Bouton désactivé pendant la requête | | |

---

## 5. Tests Frontend — Modal Nouvelle Réservation

### 5.1 Ouverture et step 1 (Client & Dates)

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| NR-01 | Ouvrir via bouton "New Reservation" | Cliquer le bouton en haut à droite | Modal animée s'ouvre | | |
| NR-02 | Ouvrir via cellule de grille | Cliquer une cellule vide | Modal s'ouvre avec chambre et date pré-remplies | | |
| NR-03 | Structure de la modal | Observer | Sidebar gauche (résumé) + colonne droite (formulaire) | | |
| NR-04 | Recherche de client | Saisir un nom dans le champ | Dropdown avec résultats (initiales, nom, ville, statut) | | |
| NR-05 | Sélectionner un client | Cliquer sur un résultat | Client sélectionné, affiché dans la sidebar | | |
| NR-06 | Bouton "New Guest" | Cliquer "New Guest" | Modal AddGuest s'ouvre | | |
| NR-07 | Client créé via AddGuest disponible | Créer un client depuis la modal | Nouveau client sélectionnable immédiatement | | |
| NR-08 | Date d'arrivée | Saisir une date | Date enregistrée | | |
| NR-09 | Date de départ | Saisir après arrivée | Date enregistrée, nombre de nuits affiché | | |
| NR-10 | Départ = Arrivée | Saisir même date | Erreur `"Departure must be after arrival"` | | |
| NR-11 | Départ avant Arrivée | Saisir date antérieure | Même erreur | | |
| NR-12 | Bouton "Choose Rooms" désactivé | Champs incomplets | Bouton grisé | | |
| NR-13 | Bouton activé quand tout est valide | Remplir tous les champs | Bouton "Choose Rooms" cliquable | | |
| NR-14 | Sidebar affiche le résumé en temps réel | Remplir les champs | Client et dates s'affichent dans la sidebar gauche | | |

### 5.2 Step 2 (Sélection des chambres)

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| NR-15 | Transition vers step 2 | Cliquer "Choose Rooms" | Liste des chambres disponibles affichée | | |
| NR-16 | Chambres en maintenance absentes | Observer la liste | Les chambres `MAINTENANCE` ne sont pas listées | | |
| NR-17 | Filtrer par catégorie | Cliquer "Suite" | Seules les suites affichées | | |
| NR-18 | Filtrer par capacité | Cliquer `2+` | Chambres de capacité ≥ 2 | | |
| NR-19 | Recherche par numéro | Saisir "201" | Chambre 201 apparaît | | |
| NR-20 | Sélectionner une chambre | Cliquer la case à cocher | Chambre sélectionnée (fond teal), dates héritées affichées | | |
| NR-21 | Désélectionner | Re-cliquer la case | Chambre désélectionnée | | |
| NR-22 | Personnaliser les dates par chambre | Sélectionner chambre, modifier ses dates | Les dates propres à la chambre sont sauvegardées | | |
| NR-23 | Dates chambre invalides | Saisir departure ≤ arrival pour une chambre | Erreur affichée sur cette chambre | | |
| NR-24 | Multi-sélection | Sélectionner 3 chambres | Barre récapitulative "3 rooms selected" | | |
| NR-25 | Supprimer une chambre via sidebar | Cliquer `-` dans la sidebar | Chambre retirée de la sélection | | |
| NR-26 | Total estimé | Observer | Somme de tous les tarifs × nuits affichée | | |
| NR-27 | Bouton "Confirm" désactivé si aucune chambre | 0 chambres sélectionnées | Bouton grisé | | |
| NR-28 | Bouton "Back" | Cliquer | Retour au step 1 sans perdre les données | | |
| NR-29 | État "Checking availability" | Aucune chambre disponible | Message `"No rooms available"` | | |

### 5.3 Soumission et erreurs

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| NR-30 | Création réussie | Remplir tout, confirmer | Réservation créée, modal fermée, liste actualisée | | |
| NR-31 | Erreur chambre en maintenance | Confirmer avec chambre devenue maintenance entre les 2 steps | Message d'erreur serveur affiché dans la modal | | |
| NR-32 | Erreur conflit | Confirmer avec chambre déjà réservée | Message d'erreur `"La chambre est déjà réservée"` | | |
| NR-33 | État chargement | Cliquer "Confirm" | Bouton avec texte `"Creating…"`, désactivé | | |
| NR-34 | Fermer la modal | Cliquer `×` ou fond | Modal fermée, aucune réservation créée | | |

---

## 6. Tests Frontend — Page Détail Réservation (`/reservations/:id`)

### 6.1 Affichage

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| BD-01 | Navigation vers le détail | Cliquer une ligne de liste ou "Details" | URL `/reservations/:id`, page chargée | | |
| BD-02 | Titre et badge | Observer l'entête | `"Booking Details"` + badge effectiveStatus coloré | | |
| BD-03 | ID court visible | Observer | `#XXXXXXXXXXXX` (12 derniers chars, uppercase) | | |
| BD-04 | Bouton retour | Cliquer `←` | Retour à la page précédente | | |
| BD-05 | Section "Stay Summary" | Observer | 4 tuiles : Arrivée, Départ, Nuits, Total | | |
| BD-06 | Section "Rooms Booked" | Observer | Liste des chambres avec numéro, type, catégorie, dates, tarif | | |
| BD-07 | Calcul total par chambre | Observer | `tarif × nuits = total` affiché | | |
| BD-08 | Carte client | Observer | Initiale, nom, email + lien "View Guest Profile" | | |
| BD-09 | Lien "View Guest Profile" | Cliquer | Naviguer vers `/guests/:guestId` | | |
| BD-10 | Section Metadata | Observer | ID booking, statut, chambres, total | | |
| BD-11 | Bouton "Back to Reservations" | Cliquer | Naviguer vers `/reservations` | | |

### 6.2 Boutons d'action conditionnels

| ID | Description | Précondition (effectiveStatus) | Résultat attendu | Statut | Remarques |
|----|-------------|-------------------------------|-----------------|--------|-----------|
| BD-12 | Bouton "Check-in" visible | `due_checkin` | Bouton teal "Check-in" affiché | | |
| BD-13 | Bouton "Check-in" absent | `upcoming` | Bouton **absent** | | |
| BD-14 | Bouton "Check-out" visible | `in_progress` | Bouton zinc "Check-out" affiché | | |
| BD-15 | Bouton "Force Out" (rouge) | `overdue` | Bouton rouge avec `AlertTriangle` | | |
| BD-16 | Bouton "Revert" visible | `in_progress` | Bouton amber "Revert Check-in" affiché | | |
| BD-17 | Bouton "Cancel" visible | `upcoming` ou `due_checkin` | Bouton rouge outline affiché | | |
| BD-18 | Bouton "Cancel" absent | `in_progress`, `checked_out`, `cancelled` | Bouton **absent** | | |
| BD-19 | Bouton "Reassign" toujours présent | Tout statut | Bouton visible | | |
| BD-20 | Bouton "Invoice" toujours présent | Tout statut | Bouton visible | | |

### 6.3 Actions

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| BD-21 | Check-in | Cliquer "Check-in" | Statut → `CHECKED_IN`, badge mis à jour, retour à la liste | | |
| BD-22 | Check-out | Cliquer "Check-out" | Statut → `CHECKED_OUT`, retour à la liste | | |
| BD-23 | Force Out | Cliquer "Force Out" | Statut → `CHECKED_OUT`, retour à la liste | | |
| BD-24 | Revert Check-in | Cliquer "Revert" | Statut → `CONFIRMED`, badge passe à `upcoming` ou `due_checkin` | | |
| BD-25 | Cancel → modal confirmation | Cliquer "Cancel" | Modal `ConfirmModal` s'ouvre | | |
| BD-26 | Confirmer l'annulation | Confirmer dans la modal | Statut → `CANCELLED`, retour à la liste | | |
| BD-27 | État chargement | Cliquer n'importe quelle action | Boutons désactivés pendant la requête | | |
| BD-28 | Ouvrir Reassign | Cliquer "Reassign" | `ReassignRoomModal` s'ouvre | | |
| BD-29 | Ouvrir Invoice | Cliquer "Invoice" | `InvoiceModal` s'ouvre | | |

---

## 7. Tests Frontend — Modal Réaffectation de Chambre

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| RA-01 | Ouverture | Cliquer "Reassign" | Modal animée avec chambre actuelle affichée | | |
| RA-02 | Chambre actuelle | Observer | Badge amber avec numéro de chambre actuelle | | |
| RA-03 | Slot cible vide | Observer | Emplacement vide ou `"—"` à droite de la flèche | | |
| RA-04 | Liste des chambres disponibles | Observer | Chambres avec `status = available` listées | | |
| RA-05 | Chambre actuelle absente de la liste | Observer | La chambre actuellement assignée ne figure pas dans la liste | | |
| RA-06 | Chambres en maintenance absentes | Observer | Pas de chambre en maintenance dans la liste | | |
| RA-07 | Sélectionner une chambre cible | Cliquer une chambre | Coche apparaît, chambre mise en évidence teal, slot cible rempli | | |
| RA-08 | Changer de sélection | Sélectionner une autre chambre | Ancienne désélectionnée, nouvelle sélectionnée | | |
| RA-09 | Bouton "Confirm Reassignment" désactivé | Aucune sélection | Bouton grisé | | |
| RA-10 | Bouton activé après sélection | Sélectionner une chambre | Bouton cliquable | | |
| RA-11 | Confirmer la réaffectation | Cliquer "Confirm Reassignment" | Modal fermée, chambre mise à jour dans la réservation | | |
| RA-12 | État chargement | Cliquer "Confirm" | Spinner + `"Updating Ledger…"` | | |
| RA-13 | Annuler | Cliquer "Cancel" | Modal fermée, aucun changement | | |
| RA-14 | État vide | Aucune chambre disponible | Message `"No comparable units available"` | | |

---

## 8. Tests de Flux Complets (End-to-End)

| ID | Scénario | Étapes | Résultat attendu | Statut | Remarques |
|----|---------|--------|-----------------|--------|-----------|
| E2E-01 | Cycle complet d'une réservation | 1. Créer réservation · 2. Vérifier statut `upcoming` · 3. Check-in · 4. Vérifier `in_progress` · 5. Check-out · 6. Vérifier `checked_out` + stats client | Chaque étape correcte, stats client incrémentées | | |
| E2E-02 | Créer et annuler | 1. Créer · 2. Vérifier chambre réservée · 3. Annuler · 4. Vérifier chambre à nouveau `available` | Chambre libérée après annulation | | |
| E2E-03 | Réservation multi-chambres | 1. Créer avec 2 chambres et dates différentes · 2. Check-in · 3. Check-out | Deux blocs sur la grille, les deux chambres libérées au check-out | | |
| E2E-04 | Réaffectation puis check-in | 1. Créer · 2. Réaffecter chambre · 3. Check-in sur la nouvelle chambre | Check-in réussi, ancienne chambre `available`, nouvelle `occupied` | | |
| E2E-05 | Créer → Facture → Payer → Check-out | 1. Créer réservation · 2. Générer facture · 3. Enregistrer paiement · 4. Check-out | Tous les états cohérents | | |
| E2E-06 | Conflit empêché par l'UI | Sélectionner une chambre déjà réservée sur la même période | Chambre non disponible dans la liste (step 2) OU message d'erreur serveur | | |
| E2E-07 | Check-in overdue (retard de départ) | 1. Créer séjour terminé hier · 2. Faire check-in quand même | Statut `CHECKED_IN` appliqué malgré date passée | | |
| E2E-08 | Cohérence grille ↔ liste ↔ calendrier | 1. Créer réservation · 2. Vérifier dans les 3 vues | Réservation visible partout avec le même statut | | |
| E2E-09 | Suppresson et libération des chambres | 1. Créer réservation `CHECKED_IN` · 2. Supprimer (ADMIN) · 3. Vérifier API | Chambres en `AVAILABLE`, réservation absente de la liste | | |
| E2E-10 | Mise à jour temps réel après action | 1. Ouvrir liste · 2. Check-in depuis le detail · 3. Retour à la liste | Cache React Query invalidé, badge mis à jour | | |

---

## 9. Tests de Contrôle d'Accès (RBAC)

| ID | Rôle | Action | UI | API | Résultat attendu | Statut | Remarques |
|----|------|--------|----|----|-----------------|--------|-----------|
| RBAC-01 | ADMIN | Toutes les actions | — | — | Accès complet | | |
| RBAC-02 | MANAGER | Créer, modifier statut, supprimer | — | — | Accès complet | | |
| RBAC-03 | RECEPTIONIST | Créer une réservation | Bouton visible | `201` | Succès | | |
| RBAC-04 | RECEPTIONIST | Modifier le statut | Boutons d'action visibles | `200` | Succès | | |
| RBAC-05 | RECEPTIONIST | Supprimer une réservation | — | `DELETE /bookings/:id` | `403` Accès refusé | | |
| RBAC-06 | HOUSEKEEPING | Voir la liste des réservations | Page accessible | `GET 200` | Lecture seule autorisée | | |
| RBAC-07 | HOUSEKEEPING | Créer une réservation | Bouton visible ? | `POST` | `403` Accès refusé | | |
| RBAC-08 | HOUSEKEEPING | Modifier le statut | Boutons d'action présents ? | `PATCH` | `403` Accès refusé | | |
| RBAC-09 | Non authentifié | Accéder à /reservations | Redirection vers /login | `401` | Redirigé vers login | | |

---

## 10. Tests de Robustesse et Cas Limites

| ID | Description | Étapes | Résultat attendu | Statut | Remarques |
|----|-------------|--------|-----------------|--------|-----------|
| ROB-01 | Backend indisponible — liste | Couper le backend, charger `/reservations` | Composant `PageError` affiché | | |
| ROB-02 | Backend indisponible — détail | Couper le backend, accéder à un détail | `PageError` affiché | | |
| ROB-03 | URL directe vers un ID inexistant | Naviguer vers `/reservations/fakeid` | `PageError` affiché (404) | | |
| ROB-04 | Rafraîchissement pendant un check-in | Recharger la page à mi-requête | État cohérent après rechargement | | |
| ROB-05 | Double clic sur "Check-in" | Cliquer rapidement 2 fois | Un seul appel API, bouton désactivé | | |
| ROB-06 | Séjour d'1 nuit | Arrivée J, départ J+1 | Affichage `"1 night"`, calcul correct | | |
| ROB-07 | Séjour très long (30 nuits) | Créer réservation d'un mois | Bloc large dans la grille, nuits = 30 | | |
| ROB-08 | Beaucoup de chambres (scroll grille) | >20 chambres en base | Scroll vertical dans la grille, toutes les lignes rendues | | |
| ROB-09 | Beaucoup de réservations simultanées (calendrier) | >5 réservations le même jour | Lanes multiples dans le calendrier, pas de débordement | | |
| ROB-10 | Changement de langue (FR) | Passer en Français | Tous les labels traduits dans les 3 vues | | |
| ROB-11 | Changement de langue (MG) | Passer en Malagasy | Labels traduits en malgache | | |
| ROB-12 | Responsive mobile — liste | Réduire à 375px | Colonnes tronquées ou empilées, pas de débordement | | |
| ROB-13 | Responsive mobile — grille | Réduire à 375px | Scroll horizontal, colonnes lisibles | | |
| ROB-14 | Responsive mobile — modal nouvelle réservation | Ouvrir la modal sur mobile | Sidebar masquée ou empilée, formulaire utilisable | | |
| ROB-15 | Naviguer avec le bouton retour du navigateur | Depuis le détail, cliquer ← navigateur | Retour correct, pas de plantage | | |
| ROB-16 | Arrivée = Aujourd'hui minuit | Créer réservation avec `arrival = 2026-05-30T00:00:00Z` | Badge `due_checkin` immédiatement | | |
| ROB-17 | Réservation dans une autre année | Créer pour 2027 | Visible dans le calendrier/liste, aucun bug de date | | |

---

## 11. Récapitulatif

| Catégorie | Nb de tests | Passés | Échoués | Ignorés |
|-----------|-------------|--------|---------|---------|
| Statut effectif | 7 | | | |
| API Backend | 27 | | | |
| Vue Grille | 26 | | | |
| Vue Liste | 24 | | | |
| Vue Calendrier | 24 | | | |
| Quick Panel | 20 | | | |
| Modal Nouvelle Réservation | 34 | | | |
| Page Détail | 29 | | | |
| Modal Réaffectation | 14 | | | |
| End-to-End | 10 | | | |
| RBAC | 9 | | | |
| Robustesse | 17 | | | |
| **TOTAL** | **241** | | | |

---

*Cahier généré le 2026-05-30 — NaturaLodge Hotel Management*
