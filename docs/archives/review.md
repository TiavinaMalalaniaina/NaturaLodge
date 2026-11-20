# Revue de code — NaturaLodge

Revue du backend (`server/`) et du frontend (`client/`). Chaque point a été vérifié en lisant le code réel ; les plus critiques ont été reproduits en conditions réelles (requête HTTP réelle contre le serveur qui tourne). Classé par sévérité.

---

## 🔴 Critique

### 1. N'importe quelle requête invalide peut faire crasher tout le serveur
**`server/src/server.ts`** — Express 4 ne rattrape pas automatiquement les rejets de promesses dans les handlers `async` (contrairement à Express 5). Il n'y a ni `express-async-errors`, ni `try/catch` par route, ni `process.on('unhandledRejection', ...)`. Dès qu'un handler async rejette (ex : `prisma.update()` sur un id inexistant → erreur Prisma `P2025`), Node tue le process entier (comportement par défaut depuis Node 15+ sur une rejection non gérée).

**Reproduit en direct** : `PATCH /api/bookings/does-not-exist-id/status` → le serveur ne répond même pas (connexion refusée), et `/health` reste injoignable ensuite. Un seul utilisateur authentifié (même `HOUSEKEEPING`) peut couper l'API pour tout le monde avec une requête mal formée ou juste un id qui n'existe plus.

**Fix** : ajouter un wrapper `asyncHandler` autour de chaque route (ou passer à `express-async-errors`), et un `process.on('unhandledRejection', ...)` en filet de sécurité.

### 2. Élévation de privilèges : un MANAGER peut se promouvoir ADMIN
**`server/src/routes/staff.ts:48-58`** — `PATCH /api/staff/:id` est protégé par `authorize('ADMIN', 'MANAGER')`, mais le schéma accepté (`staffSchema.omit({password}).partial()`) inclut toujours `role` et `status`, sans restriction supplémentaire dans le handler. Un compte `MANAGER` peut envoyer `PATCH /api/staff/<son-propre-id>` avec `{ "role": "ADMIN" }` et s'auto-promouvoir, ou rétrograder/désactiver un ADMIN existant.

**Fix** : réserver le changement de `role`/`status` à `authorize('ADMIN')` seul, ou interdire explicitement qu'un MANAGER modifie un compte ADMIN ou change un rôle.

### 3. Un compte désactivé/rétrogradé garde ses droits jusqu'à 7 jours
**`server/src/middleware/auth.ts:9-28`** — `authenticate` fait confiance au `role`/`id` embarqués dans le JWT et ne revérifie jamais la base. `status` (ACTIVE/INACTIVE) n'est vérifié qu'au login (`auth.ts:30`), jamais ensuite. Si un ADMIN désactive ou rétrograde un compte compromis/licencié, son JWT existant (`JWT_EXPIRES_IN=7d` par défaut) continue de passer `authorize(...)` avec l'ancien rôle jusqu'à expiration — aucune révocation possible.

**Fix** : au minimum revérifier `status` en base à chaque requête (coût faible), ou passer à une vérification de rôle en base plutôt que dans le JWT pour les routes sensibles.

### 4. Toutes les données financières sont lisibles par n'importe quel rôle
**`server/src/routes/invoices.ts`** — Le router ne fait que `.use(authenticate)` ; `GET /`, `GET /:id`, `GET /booking/:bookingId` n'ont **aucun** `authorize(...)`. Un compte `HOUSEKEEPING` peut lister toutes les factures, montants, moyens de paiement et historique financier des clients.

**Fix** : ajouter `authorize('ADMIN', 'MANAGER', 'RECEPTIONIST')` sur les routes `GET` d'`invoices.ts`.

### 5. Pas de rate limiting sur `/auth/login`
**`server/src/routes/auth.ts`** — Aucune limite de tentatives. Un brute-force de mot de passe est possible (le coût de `bcrypt.compare` ralentit un peu mais ne bloque rien).

---

## 🟠 Intégrité des données

### 6. Double réservation possible (race condition)
**`server/src/routes/bookings.ts:148-194`** (et `reassign`, lignes 259-273) — La vérification de conflit (`bookingRoom.findFirst`) et la création (`booking.create`) sont deux requêtes séparées, sans transaction ni verrou. Deux `POST /api/bookings` concurrents sur la même chambre/dates peuvent tous les deux lire "aucun conflit" avant qu'aucun n'ait écrit → la chambre se retrouve doublement réservée. Seule la contrainte `@@unique([bookingId, roomId])` existe, ce qui n'empêche pas deux réservations différentes de se chevaucher.

**Fix** : wrapper la vérification + création dans une transaction Prisma avec un niveau d'isolation adapté, ou une contrainte d'exclusion PostgreSQL (`EXCLUDE USING gist`) sur `(roomId, daterange(arrival, departure))`.

### 7. Numérotation des factures non atomique
**`server/src/routes/invoices.ts:38-42`** — `generateInvoiceNumber()` fait `prisma.invoice.count()` puis construit `INV-{year}-{count+1}`, sans verrou. Deux `POST /invoices/generate` concurrents peuvent lire le même compte et tenter d'insérer le même numéro (`@unique` en base) → le second insert échoue → et comme le point #1 n'est pas géré, ça peut planter le serveur au lieu de renvoyer une 409 propre.

### 8. Annuler un paiement peut mettre à jour la mauvaise facture
**`server/src/routes/invoices.ts:240-248`** — `DELETE /invoices/:id/payments/:paymentId` ne vérifie jamais que `paymentId` appartient bien à la facture `:id` de l'URL. Appeler cette route avec l'id d'une facture B et le `paymentId` d'un paiement de la facture A rembourse le paiement de A, puis recalcule le statut de B (la mauvaise facture) — A garde un statut périmé (ex: toujours "Payée" alors qu'un de ses paiements vient d'être annulé).

**Fix** : vérifier `payment.invoiceId === req.params.id` avant de modifier, 404 sinon.

### 9. `PATCH /invoices/:id` peut rendre une facture incohérente
**`server/src/routes/invoices.ts:182-202`** — `taxAmount` et `status` sont modifiables directement, sans recalcul de `totalAmount` à partir des lignes. Après un tel PATCH, `totalAmount ≠ sum(items) + taxAmount`. Pire : un `status` forcé manuellement (ex: "Payée" sans paiement réel) sera **silencieusement écrasé** au prochain paiement/remboursement, puisque `syncInvoiceStatus` recalcule le statut à partir des vrais paiements à chaque fois — l'override manuel ne "tient" pas et personne n'est prévenu.

### 10. Supprimer un client avec des réservations plante (erreur 500 opaque)
**`server/src/routes/guests.ts:124-127`** + **`schema.prisma`** — La relation `Booking.guest` n'a pas de `onDelete` défini (défaut Postgres = `RESTRICT`). `DELETE /guests/:id` sur un client qui a au moins une réservation déclenche une violation de contrainte FK, non catchée → combinée au point #1, ça peut planter le serveur au lieu de renvoyer une erreur claire du type "impossible de supprimer un client avec des réservations".

### 11. (mineur) `DELETE /guests/:id/notes/:noteId` ne vérifie pas que la note appartient au client de l'URL — même pattern que le point #8, impact plus faible (réservé à ADMIN/MANAGER).

---

## 🟡 Fonctionnalités manquantes ou factices

Ces éléments *ont l'air* implémentés dans l'UI mais ne font rien en réalité :

- **`AddStaffModal.tsx` — "Authorize New Member" ne fait rien.** `handleSubmit` fait `console.log('New Staff Onboarded:', formData)` puis ferme la modal. Aucun appel API, et il n'existe même pas de fonction `createStaff` côté client. Un manager qui "ajoute un membre du staff" via ce formulaire ne crée personne.
- **`Settings.tsx` — la sauvegarde est fausse.** `handleSave` fait un `setTimeout(1500ms)` puis affiche "sauvegardé", sans aucune requête. Les champs sont en `defaultValue` (non contrôlés) — rien n'est même collecté.
- **`/api/settings` + `HotelConfig` n'existent pas du tout.** Ni route, ni modèle Prisma, ni `useSettings()` côté client — alors que l'ancien `CLAUDE.md` (avant ma correction) documentait ce système pour la TVA globale. En réalité, `InvoiceView.tsx` fait saisir un taux de TVA manuellement à chaque génération de facture (`useState(0)`), sans persistance ni config globale.
- **`CheckInQueue.tsx` — entièrement `MOCK_QUEUE` codé en dur**, affiché sur le Dashboard réel comme s'il s'agissait de vraies arrivées ("3 Active" fixe).
- **`RoomDetail.tsx` — le panneau "Upcoming Availability" affiche des réservations inventées** (noms/dates en dur), non branchées à une query. Le staff pourrait s'y fier par erreur.
- **`Staff.tsx` — la recherche ne filtre rien** (`<input>` sans `onChange`/state), et les cartes stats en en-tête ("42 Active Personnel", "18 Live Sessions") sont fixes, sans rapport avec les vraies données.

---

## 🟢 Correctness (mineur) & UX

- **Erreurs de mutation silencieuses** : la plupart des mutations de changement de statut (`Reservations.tsx` check-in/checkout/annuler, `BookingDetail.tsx`, `handleMaintenanceToggle` dans `Rooms.tsx`/`RoomDetail.tsx`, `handleVoidPayment` dans `InvoiceView.tsx`) n'ont pas de `onError`. En cas d'échec réseau/serveur, l'UI se comporte comme si ça avait marché (modal fermée, navigation effectuée) sans jamais informer l'utilisateur.
- **`RoomDetail.tsx:34`** — `const room = roomState ?? roomData;` fige `roomState` dès le premier changement de statut réussi ; toute donnée plus fraîche renvoyée par un refetch de `useRoom` (autre onglet, refetch en arrière-plan) est ensuite ignorée pour toujours sur cette page.

---

## ⚪ Qualité de code / cohérence

- **`any` explicite à plusieurs endroits**, alors que `CLAUDE.md` l'interdit explicitement : `api/invoices.ts` (toute la couche de normalisation est non typée), `GuestProfile.tsx:45` (cast `as any` inutile — le type `Guest & { bookings?: GuestBooking[] }` existe déjà), `RoomDetail.tsx:14` (`ICON_MAP: Record<string, any>`), `AddRoomModal.tsx:208`, et plusieurs `catch (err: any)`.
- **Logique dupliquée** à factoriser :
  - `fmtAmount`/`fmtDate` copiés-collés dans 5 fichiers (`BookingDetail.tsx`, `GuestProfile.tsx`, `Invoices.tsx`, `InvoiceView.tsx`, `ReassignRoomModal.tsx`) au lieu d'un `lib/format.ts` partagé.
  - Les maps statut→couleur existent en 4 versions indépendantes (`lib/bookingStatus.ts`, `Reservations.tsx` `BLOCK_CLS`, `GuestProfile.tsx` `STATUS_CLASS`, `Invoices.tsx`/`InvoiceView.tsx`) — risque de désynchronisation.
  - Le pattern des "chips" de filtre (boutons pilule) est recopié à la main 4+ fois (`Reservations.tsx` x2, `NewReservation.tsx`, `Rooms.tsx`) sans composant partagé.
  - Le formatage de temps relatif est dupliqué entre `api/staff.ts` (`formatRelative`) et `NotificationContext.tsx`.
- **JWT stocké en `localStorage`** (`api/client.ts`, `AuthContext.tsx`) — exposition standard en cas de XSS ; pas de fallback cookie httpOnly. À évaluer selon le niveau de risque accepté pour ce projet.

---

## Erreurs TypeScript préexistantes (déjà documentées dans `CLAUDE.md`, pour mémoire)
`AddGuestModal.tsx` (notification `amount` manquant), `Reservations.tsx` (`BLOCK_CLS.checked_in`), `mockData.ts`.

---

## Suggestion
`CLAUDE.md` contient encore une ligne inexacte : *"`InvoiceView.tsx` utilise `useSettings()` pour afficher la TVA — pas d'input manuel"* — c'est faux (voir point "Fonctionnalités manquantes" ci-dessus), à corriger si on ne veut pas se fier à un `/api/settings` qui n'existe pas.
