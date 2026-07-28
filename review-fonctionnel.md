# Revue fonctionnelle — NaturaLodge

Contrairement à `review.md` (bugs, sécurité, qualité de code), ce document évalue **ce que l'application fait réellement pour son métier** : la gestion hôtelière au quotidien. Basé sur l'usage direct de l'app et la lecture de chaque écran/route.

---

## Verdict global

Le cœur du produit — **cycle de vie d'une réservation** (à venir → arrivée du jour → en séjour → en retard → sortie) — est bien pensé et bien implémenté : le statut effectif calculé côté client/serveur, la synchronisation automatique du statut des chambres, la grille de planning virtualisée, tout ça tient la route et a été durci au fil de cette session (statut de chambre qui ne se réinitialise plus faussement, réservation qui occupe la chambre immédiatement). C'est la partie la plus solide de l'app.

En revanche, l'application donne l'impression d'un produit **plus complet qu'il ne l'est** : plusieurs écrans du menu principal (Personnel, Paramètres, Équipements, une partie du Tableau de bord) affichent une interface soignée qui ne fait rien ou presque en réalité. Pour un usage en production, ce sont les priorités avant les fonctionnalités secondaires.

---

## Ce qui fonctionne bien

- **Réservations** (`Reservations.tsx`, `NewReservation.tsx`, `BookingDetail.tsx`) : création multi-chambres avec dates indépendantes par chambre, vérification de conflit, check-in/check-out/annulation, réassignation de chambre avec détection de conflit. Le parcours de bout en bout fonctionne.
- **Statuts de chambre** : calcul automatique occupé/disponible à partir des réservations actives, avec prise en compte correcte des séjours prolongés ("en retard") — corrigé cette session.
- **Clients** (`Guests.tsx`, `GuestProfile.tsx`) : recherche, pagination, historique de séjours, notes internes — bien branché à l'API, pas de données fictives.
- **Facturation de base** : génération depuis une réservation, enregistrement de paiements multi-méthodes, statut recalculé automatiquement (payée/partiellement payée). Fonctionne, mais reste basique (voir plus bas).
- **Chambres** (`Rooms.tsx`, `RoomDetail.tsx`) : disponibilité en temps réel, mise en maintenance avec détection des réservations impactées, filtrage par type de chambre.
- **Infrastructure** : Docker/Compose, PWA installable, i18n à 3 langues (FR/EN/MG) — bonne base pour un déploiement réel.

---

## Ce qui ne fonctionne pas ou n'existe pas vraiment

### Personnel (`Staff.tsx`, `AddStaffModal.tsx`)
Le bouton "ajouter un membre du staff" ne crée personne (juste un `console.log`). La recherche du tableau ne filtre rien. Les compteurs en en-tête sont des chiffres fixes sans rapport avec les vraies données. **En l'état, on ne peut pas gérer une équipe depuis cet écran** — il faut passer par un outil externe (Prisma Studio, SQL direct) pour créer un compte staff.

### Paramètres (`Settings.tsx`)
Écran entièrement décoratif : "Enregistrer" simule un chargement de 1,5s puis affiche un succès, sans rien envoyer ni persister. Le taux de TVA, censé être configurable globalement (et documenté comme tel dans l'ancien `CLAUDE.md`), n'existe nulle part côté serveur — il n'y a ni route `/api/settings`, ni modèle en base. En pratique, **la TVA se ressaisit manuellement à chaque facture**, ce qui est source d'erreur (oubli, faute de frappe) pour un établissement qui applique toujours le même taux.

### Équipements (`Amenities.tsx`)
Page 100% fictive : aucune route backend, aucun modèle Prisma pour les équipements (piscine, spa, salle de sport...). Toutes les données affichées (statut, taux d'usage, prochaine maintenance) sont codées en dur dans le composant. C'est une maquette, pas une fonctionnalité.

### Tableau de bord (`Dashboard.tsx`)
Mélange de vrai et de faux : les métriques du haut (occupation, revenu du jour, arrivées) sont calculées à partir de vraies données. Mais le panneau **"Check-in Queue"** est entièrement simulé (3 noms fixes, badge "3 Active" figé), et l'alerte opérationnelle en bas ("Housekeeping requires priority for Suite 402...") est un texte fixe, pas une vraie notification. Un utilisateur pourrait croire à tort qu'il y a une file d'attente ou une alerte réelle à traiter.

---

## Le rôle HOUSEKEEPING n'a aucune fonctionnalité dédiée

Le modèle de permissions distingue 4 rôles (`ADMIN`, `MANAGER`, `RECEPTIONIST`, `HOUSEKEEPING`), mais **aucun écran n'est pensé pour le personnel d'entretien** : pas de liste de chambres à nettoyer, pas de statut "en cours de nettoyage"/"prête", pas de checklist. Un compte HOUSEKEEPING voit exactement le même tableau de bord qu'un manager (réservations, clients, et même les factures — cf. `review.md` point 4 sur l'absence de restriction d'accès aux factures). Le rôle existe dans la base de permissions mais pas dans le produit.

---

## Manques pour un usage hôtelier réel (au-delà des écrans cassés)

- **Pas de gestion des no-shows / overbooking volontaire** : une réservation `CONFIRMED` dont la fenêtre passe sans check-in reste "en retard" indéfiniment (statut effectif `overdue`), sans action automatique ni rappel.
- **Devise fixe** : tous les montants sont affichés en Ariary (`Ar`) codé en dur — pas de multi-devise, ce qui est cohérent pour un hôtel local à Madagascar mais limite toute extension internationale.
- **Pas de notifications externes** : aucun email/SMS de confirmation au client (réservation, facture) — tout reste interne à l'outil staff.
- **Pas de reporting** au-delà des 4 tuiles du Dashboard : pas d'historique d'occupation, pas de RevPAR ou autres indicateurs hôteliers standards, pas d'export.
- **Pas de piste d'audit** : les actions sensibles (changement de rôle, annulation de réservation, remboursement) ne sont pas journalisées nommément quelque part de consultable — on sait *que* c'est arrivé, pas facilement *qui* l'a fait et quand, en dehors des champs `createdBy`/`processedBy` bruts en base.
- **Facturation basique** : pas de note de crédit/avoir formalisée (juste "annuler un paiement"), pas d'export PDF (impression navigateur uniquement), pas de relance automatique sur facture en retard malgré la présence d'un champ `dueAt`.

---

## Priorités suggérées

1. **Personnel** : brancher `AddStaffModal` sur une vraie création (l'API `POST /staff` existe déjà côté serveur — il ne manque que l'appel côté client). C'est le manque le plus trompeur : l'UI laisse croire que ça marche.
2. **Paramètres / TVA** : soit implémenter `HotelConfig` a minima pour la TVA (évite la ressaisie manuelle source d'erreur), soit retirer l'écran tant qu'il ne fait rien.
3. **Dashboard** : brancher "Check-in Queue" sur les vraies arrivées du jour (la donnée existe déjà via `useBookings`/`todayArrivals`, il "suffit" de remplacer `MOCK_QUEUE`) ou retirer le panneau.
4. **Amenities** : décider si c'est une fonctionnalité voulue (auquel cas ça mérite un vrai modèle + routes) ou à retirer du menu pour ne pas donner une fausse impression de couverture fonctionnelle.
5. **Housekeeping** : soit construire un vrai écran pour ce rôle, soit le retirer du système de permissions si l'app ne le sert pas encore.

Les points 1 à 4 sont chacun de petite taille (quelques heures) puisque l'API ou les données existent déjà dans la plupart des cas — c'est le branchement frontend↔backend qui manque, pas l'architecture.
