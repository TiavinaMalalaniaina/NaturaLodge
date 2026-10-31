# Monitoring — Guide d'utilisation

Ce guide suppose que le stack tourne déjà (voir `monitoring/README.md` pour l'installation). Il
répond à « comment je m'en sers au quotidien », pas à « comment je l'installe ».

## Accès

Grafana et Uptime Kuma ne sont jamais exposés publiquement — toujours passer par un tunnel SSH
depuis ton poste :
```bash
ssh -L 3000:localhost:3000 -L 3001:localhost:3001 tiavinamalalaniaina@vmi3487422
```
Puis, tant que ce terminal reste ouvert :
- Grafana : http://localhost:3000 (`admin` / mot de passe défini au premier démarrage)
- Uptime Kuma : http://localhost:3001

Prometheus n'a pas d'interface exposée directement (accessible seulement via Grafana ou en
interne). Pour vérifier un point précis sans passer par Grafana :
```bash
docker exec naturalodge-prometheus-1 wget -qO- http://localhost:9090/api/v1/targets \
  | grep -o '"job":"[^"]*"\|"health":"[^"]*"'
```

## Grafana — dashboard "NaturaLodge — App Performance"

C'est le point d'entrée par défaut (Dashboards → NaturaLodge — App Performance). Ce qu'il montre :

| Panel | Ce que ça veut dire | Signal d'alerte |
|---|---|---|
| Latence p50/p95/p99 par route | Temps de réponse de l'API | p95 qui grimpe sur une route précise = requête DB lente ou charge |
| Requêtes/s | Trafic réel sur l'API | Chute brutale = panne ou déploiement cassé ; pic inhabituel = bot/abus |
| Taux d'erreur 5xx | % de requêtes qui plantent côté serveur | > quelques % = bug en prod à traiter en priorité |
| Event loop lag (Node) | Le serveur Node est-il bloqué par du calcul synchrone ? | Lag soutenu > 100ms = quelque chose bloque la boucle d'événements (à chercher dans le code) |
| Mémoire heap | Consommation mémoire du process Node | Croissance continue sans redescendre = fuite mémoire probable |

En haut à droite : le sélecteur de plage de temps (dernières 15 min / 1h / 24h / etc.) et l'auto-refresh.
Toujours commencer une investigation en élargissant la plage (ex. 6h) pour voir *quand* ça a changé.

### Dashboards communautaires (si importés — voir README)
- **1860 (Node Exporter Full)** : CPU/RAM/disque/réseau de la VPS elle-même. À consulter si Grafana
  te dit que tout va bien côté app mais que le site reste lent quand même — le problème est peut-être
  la machine, pas le code.
- **14282 (cAdvisor)** : CPU/RAM par conteneur individuellement (`db`, `server`, `client`, mais aussi
  `cadvisor`/`prometheus`/`loki` eux-mêmes). Utile pour repérer qu'un conteneur du monitoring
  consomme trop et ralentit tout le reste — surveille en particulier `cadvisor` lui-même, connu pour
  être gourmand en CPU.
- **9628 (PostgreSQL)** : connexions actives, cache hit ratio, taille des tables. Un cache hit ratio
  qui chute ou des connexions qui saturent = piste pour un problème de perf côté base.

## Explore — chercher dans les logs (Loki)

Grafana → menu de gauche → **Explore** → datasource **Loki** en haut.

Requêtes utiles :
```logql
{container="naturalodge-server-container"}                # tous les logs du serveur
{container="naturalodge-server-container"} | json | level="error"   # seulement les erreurs
{container="naturalodge-server-container"} |= "slow_prisma_query"   # requêtes DB lentes (>200ms)
{container="naturalodge-client-container"}                 # logs nginx du frontend
```
`|=` = recherche texte brut. `| json` = parse le JSON pino puis permet de filtrer sur un champ
(`level`, `msg`, etc.). Le sélecteur de temps en haut à droite s'applique aussi ici.

**Cas pratique — un utilisateur signale une erreur à une heure précise** : filtre sur
`{container="naturalodge-server-container"} | json | level="error"`, ajuste la plage de temps sur le
moment signalé, lis le message + la stack trace directement dans Grafana sans avoir besoin de SSH.

## Uptime Kuma — disponibilité

Liste des moniteurs sur la page d'accueil : vert = up, rouge = down, avec l'historique de réponse
(uptime % sur 24h/30j/1an) et le temps de réponse dans le temps.

- Clique sur un moniteur pour voir l'historique détaillé et les incidents passés.
- **Notifications** (Settings → Notifications) : configure un canal (Telegram/Discord/email) une
  fois, puis associe-le à chaque moniteur (édition du moniteur → Notifications) pour être alerté
  automatiquement au lieu d'avoir à regarder la page.
- Rappel : ce moniteur tourne sur la même VPS que le site — s'il tombe complètement (VPS down), Uptime
  Kuma ne peut pas t'avertir. D'où l'intérêt d'un check externe indépendant (UptimeRobot, gratuit) en
  complément, jamais en remplacement.

## Runbook — réflexes selon le symptôme

**"Le site est lent" (signalé par un utilisateur, pas de panne)**
1. Dashboard app Grafana → quelle route a une latence anormale ? Depuis quand (élargir la plage) ?
2. Si la latence vient d'une route DB-heavy → Explore/Loki, filtrer `slow_prisma_query` sur la même
   période → la requête exacte en cause.
3. Si aucune route ne ressort mais que tout est globalement plus lent → dashboard 1860/14282 → CPU
   VPS ou d'un conteneur particulier saturé (le monitoring lui-même, un déploiement en cours, etc.).

**"Erreur 500 / plantage signalé"**
1. Explore/Loki → `level="error"` sur la période concernée → message + stack trace.
2. Dashboard app → pic du taux d'erreur 5xx au même moment ? Isolé ou répété ?

**"Le site est down"**
1. Uptime Kuma confirme et donne l'heure exacte de la coupure.
2. `docker ps -a` sur la VPS → conteneur `Exited` ? `docker logs <conteneur> --tail 100` → raison du
   crash.
3. Si tous les conteneurs de l'app sont `Up` mais le site ne répond pas → problème réseau/Traefik
   (voir les diagnostics Coolify habituels : `coolify-proxy`, routage du domaine).

**"Je veux juste un état des lieux hebdo"**
Dashboard app (tendance latence/erreurs sur 7j) + 1860 (tendance CPU/disque VPS sur 7j, pour
anticiper un besoin d'upgrade) + vérifier l'uptime % du mois dans Uptime Kuma.

## Ce que ce stack ne remplace pas

- `AuditLog` (en base) reste la source de vérité métier (qui a fait quoi) — rétention illimitée,
  contrairement aux 15 jours de logs/métriques ici (données de diagnostic court terme uniquement).
- Aucune alerte automatique n'est configurée par défaut au-delà des moniteurs Uptime Kuma que tu
  crées toi-même — les règles Grafana Alerting suggérées dans `README.md` (CPU/RAM > 85%, 5xx > X%)
  sont à mettre en place explicitement si tu veux être alerté sans avoir à ouvrir Grafana.
