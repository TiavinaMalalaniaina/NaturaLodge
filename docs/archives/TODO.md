# NaturaLodge — Todo

_Mis à jour après audit du code réel (le fichier avait dérivé de l'implémentation — noms de
dossiers `backend/`/`frontend/` obsolètes, items déjà faits non cochés, modèle `Amenity` disparu)._

## ✅ Fait

### Backend (`server/`)
- [x] Structure Express + TypeScript
- [x] Schéma Prisma — `User`, `Guest`, `GuestNote`, `RoomType`, `Room`, `RoomFeature`, `Booking`,
      `BookingRoom`, `Extra`, `BookingRoomExtra`, `Invoice`, `InvoiceItem`, `Payment`
- [x] Auth JWT — `POST /auth/login`, `GET /auth/me`
- [x] Middleware `authenticate` + `authorize(roles)`
- [x] Routes CRUD — `/rooms` (+ `/rooms/features`), `/room-types`, `/guests`, `/bookings`,
      `/staff`, `/invoices`, `/extras`, `/payments`
- [x] Logique métier bookings — conflit de dates, validation `departure > arrival`
      (`booking.service.ts`), sync statut chambre, `totalStays`/`lifetimeValue` guest
- [x] Hachage mot de passe (bcrypt, coût 12) — création staff + `PATCH /staff/:id/password`
- [x] Facturation — génération idempotente, lignes par chambre + par supplément, paiements,
      resynchronisation auto de la facture quand la réservation change après génération
      (`syncInvoiceWithBooking`)
- [x] Suppléments facturables (`Extra`/`BookingRoomExtra`) — catalogue avec soft delete
      (`isActive`), rattachés par chambre, snapshot prix/type à l'ajout
- [x] Historique des paiements — `GET /payments` paginé/filtrable (statut, méthode, client,
      recherche, plage de dates)
- [x] Seed Prisma — rooms, guests, staff, features, extras

### Frontend (`client/`)
- [x] React Router v7 — routes protégées, `ProtectedRoute`
- [x] `AuthContext` — login JWT, logout, persistance token localStorage
- [x] `AppLayout` — sidebar + topbar avec `<Outlet>`
- [x] React Query v5 — hooks par ressource (`useRooms`, `useGuests`, `useBookings`, `useStaff`,
      `useInvoices`, `useRoomTypes`, `useExtras`, `usePayments`)
- [x] Couche API — normalisation des enums backend (MAJUSCULES) → types frontend (minuscules)
- [x] i18n — `react-i18next`, `en`/`fr`/`mg`, FR par défaut
- [x] Toutes les modales de création branchées sur l'API réelle : `AddGuestModal`, `AddRoomModal`
      (+ création de type de chambre inline), `AddStaffModal`, `EditRoomModal`
- [x] `NewReservation.tsx` — page dédiée (pas modal), branchée sur `useCreateBooking`, avec
      sélection multi-chambres + suppléments par chambre
- [x] `ReassignRoomModal` — branché sur `PATCH /bookings/:id/reassign` (endpoint dédié, plus
      correct que passer par le statut)
- [x] Bouton "Check-in rapide" Dashboard — branché sur `PATCH /bookings/:id/status`
- [x] Pagination — `Reservations`, `Guests`
- [x] `RoomTypes.tsx` — page dédiée de gestion des types de chambre (CRUD complet)
- [x] `ExtraManagerModal` — gestion du catalogue de suppléments (CRUD + activer/désactiver)
- [x] `Payments.tsx` — page dédiée historique des paiements, filtrable/paginée, renvoie vers la
      facture concernée pour toute action
- [x] `GuestProfile` — onglet historique des séjours depuis `guest.bookings`
- [x] Facture — page dédiée `InvoiceView.tsx` avec impression (`window.print()` + CSS
      `@media print`) ; pas de génération PDF via une lib dédiée, mais couvre le besoin

---

## 🔲 À faire

### 🔴 Priorité haute

#### Backend
- [ ] `POST /auth/change-password` — changer **son propre** mot de passe (self-service).
      `PATCH /staff/:id/password` existant est réservé aux ADMIN pour changer le mot de passe de
      quelqu'un d'autre, ce n'est pas la même chose.
- [ ] Endpoint `GET /dashboard/stats` — métriques agrégées côté serveur (RevPAR, taux
      d'occupation, revenue) ; le Dashboard recalcule tout côté client à partir de `useRooms` +
      `useBookings`, ce qui marche mais ne scale pas et ne inclut pas d'historique/tendances.

#### Frontend
- [ ] Recherche globale de la TopBar (`Navigation.tsx`) — le champ n'a ni `value` ni `onChange`,
      totalement mort (même classe de bug que celui corrigé sur le Dashboard cette session).
- [ ] `Settings.tsx` — entièrement factice : `handleSave` fait juste un `setTimeout`, tous les
      champs sont des `defaultValue` statiques non connectés à un state ni à un appel API. Il n'y
      a **pas** de modèle `HotelConfig` ni de route `/api/settings` dans le code actuel (à
      corriger dans `CLAUDE.md`, qui mentionne l'un et l'autre comme existants par erreur). À
      décider : construire `HotelConfig` + route + page réelle, ou réduire la page à ce qui existe
      vraiment (langue, qui marche déjà).
- [ ] Pagination `Staff.tsx` — `Guests` est fait, `Staff` charge toute la liste sans pagination
      serveur (filtre uniquement côté client sur `useStaff()`).

### 🟠 Priorité moyenne

#### Backend
- [ ] Upload images chambres — `RoomImagePicker` ne fait que saisir une URL externe ou choisir un
      preset, aucun vrai upload (Cloudinary/S3 ou autre) n'est câblé.
- [ ] Notifications temps réel — `NotificationContext` est alimenté uniquement par les mutations
      client (optimiste), pas de push serveur (WebSocket/SSE) pour un événement déclenché par un
      autre poste.
- [ ] Logs des actions / audit trail — rien de stocké en base ; le bouton "Audit Full Personnel
      History" dans `Staff.tsx` est décoratif (aucun `onClick`).

#### Frontend
- [ ] Validation formulaires `zod` + `react-hook-form` — déployé seulement sur 3 modales
      (`AddStaffModal`, `FeatureManagerModal`, `ExtraManagerModal`) ; `AddRoomModal`,
      `EditRoomModal`, `AddGuestModal`, `NewReservation` restent en `useState` manuel sans
      validation de schéma.
- [ ] Gestion des erreurs réseau — pas de toast/snackbar global ; chaque page affiche sa propre
      bannière d'erreur locale (`apiError` + `getApiErrorMessage`), ce qui fonctionne mais est
      dupliqué partout plutôt que centralisé.
- [ ] `Staff.tsx` — bouton menu "..." (`MoreVertical`) par ligne membre sans action câblée (pas de
      modale d'édition/suppression de compte staff).
- [ ] `client/.env` — n'existe pas (ni `.env.example`) ; fonctionne grâce au fallback
      `VITE_API_URL` par défaut dans `api/client.ts`, mais pas explicite pour un futur déploiement.

### 🟡 Priorité basse

#### Page "Équipements" (`Amenities.tsx`)
- [ ] Entièrement mockée (`MOCK_AMENITIES`, aucun appel API), et déjà retirée de la sidebar
      (`Navigation.tsx` — entrée commentée). À trancher : construire un vrai modèle
      `Amenity`/`AmenityBooking` derrière, ou supprimer la page et son code mort
      (`AddAmenityModal` inclus).

#### Mobile (nouveau projet)
- [ ] Init projet Expo (`npx create-expo-app naturalodge-mobile`)
- [ ] Écran Login mobile — appel même API backend
- [ ] Écran Dashboard mobile — occupancy + alertes
- [ ] Écran Check-in rapide — scan + action directe
- [ ] Écran Statut chambres — vue housekeeping
- [ ] Notifications push — `expo-notifications` + Firebase

#### Déploiement
- [ ] Choisir hébergeur DB (Supabase ou Neon.tech) — un `docker-compose.yml` local existe déjà
      pour Postgres, mais rien n'est déployé
- [ ] Déployer backend (Railway ou Render)
- [ ] Déployer frontend (Vercel, ou l'image nginx du `Dockerfile` existant)
- [ ] Configurer variables d'environnement production
- [ ] Publier app mobile sur Google Play ($25) et App Store ($99/an)

---

## 🚀 Prochaine session recommandée

Par ordre d'impact : (1) brancher `Settings.tsx` sur une vraie config (ou réduire son périmètre à
ce qui marche déjà), (2) réparer la recherche TopBar, (3) `POST /auth/change-password`
self-service, (4) pagination `Staff.tsx`.
