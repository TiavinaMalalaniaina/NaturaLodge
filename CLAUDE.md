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

⚠️ **CORS** : le serveur n'autorise qu'une seule origine (`FRONTEND_URL`, défaut `http://localhost:3000`). `vite preview` (build de prod local) est donc épinglé sur le port 3000 dans `client/vite.config.ts` — sinon il tourne sur 4173 par défaut et tous les appels API sont bloqués silencieusement par le navigateur. Ne peut pas tourner en même temps que `npm run dev` (même port).

---

## Docker (optionnel)

Un `docker-compose.yml` à la racine lance Postgres + server + client dans des conteneurs (utile pour tester la stack complète sans installer Postgres localement). Un `Makefile` à la racine expose les commandes courantes — `make help` liste tout.

```bash
make up            # build + démarre db + server + client (docker)
make down          # arrête les conteneurs (données conservées)
make seed          # seed la base (conteneur)

make install       # npm install client + server (local, sans docker)
make dev-server    # serveur en local, hot-reload (port 4000)
make dev-client    # client en local, hot-reload (port 3000)
```

- Le client est servi par nginx en prod (`client/Dockerfile`, `client/nginx.conf`), qui proxy `/api/*` vers le service `server`.
- Le serveur applique les migrations Prisma automatiquement au démarrage du conteneur (`prisma migrate deploy`).
- Sous Windows sans Git Bash configuré comme `SHELL` de `make`, les recettes s'exécutent via `cmd.exe` : éviter `trap`/`&`/`wait`/`awk` dans le Makefile (syntaxe POSIX indisponible).

### Monitoring (VPS de production)

`docker-compose.monitoring.yml` (séparé de `docker-compose.yml`) : Prometheus + Grafana + Loki/Promtail + node-exporter + cAdvisor + postgres-exporter + nginx-exporter + Uptime Kuma. Se raccroche au réseau nommé `naturalodge-network` (déclaré dans `docker-compose.yml`) pour scraper `server`/`db`/`client` par leur nom de service. Voir `monitoring/README.md` pour le détail (accès aux dashboards, rétention, alertes).

- Le serveur expose `GET /metrics` (Prometheus, `server/src/middleware/metrics.ts` — latence/throughput/erreurs par route, métriques Node par défaut) et journalise les requêtes Prisma lentes (`server/src/lib/prisma.ts`, seuil `SLOW_QUERY_THRESHOLD_MS`, 200ms par défaut) — jamais exposé publiquement, uniquement scrapé via `naturalodge-network`.
- Logs structurés JSON via `server/src/lib/logger.ts` (pino) + `pino-http` — consommés par Promtail → Loki, cherchables dans Grafana.
- `make monitoring-up` / `make monitoring-down` / `make monitoring-logs`.

---

## Stack technique

### Client
- **React 19** + React Router v7 + TypeScript 5.8
- **Vite 6** — bundler, port 3000
- **TailwindCSS v4** — utility-first CSS
- **TanStack Query v5** — fetch/cache/mutations (`useQuery`, `useMutation`)
- **Axios** — client HTTP centralisé dans `src/api/client.ts`
- **motion/react** (Framer Motion v12) — animations
- **i18next** + react-i18next — internationalisation (EN / FR / MG), français par défaut
- **lucide-react** — icônes
- **vite-plugin-pwa** — PWA installable (manifest + service worker généré au build). Cache uniquement les assets statiques buildés (JS/CSS/HTML/icônes) via Workbox `generateSW` — aucun cache sur `/api/*`, les données restent temps réel. Icônes sources dans `client/public/` (générées depuis `pwa-source.svg`). Le SW ne s'active qu'en build de prod (`vite preview` ou déploiement), jamais en `npm run dev`.

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
├── client.ts       # Instance axios + intercepteur 401 → /login (exclut /auth/login lui-même,
│                   # sinon un mauvais mot de passe déclenche un reload au lieu d'afficher l'erreur)
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
NewReservation.tsx   # Création de réservation (page, pas une modal) — /reservations/new
BookingDetail.tsx    # Détail réservation — /reservations/:id
Guests.tsx
GuestProfile.tsx
Rooms.tsx
RoomDetail.tsx
Invoices.tsx
InvoiceView.tsx      # Affichage + génération + paiements de facture (page) — /invoices/:bookingId
Staff.tsx
Settings.tsx
Login.tsx
Amenities.tsx
```

Convention : les flux « création / consultation d'un document complet » (nouvelle réservation, facture) sont des **pages dédiées**, pas des modals — plus d'espace, impression propre (`InvoiceView.tsx` a son propre CSS `@media print` + classe `.no-print` sur le shell `AppLayout`), navigation cohérente avec le reste de l'app. Réservé aux dialogues d'action courte (confirmation, formulaire rapide).

### Composants clés
- `AppLayout.tsx` — shell global (sidebar + topbar + `<Outlet>`)
- `ReassignRoomModal.tsx` — réassignation de chambre
- `ReservationCalendar.tsx` — vue calendrier mensuel
- `QueryLoader.tsx` — `<PageLoader>` et `<PageError>` communs
- `ProtectedRoute.tsx` — redirection si non authentifié
- `AddGuestModal.tsx` — création rapide de client (modal imbriquée dans `NewReservation.tsx`)

### Internationalisation
Fichiers de traduction dans `src/locales/{en,fr,mg}.json`. Toujours utiliser `t('clé')` — ne jamais hardcoder les labels UI.

---

## Architecture serveur

Deux couches : **routes (HTTP) → services (métier + Prisma)**. Pas de couche repository — Prisma est déjà l'abstraction d'accès aux données pour une seule base Postgres, un repository par-dessus n'ajouterait que de l'indirection.

```
src/
├── routes/       # parse Zod → asyncHandler(appel service) → res.json. Aucun appel Prisma direct.
├── services/     # logique métier + tous les appels Prisma. Un fichier par domaine.
├── validation/   # schémas Zod par domaine (auth, booking, guest, invoice, roomType, room, staff)
├── errors/       # AppError + sous-classes (NotFoundError, ConflictError, ForbiddenError, UnauthorizedError)
├── middleware/   # auth.ts, asyncHandler.ts, errorHandler.ts
└── lib/          # prisma.ts, roomStatus.ts, scheduler.ts
```

Toutes les routes sont protégées par `authenticate`. La plupart nécessitent en plus `can(permissionKey)`.

```
/api/auth        # POST /login, GET /me
/api/rooms       # CRUD chambres
/api/room-types  # CRUD types de chambre
/api/bookings    # CRUD réservations + PATCH /:id/status + PATCH /:id/reassign
/api/guests      # CRUD clients
/api/invoices    # Génération + paiements
/api/staff       # CRUD staff
```

⚠️ `/api/settings` + modèle `HotelConfig` ne sont **pas implémentés** — ce ne sont que des projets non commencés, à ne pas confondre avec de l'existant.

### Middleware auth
- `authenticate` — vérifie le token JWT Bearer, injecte `req.user`
- `can(permissionKey)` — vérifie que le rôle de `req.user` a la permission demandée, via la matrice `Permission`/`RolePermission` en base (cache mémoire, voir `lib/permissions.ts`) — remplace l'ancien `authorize(...roles)` codé en dur, configurable sans redéploiement depuis l'écran `/permissions` (ADMIN uniquement)

### Gestion des erreurs (`errors/`, `middleware/asyncHandler.ts`, `middleware/errorHandler.ts`)
Chaque handler de route est enveloppé dans `asyncHandler(...)`, qui capture les rejets de promesses et les transmet à `errorHandler` (monté en dernier dans `server.ts`) — **Express 4 ne rattrape pas nativement les rejets async**, sans ce wrapper une seule requête invalide plante tout le process. Les services lèvent des `AppError` (`NotFoundError`, `ConflictError`, `ForbiddenError`, `UnauthorizedError`) que `errorHandler` traduit en réponse JSON avec le bon code HTTP ; les erreurs Prisma connues (P2025/P2002/P2003) sont aussi mappées en filet de sécurité. Un `process.on('unhandledRejection', ...)` couvre le code hors cycle de requête (ex. `lib/scheduler.ts`).

### Transactions
Les écritures multi-étapes non atomiques passent par `prisma.$transaction` : création de réservation (vérification de conflit + create + statut chambres), réassignation (idem + recalcul montant/dates), génération de facture (vérification d'existence + génération du numéro + create), paiement (create/update + resynchronisation du statut facture). `lib/roomStatus.ts` accepte un client Prisma optionnel (`tx`) pour participer à ces transactions.

### Validation
Toutes les entrées sont validées avec **Zod** avant toute opération métier, schémas centralisés dans `validation/*.schema.ts`. Pattern dans les routes :
```ts
const parsed = xxxSchema.safeParse(req.body);
if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
res.json(await xxxService.someMethod(parsed.data));
```

---

## Schéma Prisma

Modèles principaux :
- `User` — staff (rôles : ADMIN, MANAGER, GERANT, HOUSEKEEPING)
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
Les bookings ont un `status` DB (`CONFIRMED`, `CHECKED_IN`, `AWAITING`, `CANCELLED`, `CHECKED_OUT_UNPAID`, `CHECKED_OUT_PAID`, `CLOSED`, + `CHECKED_OUT` legacy conservé pour les lignes historiques mais plus jamais écrit) et un `effectiveStatus` calculé côté serveur (`booking.service.ts: computeEffectiveStatus`) :
- `upcoming` — confirmé, arrivée future
- `due_checkin` — arrivée aujourd'hui, pas encore checké
- `in_progress` / `overdue` — actuellement en séjour / départ dépassé sans checkout
- `checked_out_unpaid` / `checked_out_paid` — terminé, selon que la facture est soldée ou non au moment du check-out
- `closed` — clôturé définitivement (voir ci-dessous)
- `cancelled`

Mapping dans `client/src/lib/bookingStatus.ts`.

Le check-out (`PATCH /:id/status` avec `status: 'CHECKED_OUT'`, `can('bookings.update_status')`, FRONT_DESK) ne persiste jamais `CHECKED_OUT` littéralement : le service résout vers `CHECKED_OUT_UNPAID` ou `CHECKED_OUT_PAID` selon la facture au moment du geste. Un paiement enregistré ou annulé après coup (`invoice.service.ts: addPayment`/`voidPayment`) resynchronise automatiquement ce statut via `resyncCheckoutPaymentStatus` — jamais `CLOSED`, qui est final. La clôture (`PATCH /:id/close`, `can('bookings.close')`, ADMIN/MANAGER uniquement) n'est possible que depuis `CHECKED_OUT_PAID` (409 sinon).

`server/src/lib/bookingStatus.ts` centralise `TERMINAL_STATUSES` (tous les statuts où une chambre n'est plus occupée) — à réutiliser plutôt que de recopier la liste dans une nouvelle vérification de conflit.

### Liste des réservations — filtre par défaut
`GET /api/bookings` (`server/src/routes/bookings.ts`) exclut par défaut `CANCELLED`/`CHECKED_OUT_PAID`/`CLOSED` — sauf si un `status` explicite ou une `search` est fourni. `CHECKED_OUT_UNPAID` reste visible tant qu'il reste un paiement à suivre. Combiné au tri par défaut (`arrival asc`), ça fait remonter en premier les séjours en cours/en retard puis à venir, sans jamais montrer les anciennes réservations clôturées ou soldées tant qu'on ne cherche pas explicitement. Ne pas retirer cette exclusion sans réintroduire un tri custom, sinon les vieilles réservations (les plus anciennes en date d'arrivée) redominent la première page.

### Facturation
- TVA configurée globalement via `HotelConfig.taxRate` (GET/PATCH `/api/settings`)
- La route POST `/api/invoices/generate` lit `HotelConfig` si `taxRate` n'est pas fourni dans le body
- `InvoiceView.tsx` utilise `useSettings()` pour afficher la TVA — pas d'input manuel
- L'échéance (`dueAt`) est fixée automatiquement au jour de génération, non visible dans l'UI

### Filtrage des chambres — par RoomType uniquement
Le champ `category` (enum `RoomCategory`) a été entièrement retiré du modèle `RoomType` (redondant avec `RoomType.name`) — supprimé du schéma Prisma, des routes serveur, des DTOs client et de tous les badges/formulaires d'affichage. Le filtrage et la catégorisation des chambres se font uniquement via `RoomType.name` (`useRoomTypes()`). Ne pas réintroduire un champ `category` séparé.

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
- `develop` — branche d'intégration ; les branches `feature/*` et `bugfix/*` sont mergées ici via PR avant d'être portées sur `main`

---

## Commandes de lint/typage

```bash
# Vérification TypeScript client
cd client && npx tsc --noEmit

# Vérification TypeScript serveur
cd server && npx tsc --noEmit
```
