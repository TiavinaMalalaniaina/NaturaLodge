# Revue de code — Frontend (`client/`)

Revue architecturale du client React, en complément de la section frontend déjà présente dans `review.md` (qui reste valable sauf sur deux points désormais corrigés : `AddStaffModal` est câblé à une vraie création de staff, et la ligne inexacte de `CLAUDE.md` sur `useSettings()` a été retirée). Chaque point ci-dessous a été vérifié en lisant le code réel, avec références `fichier:ligne`. Classé par sévérité.

---

## 🔴 Bugs fonctionnels cachés derrière du "mock" qu'on pensait inoffensif

### 1. `RoomDetail.tsx` peut silencieusement ne rien afficher pour de vraies chambres
**`pages/RoomDetail.tsx:7,41`** — importe `MOCK_FEATURES` depuis `mockData.ts` et filtre dessus : `MOCK_FEATURES.filter(f => room.features?.includes(f.id))`. Or les features réelles sont créées via `FeatureManagerModal.tsx` → `useCreateRoomFeature()`, avec des ids générés par la base. `mockData.ts` est documenté dans `CLAUDE.md` comme "hors scope, ignorer" — mais ce fichier est en fait importé par une page routée en production. Toute feature créée après coup (donc absente de la liste figée) ne s'affichera jamais sur `RoomDetail`, silencieusement. Ce n'est pas du mock inoffensif, c'est un bug fonctionnel déguisé en dette de test.

### 2. Le contexte de notifications force un re-render de toute l'app toutes les 30 secondes
**`context/NotificationContext.tsx:81-103`** — un `setInterval` de 30s appelle `setNotifications(prev => prev.map(...))` **inconditionnellement**, produisant une nouvelle référence de tableau même quand rien n'a changé. Combiné à l'absence de `useMemo`/`useCallback` sur la valeur du provider (137-149), **tous les consommateurs de `useNotifications()` re-rendent toutes les 30s sans raison** (`Dashboard`, `NewBookingsFeed`, `NewReservation`, `AddGuestModal`). `AuthContext.tsx:51-55` a le même défaut (value + `login`/`logout` recréés à chaque render), avec un impact moindre pour l'instant faute de consommateurs nombreux.

### 3. Du "temps relatif" est stocké comme donnée au lieu d'être calculé à l'affichage
**`context/NotificationContext.tsx:85-97,107-116`** — `notif.time` (ex. `"12m ago"`) est une chaîne stockée *dans* l'objet notification et mutée périodiquement, plutôt que dérivée de `createdAt` au moment du rendu. Une notification créée affiche `'Just now'` (111) et reste ainsi jusqu'au prochain tick — état dérivé stocké au lieu d'être calculé, classique source de désynchronisation.

### 4. De fausses notifications sont persistées en `localStorage` comme si c'était de l'activité réelle
**`context/NotificationContext.tsx:26-57,76-78`** — `INITIAL_NOTIFICATIONS` (3 événements fictifs : "Booking.com Rev", "Loyalty Upgrade") est écrit en `localStorage` au premier chargement et y reste indéfiniment. Sur un déploiement réel, un nouvel utilisateur verra ces événements inventés mélangés à l'activité réelle, sans distinction possible. Le flux (`NewBookingsFeed.tsx:16`, libellé "Live Sync") est en réalité **local au navigateur**, pas synchronisé entre membres de l'équipe — ce que le libellé suggère pourtant.

### 5. `Dashboard.tsx` contient une branche de code strictement morte
**`pages/Dashboard.tsx:55-56,127-131`** — chaque arrivée mappée reçoit `eta: '—'` et `status: 'Standard'` en dur, alors que le rendu (127-131) contient une branche de style pour un badge `'VIP'`/`'PREMIUM'` qui ne peut donc jamais s'activer. Code mort qui laisse croire qu'une fonctionnalité (distinction VIP) existe alors qu'elle a été déconnectée de sa donnée.

---

## 🟠 Composants "god object" — plusieurs responsabilités fusionnées dans un seul fichier

| Fichier | Lignes | Responsabilités mélangées |
|---|---|---|
| `pages/Reservations.tsx` | 978 | math de grille virtualisée (colonnes, scroll-sync, navigation par mois — 150+ lignes, `Reservations.tsx:90-146,193-251`), 3 renderers (grille/liste/calendrier), panneau d'actions rapides à 5 transitions de statut (858-951), indexation client de réservations (179-190) qui refait un filtrage déjà fait côté serveur |
| `pages/NewReservation.tsx` | 654 | wizard multi-étapes, combobox de recherche client fait main (296-392, sans clic-extérieur générique), sélection de chambres en `Map` avec dates par chambre (48-52,125-154), math de prix (20-24,86-96), soumission + mapping d'erreurs API |
| `components/ReassignRoomModal.tsx` | 570 | micro-framework de comparaison avant/après réinventé localement (`CompareRow`/`DeltaBadge`, 32-75,162-165) au lieu d'être partagé, math financière de delta, 3 panneaux animés indépendants |
| `pages/InvoiceView.tsx` | 421 | formulaire de génération de facture + formulaire de paiement (5 `useState` séparés, 42-46) + layout imprimable + historique de paiements — 4 zones UI distinctes dans un seul fichier |
| `components/AddRoomModal.tsx` | 383 | crée en réalité **deux objets métier indépendants** (un `RoomType`, une `Room`) dans un seul modal en 2 étapes, chacun avec sa propre validation |

Aucun de ces fichiers n'extrait sa logique (math de dates, virtualisation, comparaison de valeurs) vers un hook custom ou un sous-composant — tout vit dans le corps de la page. Un découpage type `useVirtualDayGrid()`, `<BookingQuickActionsPanel>`, `<GuestPicker>`, `<RoomSelectionList>`, `useRoomComparison()` réduirait chacun de ces fichiers de 40 à 60%.

---

## 🟡 Logique dupliquée à factoriser

- **`fmtDate` réimplémenté à l'identique** dans `InvoiceView.tsx:12-14`, `GuestProfile.tsx:14-16`, `Reservations.tsx:42-44` — même appel `toLocaleDateString('en-GB', {...})`, jamais partagé.
- **"Aujourd'hui en local YYYY-MM-DD" réimplémenté sous 2 noms différents** : `Reservations.tsx` `toStr` (33-38) vs `ReassignRoomModal.tsx` `todayStr` (25-28) — les deux portent le même commentaire expliquant le bug UTC/Madagascar déjà corrigé cette session, mais dupliqué au lieu d'être factorisé dans `lib/utils.ts`.
- **Calcul de nuits dupliqué sous 3 noms** : `roomNights` (`NewReservation.tsx:20-24`), `nightsBetween` (`ReassignRoomModal.tsx:21-23`), `bookingNights` (`GuestProfile.tsx:18-22`) — même formule `Math.max(n, (départ-arrivée)/86_400_000)`.
- **Formatage de devise incohérent** : `ReassignRoomModal.tsx:20` et `InvoiceView.tsx:15-17` font `n.toLocaleString('fr-MG') + ' Ar'` (locale explicite), mais `Reservations.tsx`, `NewReservation.tsx`, `AddRoomModal.tsx`, `EditRoomModal.tsx` font `n.toLocaleString()` **sans locale** (dépend du runtime) + `' Ar'` codé en dur, hors i18n. Deux conventions coexistent sans helper `formatCurrency()` partagé.
- **`RoomImagePicker` copié-collé à l'identique** entre `AddRoomModal.tsx` (13-18,66-68,307-346) et `EditRoomModal.tsx` (9-14,44-46,148-185) : même tableau `PRESET_PHOTOS`, même logique drag/drop, même JSX — un composant partagé à extraire.
- **Règle "departure doit être après arrival, sinon on la vide" recopiée 3 fois** (`NewReservation.tsx:403,577`, `ReassignRoomModal.tsx:208-211`) — même règle métier, 3 implémentations indépendantes.
- **Maps statut→couleur en 4 versions indépendantes** : `lib/bookingStatus.ts` (`EffectiveStatus`), `GuestProfile.tsx` `STATUS_CLASS` (24-30, clé = `BookingStatus` brut), `InvoiceView.tsx` `STATUS_CLASS` (19-25, `InvoiceStatus`), plus des chaînes de ternaires inline dans `Rooms.tsx:211-225` et `Staff.tsx:100-114` — risque de désynchronisation visuelle si un statut change de sens.
- **Pattern "chip" de filtre recopié à la main 4+ fois** (`Reservations.tsx` x2, `NewReservation.tsx`, `Rooms.tsx`) sans composant `<FilterChip>` partagé.
- **`err?.response?.data?.error` dérobé en `any` dans 7 fichiers** (`EditRoomModal.tsx:60`, `AddGuestModal.tsx:62`, `FeatureManagerModal.tsx:35`, `AddRoomModal.tsx:99`, `NewReservation.tsx:186`, `ReassignRoomModal.tsx:137`, `AddStaffModal.tsx:55`) — un helper `getApiErrorMessage(err: unknown): string` partagé éliminerait la duplication et le `any`.

---

## 🟢 Formulaires — aucune abstraction partagée

Les 8 formulaires du client (`AddStaffModal`, `AddGuestModal`, `AddRoomModal`, `EditRoomModal`, `NewReservation`, `FeatureManagerModal`, `AddAmenityModal`, `InvoiceView`) réinventent chacun indépendamment : un `useState` par champ, la validation inline dans `handleSubmit`, la gestion d'erreur, le reset. Aucun n'utilise `react-hook-form` ni de schéma Zod côté client (pourtant déjà en place côté serveur) — le typage/la validation ne sont jamais partagés entre les deux couches. `AddAmenityModal.tsx:42` illustre l'extrême : `handleSubmit` fait `console.log(...)` et ferme la modal, sans qu'aucune API/hook d'amenities n'existe dans `src/api/` ou `src/hooks/`.

**Recommandation** : `react-hook-form` + schémas Zod partagés (ou dupliqués mais alignés) entre client et serveur réduirait le volume de code de ces 8 fichiers de moitié environ et éliminerait les bugs de validation divergente.

---

## ⚪ Data-fetching & état (React Query, Context)

- **Invalidations croisées manquantes** : `useCreateRoomType`/`useUpdateRoomType`/`useDeleteRoomType` (`hooks/useRoomTypes.ts:26-48`) n'invalident que `ROOM_TYPES_KEY`, jamais `ROOMS_KEY` — pourtant `Room` embarque des données de `RoomType` (tarif, capacité) affichées dans `Rooms.tsx`/`AddRoomModal.tsx`. Idem pour `useCreateRoomFeature`/`useDeleteRoomFeature` (`hooks/useRooms.ts:62-76`) qui n'invalident que `FEATURES_KEY`.
- **Hook mort** : `useTodayArrivals` (`hooks/useBookings.ts:59-65`) est défini mais `Dashboard.tsx:22-29` recalcule "les arrivées du jour" lui-même via un `useBookings({limit:100})` générique filtré côté client — logique dupliquée, hook inutilisé.
- **Mutations manquantes** : pas de `useUpdateGuest` alors que `GuestProfile.tsx` existe comme page de détail ; pas de `useUpdateStaff` (changement de rôle) dans `hooks/useStaff.ts` bien que la route serveur existe.
- **`Staff.tsx:56-66`** — champ de recherche et bouton de filtre sans `onChange`/état : décoratifs, ne filtrent rien. Cartes de stats en en-tête ("42 Active Personnel", "18 Live Sessions", 33-36) : valeurs figées, sans rapport avec `staffList` réellement chargé.
- **Erreurs de mutation silencieuses** (déjà noté dans `review.md`, confirmé de nouveau) : la plupart des mutations de changement de statut n'ont pas de `onError` — en cas d'échec réseau, l'UI se comporte comme si ça avait marché.

---

## 🔵 Accessibilité — quasiment absente

Sur 30 fichiers pages/composants, seuls 2 contiennent un `onKeyDown` (et uniquement pour "Entrée valide ce champ"). Zéro `aria-*`, zéro `role`, zéro `tabIndex` ailleurs. Concrètement :
- **Aucune modale n'a `role="dialog"`/`aria-modal`/`aria-labelledby`**, aucune ne piège le focus ni ne le restitue au déclencheur à la fermeture (`AddStaffModal`, `AddRoomModal`, `AddGuestModal`, `EditRoomModal`, `FeatureManagerModal`, `AddAmenityModal`, `ReassignRoomModal`, `ConfirmModal`).
- **Aucune touche Échap ne ferme quoi que ce soit** (zéro occurrence de `'Escape'` dans tout `src/`).
- **Cases à cocher réinventées en `<div>`** sans `role="checkbox"`/`aria-checked` (`NewReservation.tsx:532-537`) — invisibles pour un lecteur d'écran.
- **Toggles/filtres/chips actifs signalés uniquement par la couleur** (`Reservations.tsx:318-330,391-484`), sans `aria-pressed`/`aria-current`.
- **Combobox de recherche client fait main** (`NewReservation.tsx:311-391`) sans `role="combobox"`, sans navigation clavier — sélection à la souris uniquement.

C'est un codebase accessible à la souris seulement ; à traiter si l'app doit un jour passer un audit WCAG ou servir des utilisateurs au clavier/lecteur d'écran.

---

## ⚫ Typage — `any` explicite (CLAUDE.md l'interdit)

19 occurrences hors `mockData.ts`. Le point le plus concentré : **`api/invoices.ts`** — toute la couche de normalisation des réponses serveur est non typée (`normalizeInvoice(raw: any)`, mappers `(p: any)`/`(br: any)`, `api.get<any>`/`post<any>`/`patch<any>`/`delete<any>` à 7 endroits). `GuestProfile.tsx:45` fait un `(guest as any).bookings` pour contourner un type `Guest` incomplet plutôt que de le corriger. `Amenities.tsx:14` type `icon: any` alors que `FeatureManagerModal.tsx:7` a déjà le bon type (`React.ComponentType<{className?:string}>`) pour le même genre de champ.

---

## Infrastructure & dette générale

- **Aucun code-splitting** : `App.tsx` importe les 16 pages en eager (pas de `React.lazy`/`Suspense`) — tout le bundle initial charge d'un coup.
- **Aucun `ErrorBoundary`** nulle part — un crash de rendu sur une page fait planter toute l'app (écran blanc) plutôt qu'un fallback localisé.
- **Dépendances mortes dans `client/package.json`** : `@google/genai` et `express` (le client est une SPA Vite pure, n'a besoin ni de l'un ni de l'autre) ; le champ `"name"` du package est resté `"react-example"`, résidu du template de départ.
- **Aucun test** (ni runner, ni fichier `*.test.*`) — même constat que le backend.
- **JWT en `localStorage`** (`api/client.ts`, `AuthContext.tsx`) — déjà noté dans `review.md`, toujours vrai ; exposition standard en cas de XSS, pas de fallback cookie httpOnly.

---

## Suggestion de priorisation

Si l'objectif est le rapport effort/impact le plus favorable, dans cet ordre :
1. `ErrorBoundary` + `React.lazy` sur les routes + nettoyage des dépendances mortes (quelques heures, zéro risque de régression).
2. Corriger le bug caché `RoomDetail.tsx` (features manquantes silencieuses) et retirer `MOCK_FEATURES`/`mockData.ts` du chemin de production réel.
3. Mémoiser `NotificationContext`/`AuthContext` et dériver `notif.time` au rendu au lieu de le stocker.
4. Extraire les helpers dupliqués (`fmtDate`, nuits, devise, `getApiErrorMessage`) vers `lib/` — gain immédiat de cohérence, faible risque.
5. Adopter `react-hook-form` + Zod sur un formulaire pilote (ex. `AddStaffModal`, déjà petit) avant de généraliser.
6. Découpage des god components (`Reservations.tsx` en tête) — le plus gros chantier, à traiter en dernier une fois les fondations ci-dessus posées.
