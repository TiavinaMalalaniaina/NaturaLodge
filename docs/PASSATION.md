# Passation — NaturaLodge

Ce document liste ce qu'il faut transmettre et savoir pour reprendre le projet. Le code s'explique
dans [`README.md`](../README.md) et [`CLAUDE.md`](../CLAUDE.md) ; ici, ce sont les accès,
l'exploitation et le contexte.

Les champs **[à compléter]** sont à remplir par l'auteur actuel avant la passation.

---

## Le jour de la passation

- [ ] Session en direct (1 h 30) : démo de l'application côté personnel, puis côté client du site,
      puis tour du code avec le schéma `docs/architecture-naturalodgesi.drawio`.
- [ ] Accès transmis (tableau ci-dessous), chacun testé par le nouveau développeur.
- [ ] Le nouveau développeur lance le projet en local en suivant le `README.md`, et fait passer
      `npm test` côté serveur.
- [ ] Une première petite tâche faite ensemble jusqu'à la préprod (par exemple un bug de
      [`ETAT_DES_LIEUX.md`](ETAT_DES_LIEUX.md)).
- [ ] Une restauration de sauvegarde testée ensemble ([`SAUVEGARDES.md`](SAUVEGARDES.md)).

---

## Accès à transmettre

Les mots de passe et clés se transmettent par un **gestionnaire de mots de passe partagé**
(Bitwarden, 1Password…), jamais par email, messagerie ou dans le dépôt. Pour chaque service,
préférer **ajouter le nouveau développeur avec son propre compte** plutôt que partager un compte.

| Service | Sert à | Où c'est utilisé | Propriétaire du compte |
|---|---|---|---|
| GitHub (dépôt `NaturaLodge`) | Code, PR, CI | — | [à compléter] |
| VPS (hébergeur : Contabo) | Machine de production et préprod | Accès SSH | [à compléter] |
| Coolify | Déploiement prod / préprod, **toutes les variables d'environnement** | Interface web du VPS | [à compléter] |
| Registrar du nom de domaine + DNS | Adresses du site, de l'admin, de l'API | — | [à compléter] |
| Gmail de l'hôtel (`naturalodge.manambato@gmail.com`) | Envoi des emails du site (SMTP, mot de passe d'application) | `SMTP_USER`, `SMTP_PASSWORD` | Hôtel |
| Google Cloud Console | « Continuer avec Google » sur le site | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | [à compléter] |
| Umami | Statistiques de visite du site | `PUBLIC_UMAMI_WEBSITE_ID`, `UMAMI_UPSTREAM` | [à compléter] |
| Google Search Console | Référencement du site | Fichier `website/public/google58f19ea587f450ac.html` (ne pas supprimer) | [à compléter] |
| Grafana, Uptime Kuma | Monitoring et alertes | Tunnel SSH, voir `monitoring/README.md` | [à compléter] |
| Stockage des sauvegardes | Copies de la base hors du VPS | Voir `SAUVEGARDES.md` | [à compléter] |
| Compte ADMIN du back-office | Administration de l'application | — | Créer un compte nominatif au nouveau développeur |

Côté hôtel, utiles si le développeur fait aussi du support : page Facebook, WhatsApp de l'hôtel,
compte MVola (le système ne s'y connecte pas : les acomptes sont saisis à la main).

**Où vivent les secrets** : uniquement dans les variables d'environnement Coolify (prod et préprod)
et dans les `.env` locaux, tous ignorés par git. Les fichiers `*.example` du dépôt en donnent la
liste complète sans les valeurs. Après la passation, si l'ancien développeur ne doit plus avoir
accès : changer `JWT_SECRET` (déconnecte tout le monde), le mot de passe SMTP, le secret OAuth
Google, et retirer ses accès à GitHub, Coolify et au VPS.

---

## Faire une release

Modèle suivi jusqu'ici (voir l'historique des PR `release/x.y.z`) :

1. Les branches `feature/*` / `bugfix/*` sont mergées dans `develop` par PR.
2. `develop` est mergée dans `preprod` : Coolify redéploie la préprod. Recette sur la préprod
   (les cahiers de test à la racine servent de scénarios).
3. Créer `release/x.y.z` depuis `develop` et y mettre à jour :
   - `version` dans `client/package.json` et `server/package.json` ;
   - la version renvoyée par `/health` dans `server/src/app.ts` ;
   - `version` dans `website/package.json` (numérotation séparée, 1.x) si le site a changé ;
   - une entrée dans `CHANGELOG.md`, en signalant toute migration de base ou action manuelle.
4. PR `release/x.y.z` → `main`. Une fois mergée, Coolify déploie la production.
5. Reporter `main` dans `develop` (PR `main` → `develop`) pour que les deux restent alignées.
6. Vérifier : `https://<api>/health` renvoie la nouvelle version et `"env":"production"`.

**Vérifier dans Coolify** si le redéploiement est automatique à chaque push ou déclenché à la main
[à compléter].

**Migrations de base** : elles s'appliquent toutes seules au démarrage du conteneur serveur
(`prisma migrate deploy`). Une migration qui modifie ou supprime des données doit être précédée
d'une sauvegarde manuelle, et testée d'abord sur la préprod.

**Revenir en arrière** : dans Coolify, redéployer le commit précédent. Attention : une migration
déjà appliquée n'est pas annulée par un redéploiement. Si la migration est en cause, restaurer la
sauvegarde prise juste avant.

---

## Que faire si…

| Symptôme | Où regarder | Piste |
|---|---|---|
| Le site ou l'admin ne répond plus | Uptime Kuma, puis Coolify → logs du conteneur | Conteneur arrêté, disque plein (`df -h` sur le VPS), certificat HTTPS |
| L'API ne démarre plus après un déploiement | Logs du conteneur serveur | `lib/env.ts` refuse de démarrer si une variable est dangereuse ou absente : le message liste tout ce qui manque. Sinon, une migration en échec. |
| L'admin affiche des erreurs réseau partout | Console du navigateur | CORS : `FRONTEND_URL` doit être exactement l'adresse de l'admin |
| Les clients ne reçoivent plus d'emails | Logs du serveur (`[Website emails]`) | Mot de passe d'application Gmail révoqué ou expiré. Les emails restent en file (`WebsiteEmail`) et repartent une fois corrigé. |
| « Continuer avec Google » échoue | Google Cloud Console | `GOOGLE_REDIRECT_URI` doit correspondre exactement à l'URL autorisée |
| Un membre du personnel a oublié son mot de passe | Écran Personnel (admin) | Un ADMIN lui définit un nouveau mot de passe. Si plus aucun ADMIN ne peut se connecter : mettre à jour le hash du mot de passe en base (bcrypt, coût 12), après sauvegarde. |
| L'hôtel signale une double réservation | `booking.service.ts`, `websiteRequest.service.ts` | Ne devrait pas arriver : tout chemin qui attribue une chambre verrouille les lignes `Room`. Reproduire dans un test d'intégration avant de corriger. |
| Un montant de facture ou de compta semble faux | Écran Comptabilité, `invoice.service.ts`, `ledger.service.ts` | Ne jamais modifier les écritures en base à la main : passer par une correction dans l'application, qui génère l'écriture correctrice. |

Logs structurés : Grafana → Loki, requête `{container=~".*server.*"}`. Requêtes lentes : seuil
`SLOW_QUERY_THRESHOLD_MS` (200 ms par défaut).

---

## Pièges connus

- **`APP_ENV` ≠ `NODE_ENV`** : la préprod tourne en `NODE_ENV=production`. Pour un comportement
  propre à un environnement, tester `APP_ENV`.
- **Variables de build** : `VITE_*` (admin) et `PUBLIC_*` (site) sont figées au build. Dans Coolify,
  ce sont des *build variables* ; les changer impose un redéploiement complet, pas un redémarrage.
- **Le site doit rester sur le même domaine que son API** (relais nginx `/api/public`) : le cookie
  de session client est `SameSite=Lax`.
- **Emails** : tout envoi passe par `send()` (`websiteMail.service.ts`), sinon la redirection de la
  préprod (`MAIL_REDIRECT_TO`) ne s'applique pas et de vrais clients reçoivent des emails de test.
- **Nouvelle permission** : la déclarer dans `prisma/seedPermissions.ts` **et** dans une migration
  SQL. Le seed ne tourne jamais en production.
- **Seed de démo** : bloqué si `APP_ENV=production`. En production, seulement `db:seed:init`.
- **Le site public n'a pas de CI** : le construire en local avant toute PR qui le touche.
- **Comptabilité** : les factures et écritures suivent des règles précises (visa, avoirs,
  acomptes, écritures correctrices) décrites dans `CLAUDE.md`. Les tests de
  `server/tests/invoices/` sont la meilleure documentation ; en ajouter avant de toucher ce code.

---

## Contacts

| Rôle | Nom | Contact |
|---|---|---|
| Propriétaire de l'hôtel, décide des tarifs et des contenus | [à compléter] | [à compléter] |
| Validation des nouvelles fonctionnalités | [à compléter] | [à compléter] |
| Ancien développeur (questions après la passation) | [à compléter] | [à compléter] — disponible jusqu'au [à compléter] |
| Utilisateurs principaux du back-office | [à compléter] | [à compléter] |

---

## Cadre

À clarifier par écrit avant le démarrage [à compléter] :
- **Propriété du code** : le dépôt n'a pas de licence ; préciser qui possède le code.
- **Périmètre** : maintenance seule, ou nouvelles fonctionnalités (voir `ETAT_DES_LIEUX.md`).
- **Support** : délai attendu en cas de panne, et qui prévient qui.
- **Coûts récurrents** : VPS, nom de domaine, et qui les paie.
