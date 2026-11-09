# Environnements — développement, préprod, production

Trois environnements, distingués par **`APP_ENV`** (`development` | `preprod` | `production`).
`NODE_ENV` reste un réglage technique (`production` = cookies sécurisés, logs JSON…) : la préprod
tourne en `NODE_ENV=production` pour se comporter exactement comme la prod, et c'est `APP_ENV`
qui la rend identifiable.

| | Développement | Préprod | Production |
|---|---|---|---|
| Où | Machine locale (`npm run dev` / `make dev`) | VPS Coolify, ressources dédiées | VPS Coolify |
| Branche Git | `feature/*`, `bugfix/*`, `develop` | `preprod` | `main` |
| Déploiement | — | Auto à chaque push sur `preprod` | Auto à chaque push sur `main` |
| `NODE_ENV` | `development` | `production` | `production` |
| Base de données | Postgres local | **Base dédiée** (jamais celle de prod) | Base de prod |
| Données | `npm run db:seed` (démo) | Seed de démo ou copie **anonymisée** | Réelles — `db:seed:init` uniquement (seed démo bloqué) |
| Logs | `debug`, lisibles (pino-pretty) | `debug`, JSON | `info`, JSON |
| Emails | Désactivés si `SMTP_HOST` vide | **Tous redirigés** vers `MAIL_REDIRECT_TO` | Envoyés aux clients |
| Push (VAPID) | Optionnel | Paire de clés propre | Paire de clés propre, à ne jamais changer |
| `JWT_SECRET` | Libre | Propre à la préprod, ≥ 32 car. | Propre à la prod, ≥ 32 car. |
| Durée du jeton | `7d` | `1d` | `7d` |
| URLs | `http://localhost:*` | `https://` obligatoire | `https://` obligatoire |
| Admin (client) | Badge bleu « Développement » | Badge orange « Préprod », titre `[PREPROD]`, PWA « NL Preprod » orange | Aucun badge |
| Site public | — | `noindex` (X-Robots-Tag + robots.txt) | Indexé |

## Contrôle au démarrage

`server/src/lib/env.ts` valide la configuration au démarrage. Si `APP_ENV` vaut `preprod` ou
`production`, le serveur **refuse de démarrer** quand :
- `NODE_ENV` n'est pas `production` ;
- `JWT_SECRET` fait moins de 32 caractères ou est encore la valeur d'exemple ;
- `FRONTEND_URL` / `WEBSITE_URL` manquent ou ne sont pas en `https://`.

Les erreurs s'affichent toutes ensemble dans les logs du conteneur. `GET /health` renvoie aussi
`env` : c'est un moyen rapide de vérifier sur quel environnement on se trouve.

Sans `APP_ENV`, le serveur considère qu'il est en `development` (aucune vérification stricte). Il
faut donc **ajouter `APP_ENV` dans Coolify** sur les ressources existantes.

## Fichiers de référence

| Package | Développement | Préprod | Production |
|---|---|---|---|
| server | `server/.env.example` → copier en `server/.env` | `server/.env.preprod.example` | `server/.env.production.example` |
| client | `client/.env.example` → copier en `client/.env` | build arg `VITE_APP_ENV=preprod` | build arg `VITE_APP_ENV=production` (défaut) |
| website | `website/.env.example` | build arg `PUBLIC_APP_ENV=preprod` ; `API_UPSTREAM` = conteneur server de préprod | `API_UPSTREAM` = conteneur server de prod |

Les modèles préprod/prod servent de **liste de contrôle des variables à saisir dans Coolify**. Ne
jamais les committer remplis.

`VITE_*` et `PUBLIC_*` sont figés dans le JS au **build** : dans Coolify, ce sont des *build
variables*, pas des variables d'exécution. Changer d'environnement impose un rebuild.

## Préprod avec Docker Compose (`docker-compose.preprod.yml`)

Alternative aux ressources Coolify : toute la préprod dans une stack Compose isolée, sur le même VPS que la prod.

```bash
cp .env.preprod.example .env.preprod   # remplir : identifiants, URLs https, SMTP, MAIL_REDIRECT_TO
make preprod-up                         # build + démarrage
make preprod-seed                       # données de démo
```

- **Isolation** : nom de projet, réseau (`naturalodge-preprod-network`) et volume propres, identifiants de base obligatoires et distincts. Aucun service `db` ou `server` n'est partagé avec la prod.
- **Exposition** : la base et l'API ne sont jamais publiées. Seuls l'admin (`PREPROD_CLIENT_PORT`, 8181) et le site (`PREPROD_WEBSITE_PORT`, 4421) le sont, sur `127.0.0.1`, derrière le reverse proxy TLS du VPS. Protéger ces deux domaines (authentification HTTP ou liste d'IP) : la préprod contient des comptes de démo.
- **Emails** : envoyés réellement, mais tous vers `PREPROD_MAIL_REDIRECT_TO`, avec le vrai destinataire dans le sujet. Les liens de connexion de l'espace client y arrivent aussi.
- **Ressources** : limites CPU/mémoire par service, pour ne jamais affamer la prod.

## Mise en place de la préprod sur Coolify

1. Dans le même projet Coolify, créer un environnement **preprod** avec ses propres ressources :
   `db` (Postgres 16), `server`, `client` et `website`, toutes branchées sur la branche Git `preprod`.
2. **server** : reporter `server/.env.preprod.example`, avec un `DATABASE_URL` pointant vers la db de préprod.
3. **client** : build variable `VITE_APP_ENV=preprod` ; `API_UPSTREAM` = nom du conteneur server de préprod.
4. **website** : build variable `PUBLIC_APP_ENV=preprod` ; variable d'exécution `API_UPSTREAM` = nom du conteneur server de préprod. Le site appelle l'API via sa propre origine (`/api/public`, relayé par son nginx) : ne pas définir `PUBLIC_API_URL` vers un autre domaine, le cookie de session client (`SameSite=Lax`) ne serait plus envoyé.
5. Attribuer les domaines (par ex. `admin-preprod.…` et `preprod.…`), qui doivent correspondre à
   `FRONTEND_URL` et `WEBSITE_URL`.
6. Premier déploiement, puis `npx tsx prisma/seed.ts` (démo) depuis le terminal du conteneur server.

## Cycle de livraison

```
feature/* ──PR──▶ develop ──merge──▶ preprod ──recette OK──▶ main
   (dev local)                     (tests sur la préprod)     (prod)
```

Un hotfix part de `main`. Il est ensuite reporté sur `preprod` et `develop`.
