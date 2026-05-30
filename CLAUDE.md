# NaturaLodge — Hotel Monorepo

Système de gestion hôtelière full-stack. Deux packages dans le même repo : `client/` (React) et `server/` (Express + Prisma).

---

## Structure du projet

```
hotel-monorepo/
├── client/          # React 19 + Vite + TailwindCSS v4
└── server/          # Express + TypeScript + Prisma + PostgreSQL
```

---

## Démarrage

```bash
# Backend (port 4000)
cd server && npm run dev

# Frontend (port 3000)
cd client && npm run dev
```

**Variables d'environnement serveur** (`server/.env`) :
- `DATABASE_URL` — connexion PostgreSQL
- `JWT_SECRET` — clé de signature JWT
- `JWT_EXPIRES_IN` — durée du token (ex: `7d`)
- `PORT` — port du serveur (défaut: 4000)
- `FRONTEND_URL` — origine autorisée pour CORS (défaut: `http://localhost:3000`)

**Variables d'environnement client** (`client/.env`) :
- `VITE_API_URL` — URL de l'API (défaut: `http://localhost:4000/api`)

---

## Stack technique

### Client
- **React 19** + React Router v7 + TypeScript 5.8
- **Vite 6** — bundler, port 3000
- **TailwindCSS v4** — utility-first CSS
- **TanStack Query v5** — fetch/cache/mutations (`useQuery`, `useMutation`)
- **Axios** — client HTTP centralisé dans `src/api/client.ts`
- **motion/react** (Framer Motion v12) — animations
- **i18next** + react-i18next — internationalisation (EN / FR / MG)
- **lucide-react** — icônes

### Serveur
- **Express 4** + TypeScript 5.8
- **Prisma 7** — ORM PostgreSQL
- **Zod** — validation des requêtes
- **bcryptjs** — hachage mots de passe
- **jsonwebtoken** — auth JWT Bearer

---

## Architecture client

### Couche API (`src/api/`)
Chaque fichier exporte des fonctions async qui appellent `api` (instance axios). Les enums backend (MAJUSCULES) sont normalisés en minuscules côté client.

```
src/api/
├── client.ts       # Instance axios + intercepteur 401 → /login
├── bookings.ts
├── guests.ts
├── invoices.ts
├── rooms.ts
├── roomTypes.ts
└── staff.ts
```

### Hooks (`src/hooks/`)
Un hook par ressource, basé sur TanStack Query. Pattern : `useXxx()` pour les listes/détail, `useCreateXxx()` / `useUpdateXxx()` pour les mutations.

```
src/hooks/
├── useBookings.ts     # useBookings, useUpdateBookingStatus
├── useGuests.ts
├── useInvoices.ts     # useInvoiceByBooking, useGenerateInvoice, useRecordPayment, useVoidPayment
├── useRooms.ts
├── useRoomTypes.ts
├── useStaff.ts
└── useDebounce.ts
```

### Pages (`src/pages/`)
```
Dashboard.tsx        # Métriques temps réel
Reservations.tsx     # Grille planning + vue liste + calendrier
BookingDetail.tsx    # Détail réservation
Guests.tsx
GuestProfile.tsx
Rooms.tsx
RoomDetail.tsx
Invoices.tsx
Staff.tsx
Settings.tsx
Login.tsx
Amenities.tsx
```

### Composants clés
- `AppLayout.tsx` — shell global (sidebar + topbar + `<Outlet>`)
- `AddReservationModal.tsx` — création de réservation
- `ReassignRoomModal.tsx` — réassignation de chambre
- `InvoiceModal.tsx` — génération + affichage + paiements de facture
- `ReservationCalendar.tsx` — vue calendrier mensuel
- `QueryLoader.tsx` — `<PageLoader>` et `<PageError>` communs
- `ProtectedRoute.tsx` — redirection si non authentifié

### Internationalisation
Fichiers de traduction dans `src/locales/{en,fr,mg}.json`. Toujours utiliser `t('clé')` — ne jamais hardcoder les labels UI.

---

## Architecture serveur

### Routes (`src/routes/`)
Toutes les routes sont protégées par `authenticate`. Certaines nécessitent `authorize(roles)`.

```
/api/auth        # POST /login, GET /me
/api/rooms       # CRUD chambres
/api/room-types  # CRUD types de chambre
/api/bookings    # CRUD réservations + PATCH /:id/status
/api/guests      # CRUD clients
/api/invoices    # Génération + paiements
/api/staff       # CRUD staff
/api/settings    # GET + PATCH config globale (HotelConfig)
```

### Middleware auth
- `authenticate` — vérifie le token JWT Bearer, injecte `req.user`
- `authorize(...roles)` — restreint aux rôles spécifiés (`ADMIN`, `MANAGER`, `RECEPTIONIST`, `HOUSEKEEPING`)

### Validation
Toutes les entrées sont validées avec **Zod** avant toute opération DB. Pattern :
```ts
const parsed = z.object({ ... }).safeParse(req.body);
if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
```

---

## Schéma Prisma

Modèles principaux :
- `User` — staff (rôles : ADMIN, MANAGER, RECEPTIONIST, HOUSEKEEPING)
- `Guest` — clients hôtel
- `GuestNote` — notes sur un client
- `RoomType` + `Room` + `RoomFeature` — catalogue chambres
- `Booking` + `BookingRoom` — réservations
- `Invoice` + `InvoiceItem` + `Payment` — facturation
- `HotelConfig` — configuration globale (singleton `id = "default"`, taxRate TVA)

Commandes utiles :
```bash
cd server
npm run db:migrate    # prisma migrate dev
npm run db:generate   # prisma generate (après modif schema)
npm run db:seed       # seed données de démo
npm run db:studio     # interface visuelle Prisma Studio
```

---

## Logique métier importante

### Statuts de réservation
Les bookings ont un `status` DB (`CONFIRMED`, `CHECKED_IN`, `AWAITING`, `CANCELLED`, `CHECKED_OUT`) et un `effectiveStatus` calculé côté client :
- `upcoming` — confirmé, arrivée future
- `due_checkin` — arrivée aujourd'hui, pas encore checké
- `in_progress` / `checked_in` — actuellement en séjour
- `overdue` — départ dépassé sans checkout
- `checked_out` / `cancelled`

Mapping dans `src/lib/bookingStatus.ts`.

### Facturation
- TVA configurée globalement via `HotelConfig.taxRate` (GET/PATCH `/api/settings`)
- La route POST `/api/invoices/generate` lit `HotelConfig` si `taxRate` n'est pas fourni dans le body
- `InvoiceModal` utilise `useSettings()` pour afficher la TVA — pas d'input manuel
- L'échéance (`dueAt`) est fixée automatiquement au jour de génération, non visible dans l'UI

### Grille de réservation (performance)
La vue grille dans `Reservations.tsx` virtualise les colonnes horizontalement : seules les colonnes visibles ± 50 jours sont rendues. Les réservations sont pré-indexées par chambre via `bookingsByRoomId` (Map). Ne pas revenir à un rendu de toutes les colonnes.

---

## Conventions de code

- Pas de `any` explicite — typer correctement ou utiliser `unknown`
- Pas de commentaires sauf pour les invariants non-évidents
- Les enums Prisma sont en MAJUSCULES ; le client les normalise en minuscules
- Utiliser `cn()` de `src/lib/utils` pour combiner les classes Tailwind
- Les mutations React Query invalident toujours le cache des queries concernées
- Vérifier les droits avec `canManage` / `canVoid` côté client avant d'afficher les actions

---

## Branches Git

- `main` — branche de production stable
- `feature/reservation-calendar-and-implementation` — branche courante

---

## Commandes de lint/typage

```bash
# Vérification TypeScript client
cd client && npx tsc --noEmit

# Vérification TypeScript serveur
cd server && npx tsc --noEmit
```

Les erreurs dans `src/mockData.ts` et certaines dans `GuestProfile.tsx` / `AddGuestModal.tsx` sont pré-existantes et hors scope de la session courante.
