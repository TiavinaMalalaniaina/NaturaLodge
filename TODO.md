# NaturaLodge — Todo

## ✅ Fait

### Backend
- [x] Structure Express + TypeScript (`backend/`)
- [x] Schéma Prisma — modèles `User`, `Guest`, `Room`, `Booking`, `Amenity`, `RoomFeature`
- [x] Auth JWT — `POST /auth/login`, `GET /auth/me`
- [x] Middleware `authenticate` + `authorize(roles)`
- [x] Routes CRUD — `/rooms`, `/guests`, `/bookings`, `/staff`, `/amenities`
- [x] Logique métier bookings — vérification conflit, sync statut chambre, totalStays guest
- [x] Seed Prisma — rooms, guests, staff, features, amenities

### Frontend
- [x] React Router v6 — `BrowserRouter`, routes protégées, `ProtectedRoute`
- [x] `AuthContext` — login JWT, logout, persistance token localStorage
- [x] `AppLayout` — sidebar + topbar avec `<Outlet>`
- [x] Navigation — `useNavigate` + `useLocation` + user réel depuis AuthContext
- [x] Login — appel API réel, gestion erreur, loading state
- [x] React Query — `QueryClient`, hooks `useRooms`, `useGuests`, `useBookings`, `useStaff`
- [x] Couche API — normalisation des enums backend → types frontend
- [x] Pages connectées — Rooms, RoomDetail, Guests, GuestProfile, Reservations, Staff
- [x] Dashboard — métriques temps réel (occupancy, revenue, arrivées, maintenance)

---

## 🔲 À faire

### 🔴 Priorité haute

#### Backend
- [ ] Hachage mot de passe à la création staff (bcrypt) — vérifier que `POST /staff` hash bien
- [ ] Validation des dates de réservation (departure > arrival)
- [ ] Endpoint `PATCH /guests/:id` — vérifier unicité email
- [x] Endpoint `GET /bookings` — pagination `page/limit` + `search/sort/order`, réponse `{ data, meta }`
- [ ] Endpoint `GET /rooms/features` — pour alimenter le FeatureManagerModal
- [ ] `POST /auth/change-password` — permettre à un user de changer son mot de passe

#### Frontend
- [ ] `AddReservationModal` — brancher sur `useCreateBooking()` au lieu des mocks
- [ ] `AddGuestModal` — brancher sur `POST /guests`
- [ ] `AddRoomModal` — brancher sur `POST /rooms`
- [ ] `AddStaffModal` — brancher sur `POST /staff`
- [ ] `EditRoomModal` — brancher sur `PATCH /rooms/:id`
- [ ] `ReassignRoomModal` — brancher sur `PATCH /bookings/:id/status`
- [ ] Bouton "Quick Check-in" Dashboard — appeler `PATCH /bookings/:id/status` → `CHECKED_IN`
- [ ] `.env` frontend — créer `frontend/.env` avec `VITE_API_URL=http://localhost:4000/api`

---

### 🟠 Priorité moyenne

#### Backend
- [ ] Endpoint `GET /dashboard/stats` — métriques agrégées (RevPAR, taux occupation, revenue)
- [ ] Upload images chambres — intégrer Cloudinary ou S3
- [ ] Notifications temps réel — WebSocket ou SSE pour le feed `NewBookingsFeed`
- [ ] Logs des actions — audit trail (qui a fait quoi et quand)

#### Frontend
- [ ] Validation formulaires — intégrer `zod` + `react-hook-form` dans tous les modals
- [ ] `Settings` page — brancher sur `PATCH /staff/:id` (profil utilisateur)
- [ ] Recherche globale TopBar — connecter à l'API
- [ ] Gestion des erreurs réseau — toast / snackbar global
- [ ] `GuestProfile` — onglet historique des séjours depuis `guest.bookings`
- [ ] `InvoiceModal` — générer un PDF réel avec `@react-pdf/renderer`
- [x] Pagination `Reservations` — contrôles page précédente/suivante + numéros de page actifs
- [ ] Pagination — `Guests`, `Staff`

---

### 🟡 Priorité basse

#### Mobile (nouveau projet)
- [ ] Init projet Expo (`npx create-expo-app naturalodge-mobile`)
- [ ] Écran Login mobile — appel même API backend
- [ ] Écran Dashboard mobile — occupancy + alertes
- [ ] Écran Check-in rapide — scan + action directe
- [ ] Écran Statut chambres — vue housekeeping
- [ ] Notifications push — `expo-notifications` + Firebase

#### Déploiement
- [ ] Choisir hébergeur DB (Supabase ou Neon.tech)
- [ ] Exécuter `prisma migrate dev --name init` en production
- [ ] Déployer backend (Railway ou Render)
- [ ] Déployer frontend (Vercel)
- [ ] Configurer variables d'environnement production
- [ ] Publier app mobile sur Google Play ($25) et App Store ($99/an)

---

## 🚀 Prochaine session recommandée

Brancher les modals sur l'API (AddReservationModal, AddGuestModal, AddRoomModal).
