# Monitoring — NaturaLodge

Stack de monitoring auto-hébergée sur la VPS Contabo. Déploiement Coolify : `db`/`server`/`client`
sont 3 ressources Coolify séparées (pas ce repo déployé via `docker-compose.yml`), donc ce stack
se raccroche au réseau Docker **global** que Coolify partage entre toutes ses ressources
(`docker network ls` → `coolify`) plutôt qu'à un réseau propre à ce projet. Indépendant de l'app —
s'arrête, se met à jour et redémarre sans jamais toucher à la prod.

## Ce que ça couvre

| Couche | Outil | Ce qu'il donne |
|---|---|---|
| Infra (VPS) | node-exporter | CPU, RAM, disque, réseau de la machine |
| Conteneurs | cAdvisor | CPU/RAM/réseau par conteneur (`db`, `server`, `client`) |
| Base de données | postgres-exporter | Connexions actives, cache hit ratio, taille des tables |
| Reverse proxy | nginx-prometheus-exporter | Requêtes actives, connexions |
| App (Node/Express) | `/metrics` (prom-client, dans `server/src/middleware/metrics.ts`) | Latence p50/p95/p99 par route, requêtes/s, taux d'erreur 5xx, event loop lag, mémoire heap |
| Base de données (requêtes) | logs `slow_prisma_query` (`server/src/lib/prisma.ts`) | Requêtes Prisma > 200ms (seuil réglable via `SLOW_QUERY_THRESHOLD_MS`) |
| Logs centralisés | Loki + Promtail | Logs JSON structurés (pino) des 3 conteneurs, recherchables dans Grafana |
| Visualisation | Grafana | Dashboard "NaturaLodge — App Performance" pré-provisionné + import des dashboards communautaires ci-dessous |
| Disponibilité | Uptime Kuma | Ping `/health` + site public, notifications Telegram/Discord/email |

## Identifier les 3 conteneurs de l'app (une fois, ou après un redéploiement)

Coolify fixe un nom stable pour `server` (`naturalodge-server-container`) et `client`
(`naturalodge-client-container`, épinglé le 2026-09-15) — déjà dans `monitoring/promtail-config.yml`
et les valeurs par défaut de `docker-compose.monitoring.yml`. `db` génère encore un nom aléatoire
à chaque redéploiement. Vérifier via SSH :

```bash
docker ps --format '{{.Names}}\t{{.Image}}'
```

Repérer l'image `postgres:16-alpine` (= `db`, ≠ `coolify-db` qui est la base interne de Coolify).
Nom constaté le 2026-09-15 : `db=fyras9iwq30860e2irn6oogg` — à revérifier si le monitoring perd
les métriques/logs de la base après un redéploiement.

**Fix permanent recommandé** : dans l'UI Coolify, ressource `db` → onglet Advanced/General →
renseigner un *Container Name* fixe (comme déjà fait pour `server` et `client`) — évite de revenir
sur ce fichier à chaque redéploiement.

## Démarrage

Récupérer les identifiants réels de la base Postgres dans Coolify (ressource `db` →
Configuration/Environment Variables — `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`), puis :

```bash
ssh <user>@<vps-ip>
cd /chemin/vers/le/repo && git pull

export POSTGRES_EXPORTER_DSN="postgresql://<user>:<password>@fyras9iwq30860e2irn6oogg:5432/<db>?sslmode=disable"
# CLIENT_CONTAINER : inutile de le redéfinir, la valeur par défaut (naturalodge-client-container)
# correspond au nom fixé côté Coolify — seulement si tu le renommes à nouveau.
export GRAFANA_ADMIN_PASSWORD="<choisis un vrai mot de passe>"

docker compose -f docker-compose.monitoring.yml up -d
```

Grafana : http://127.0.0.1:3000 (login `admin` / le mot de passe défini ci-dessus).
Uptime Kuma : http://127.0.0.1:3001 (compte admin à créer au premier accès).

Astuce : mettre ces trois `export` dans un fichier `.env` à la racine du repo sur la VPS
(`docker compose` le charge automatiquement) plutôt que de les retaper à chaque fois — ne
jamais commiter ce `.env` (secrets réels dedans).

## ⚠️ Accès aux dashboards depuis l'extérieur

Grafana et Uptime Kuma sont **volontairement liés à `127.0.0.1`** dans
`docker-compose.monitoring.yml` — ni l'un ni l'autre n'a de TLS ni de protection anti-bruteforce
sérieuse par défaut, donc jamais exposés directement sur Internet. Deux façons d'y accéder depuis
ton poste :

**Option simple — tunnel SSH** (rien à configurer côté VPS) :
```bash
ssh -L 3000:localhost:3000 -L 3001:localhost:3001 <user>@<vps-ip>
```
Puis ouvrir http://localhost:3000 / http://localhost:3001 normalement.

**Option durable — domaine via Coolify**, si tu veux y accéder sans tunnel à chaque fois : Coolify
gère déjà un Traefik (`coolify-proxy`) pour toutes ses ressources avec TLS Let's Encrypt
automatique. Ce stack étant lancé en dehors de la gestion Coolify (simple `docker compose` par
SSH), il n'a pas de labels Traefik par défaut — le plus simple et le plus fiable reste d'importer
`docker-compose.monitoring.yml` comme une ressource **Docker Compose** dans l'UI Coolify (même
Projet/Environnement que `db`/`server`/`client`, pour rester sur le réseau `coolify`) : Coolify
propose alors normalement un domaine + TLS automatique pour le port de Grafana, sans toucher aux
labels Traefik à la main. Le login Grafana reste la seule couche d'auth — la conserver forte.

## Import des dashboards communautaires

Le dashboard "NaturaLodge — App Performance" est provisionné automatiquement (dossier
`grafana/dashboards/`). Pour les vues plus détaillées CPU/RAM/disque et par conteneur, importer
manuellement dans Grafana (⊞ Dashboards → New → Import) :

- **1860** — Node Exporter Full (infra VPS)
- **14282** — cAdvisor / Docker Container (par conteneur)
- **9628** — PostgreSQL Database

Sélectionner la datasource `Prometheus` à l'import.

## Alertes

- **Uptime Kuma** : configurer un canal de notification (Telegram/Discord/email) dans Settings →
  Notifications, puis l'associer à chaque moniteur créé.
- **Grafana Alerting** : règles suggérées à créer sur le dashboard "NaturaLodge — App Performance"
  — CPU/RAM VPS > 85% pendant 5 min, disque > 85%, taux de requêtes 5xx > quelques % sur 5 min,
  event loop lag > 100ms soutenu.
- Un moniteur d'uptime **hébergé sur la même VPS ne peut pas alerter si la VPS entière tombe** —
  ajouter un check externe indépendant (ex. UptimeRobot, tier gratuit, intervalle 5 min) sur
  l'URL publique du site en plus d'Uptime Kuma.

## Rétention

- Prometheus : 15 jours (`--storage.tsdb.retention.time`, `docker-compose.monitoring.yml`)
- Loki : 15 jours (`retention_period`, `monitoring/loki-config.yml`)

Ajuster ces valeurs selon l'espace disque disponible sur la VPS — les métriques/logs ne sont pas
un remplacement du modèle `AuditLog` en base (rétention illimitée, traçabilité métier), ce sont
des données de diagnostic court terme.

## Arrêt

```bash
make monitoring-down       # arrête, conserve les données (métriques/logs/dashboards)
docker compose -f docker-compose.monitoring.yml down -v   # arrête ET efface tout (rare)
```
