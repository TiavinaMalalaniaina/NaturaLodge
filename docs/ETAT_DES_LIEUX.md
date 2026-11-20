# État des lieux — NaturaLodge

**Vérifié dans le code le 20 novembre 2026** (version 2.5.2, site public 1.1.2). Ce document
remplace l'ancienne `TODO.md` et les trois revues de code de juillet–août 2026, archivées dans
[`archives/`](archives/) : une grande partie de leurs points a été corrigée depuis (voir en bas).

Le tenir à jour à chaque release : déplacer ce qui est fait, ajouter ce qui est découvert.

---

## Ce qui fonctionne (en production)

**Back-office (`client/`)**
- Réservations multi-chambres (dates par chambre), planning en grille, liste et calendrier,
  réassignation, ajout/retrait de chambres et de suppléments en cours de séjour.
- Check-in, check-out (visa automatique de la facture), clôture ; statuts calculés côté serveur.
- Clients, notes internes, historique des séjours.
- Chambres, types de chambre, caractéristiques, catalogue de suppléments, mise en maintenance.
- Facturation complète : facture unique par séjour qui suit le séjour même visée, acomptes,
  avoirs d'annulation, remboursement de trop-perçu, écritures comptables correctrices.
- Paiements, trésorerie (accès aux caisses par rôle), dépenses.
- Comptabilité : plan comptable, écritures, bilan, compte de résultat, export CSV.
- KPI (occupation, facturation, rentabilité) et rapports.
- Personnel, rôles et permissions configurables sans redéploiement, journal d'audit.
- Demandes du site : acceptation / refus, preuves de paiement, confirmation, notifications push.
- Interface FR / EN / MG, application installable (PWA).

**Site public (`website/`)**
- Vitrine FR/EN, demande de réservation avec disponibilités et tarifs réels.
- Compte client (email + mot de passe ou Google), suivi des demandes, envoi de preuve MVola.
- Emails transactionnels, référencement (sitemap, hreflang, données structurées, GPS),
  mesure d'audience Umami sans cookies (si configurée).

**Exploitation**
- Préprod et production sur Coolify, migrations automatiques, contrôle de configuration au démarrage.
- Monitoring : métriques, logs centralisés, disponibilité.
- Tests d'intégration serveur sur vrai Postgres et CI sur `server/` et `client/`.

---

## Bugs connus

| # | Gravité | Problème | Où | Piste de correction |
|---|---|---|---|---|
| 1 | 🔴 Haute | **Un compte désactivé ou rétrogradé garde ses droits** jusqu'à l'expiration de son jeton (7 jours par défaut). `authenticate` fait confiance au rôle inscrit dans le jeton ; seule la connexion vérifie le statut. | `server/src/middleware/auth.ts` | Relire statut et rôle en base dans `authenticate` (avec un petit cache), ou un numéro de version de jeton incrémenté à chaque changement. Ajouter un test. |
| 2 | 🔴 Haute | **Aucune limite de tentatives de connexion** : mots de passe attaquables par force brute, côté personnel comme côté clients du site. | `POST /api/auth/login`, `POST /api/public/auth/login` | `express-rate-limit` sur les routes d'authentification (attention à `TRUST_PROXY` pour avoir la vraie IP). |
| 3 | 🟠 Moyenne | **Une photo de chambre importée depuis l'ordinateur disparaît** : elle est enregistrée comme adresse `blob:` locale au navigateur, illisible après rechargement et sur les autres postes. Les photos par URL ou prédéfinies fonctionnent. | `client/src/components/RoomImagePicker.tsx` (`handleFile`) → `Room.images` | Vrai envoi de fichier au serveur (stockage disque ou objet), ou retirer l'import local en attendant. |
| 4 | 🟠 Moyenne | **Le taux de TVA se saisit à la main sur chaque facture**, à 0 % par défaut : risque d'oubli ou d'incohérence entre factures. | `client/src/pages/InvoiceView.tsx`, `validation/invoice.schema.ts` | Une configuration globale (`HotelConfig`, jamais construite) ou un taux par défaut côté serveur. À décider avec le comptable. |
| 5 | 🟡 Basse | **La recherche de la barre du haut ne fait rien** (champ sans état ni action). | `client/src/components/Navigation.tsx` | Brancher sur une recherche (clients, réservations) ou retirer le champ. |

---

## À faire ou à décider

**Fonctionnel**
- Changement de son propre mot de passe (aujourd'hui : seulement à la première connexion, ou par
  un ADMIN).
- Page Paramètres : ne contient que la langue. Décider si on y met la configuration de l'hôtel
  (TVA, coordonnées sur les factures…).
- Gestion des no-shows (une réservation non honorée reste « en retard »).
- Facture en PDF : aujourd'hui, impression depuis le navigateur uniquement.
- Liste du personnel sans pagination serveur (sans conséquence tant que l'équipe est petite).

**Qualité**
- Aucun test automatisé côté `client/` et `website/` ; le site n'est pas couvert par la CI.
- Accessibilité : les fenêtres modales passent par `components/Modal.tsx` (rôle dialog, focus,
  Échap), sauf `ConfirmWebsiteRequestModal.tsx`, à migrer. Le reste de l'interface n'a pas été
  audité depuis la revue d'août.
- Jeton du personnel stocké en `localStorage` : exposé en cas de faille XSS. Risque accepté
  jusqu'ici ; un cookie `httpOnly` serait plus sûr.
- 4 `any` explicites restants (1 client, 3 serveur), alors que la convention les interdit.
- Version de Node non fixée (`.nvmrc` absent) : 22 pour client et serveur, 24 pour le site.

**Exploitation**
- **Sauvegardes automatiques de la base hors du VPS, et restauration testée** : aucune procédure
  en place à ce jour. Priorité n°1, voir [`SAUVEGARDES.md`](SAUVEGARDES.md).
- Vérifier que les alertes Uptime Kuma sont configurées et arrivent à quelqu'un.

---

## Corrigé depuis les revues de juillet–août 2026

À ne pas refaire en lisant les archives :
- Crash du serveur sur une requête invalide → `asyncHandler` + `errorHandler`.
- Auto-promotion MANAGER → ADMIN → permission `staff.assign_role`.
- Données financières lisibles par tous → matrice de permissions.
- Double réservation concurrente → verrou `FOR UPDATE` sur les chambres.
- Numérotation des factures non atomique → verrou consultatif (`lib/advisoryLock.ts`).
- Annulation d'un paiement sur la mauvaise facture, suppression d'une note d'un autre client
  → vérifications d'appartenance.
- Suppression d'un client lié à des réservations → erreur 409 explicite.
- Écrans factices (file d'arrivées, disponibilités inventées, faux enregistrement des paramètres,
  ajout de personnel, recherche du personnel) → branchés ou retirés ; plus aucune donnée `MOCK_`.
- Pas de journal d'audit, de notifications serveur, de reporting, d'avoirs, d'emails clients
  → tous construits.
- Pas d'`ErrorBoundary` ni de chargement différé des pages → en place.
- Modales inaccessibles (ni rôle, ni focus, ni Échap) → composant commun `Modal.tsx`.
- Déploiement inexistant → préprod et production sur Coolify.
