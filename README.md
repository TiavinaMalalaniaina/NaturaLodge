# NaturaLodge

Logiciel de gestion de l'hôtel **Natura Lodge** (Manambato, Madagascar) : réservations, séjours,
facturation, comptabilité, et le site public sur lequel les clients font leurs demandes de réservation.

| Dossier | Rôle | Stack | Port local |
|---|---|---|---|
| [`server/`](server/) | API et toutes les règles métier | Express 4, TypeScript, Prisma 7, PostgreSQL 16 | 4000 |
| [`client/`](client/) | Back-office du personnel | React 19, Vite 6, TanStack Query, Tailwind 4 | 3000 |
| [`website/`](website/) | Site public (vitrine FR/EN + espace client) | Astro (statique), Tailwind 4 | 4321 |

Les deux interfaces ne se parlent jamais : elles passent par le serveur, seul à toucher la base.
Schémas : [`docs/architecture-naturalodgesi.drawio`](docs/architecture-naturalodgesi.drawio)
(à ouvrir avec l'extension VS Code « Draw.io Integration » ou sur app.diagrams.net).

---

## Démarrer en local

**Prérequis** : Node.js 22 (le site public est construit en Node 24 en production, mais tourne en
22), npm, et PostgreSQL 16 — installé localement, ou via Docker (`make db-up`).

```bash
# 1. Dépendances (client + serveur)
make install
cd website && npm ci && cd ..

# 2. Base de données (si pas de Postgres local) : naturalodge / naturalodge sur le port 5432
make db-up

# 3. Configuration du serveur
cp server/.env.example server/.env
#   DATABASE_URL="postgresql://naturalodge:naturalodge@localhost:5432/naturalodge?schema=public"
#   JWT_SECRET=<une longue chaîne aléatoire>
#   WEBSITE_URL=http://localhost:4321   (pour le site public)
#   SMTP, Google OAuth et VAPID peuvent rester vides en local.

# 4. Tables + données de démo
cd server && npm run db:migrate && npm run db:seed && cd ..

# 5. Lancer (un terminal chacun)
make dev-server                     # http://localhost:4000
make dev-client                     # http://localhost:3000
cd website && npm run dev           # http://localhost:4321
```

**Connexion de démo** au back-office : `admin` / `Admin@1234` (créé par `npm run db:seed`,
uniquement en local ; le seed de démo refuse de tourner si `APP_ENV=production`).

Pour une base de production neuve, on n'utilise jamais le seed de démo mais `npm run db:seed:init`,
qui crée uniquement le premier compte ADMIN (`INIT_ADMIN_USERNAME`, `INIT_ADMIN_EMAIL`,
`INIT_ADMIN_PASSWORD` ; sans mot de passe fourni, il en génère un et l'affiche une seule fois).

Alternative tout-Docker : `make up` lance db + server + client, puis `make seed`. `make help`
liste toutes les commandes.

---

## Vérifier son travail

```bash
cd server && npm test               # tests d'intégration sur un vrai Postgres (base *_test)
cd server && npx tsc --noEmit
cd client && npm run typecheck && npm run lint
cd website && npm run build
```

Les tests serveur demandent une base dédiée : `cp server/.env.test.example server/.env.test`, avec
une base dont le nom finit par `_test` (elle est supprimée et recréée à chaque lancement).
La CI GitHub lance les tests serveur et les vérifications client sur chaque PR qui touche
`server/` ou `client/`. **Le site public (`website/`) n'est pas couvert par la CI** : le construire
localement avant de pousser.

---

## Branches et livraison

```
feature/* ou bugfix/* ──PR──▶ develop ──▶ preprod (recette) ──▶ main (production)
```

- `preprod` et `main` sont déployées par Coolify sur le VPS.
- Un hotfix part de `main`, puis est reporté sur `preprod` et `develop`.
- Chaque release met à jour [`CHANGELOG.md`](CHANGELOG.md) et les numéros de version
  (voir [`docs/PASSATION.md`](docs/PASSATION.md#faire-une-release)).

---

## Documentation

| Document | Pour quoi faire |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | **Référence technique** : architecture, conventions, règles métier sensibles (double réservation, factures, acomptes, statuts). À lire en entier. |
| [`docs/PASSATION.md`](docs/PASSATION.md) | Accès à récupérer, release, que faire en cas de panne, contacts |
| [`docs/ETAT_DES_LIEUX.md`](docs/ETAT_DES_LIEUX.md) | Ce qui marche, les bugs connus, ce qui reste à faire |
| [`docs/SAUVEGARDES.md`](docs/SAUVEGARDES.md) | Sauvegarde de la base (rclone → Google Drive) et restauration |
| [`ENVIRONNEMENTS.md`](ENVIRONNEMENTS.md) | Développement / préprod / production, variables à saisir dans Coolify |
| [`MANUEL_UTILISATION.md`](MANUEL_UTILISATION.md) | L'application vue par le personnel de l'hôtel |
| [`CAHIER_DE_CONCEPTION.md`](CAHIER_DE_CONCEPTION.md) | Besoins et conception d'origine |
| [`CAHIER_DE_TEST_RESERVATIONS.md`](CAHIER_DE_TEST_RESERVATIONS.md), [`CAHIER_DE_TEST_INVOICE.md`](CAHIER_DE_TEST_INVOICE.md) | Scénarios de recette manuelle |
| [`monitoring/README.md`](monitoring/README.md) | Grafana, Prometheus, Loki, Uptime Kuma |
| [`website/README.md`](website/README.md) | Modifier les contenus et textes du site public |
| [`docs/archives/`](docs/archives/) | Anciennes TODO et revues de code (juillet–août 2026), remplacées par l'état des lieux |
