# NaturaLodge — serveur API

API Express + Prisma : toutes les règles métier et tous les accès à PostgreSQL. Démarrage et vue
d'ensemble : [`../README.md`](../README.md).

```bash
npm install
cp .env.example .env            # DATABASE_URL et JWT_SECRET au minimum
npm run db:migrate              # applique les migrations
npm run db:seed                 # données de démo (jamais en production)
npm run dev                     # http://localhost:4000, santé : /health
npm test                        # nécessite .env.test (voir .env.test.example)
```

Organisation de `src/` : une requête traverse `routes/` (HTTP, permissions) → `validation/`
(schémas Zod) → `services/` (logique métier, Prisma). Commencer la lecture par `app.ts`, qui liste
toutes les routes, puis `prisma/schema.prisma`.

| Commande | Effet |
|---|---|
| `npm run db:migrate` | Crée et applique une migration en développement (`prisma migrate dev`) |
| `npm run db:generate` | Régénère le client Prisma après une modification du schéma |
| `npm run db:seed` | Données de démo ; compte `admin` / `Admin@1234` |
| `npm run db:seed:init` | Base de production neuve : crée seulement le premier ADMIN |
| `npm run db:studio` | Explorateur de base Prisma Studio |

Règles sensibles (double réservation, transactions, factures, acomptes, permissions) :
[`../CLAUDE.md`](../CLAUDE.md). Les tests de `tests/` sont la meilleure documentation des règles
métier.
