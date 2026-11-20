# Sauvegardes de la base de production

**État au 20 novembre 2026 : aucune sauvegarde automatique n'est documentée ni vérifiée.** La base
contient les réservations, les factures, la comptabilité et les preuves de paiement : la perdre,
c'est perdre l'historique comptable de l'hôtel. C'est le premier chantier à mettre en place.

Tout est dans PostgreSQL, y compris les preuves de paiement (colonne `WebsitePaymentProof.data`) :
aucun fichier sur disque à sauvegarder à part. Un dump de la base suffit.

---

## Objectif

| | Cible |
|---|---|
| Fréquence | Une sauvegarde par jour, la nuit, plus une manuelle avant toute migration sensible |
| Lieu | **Hors du VPS** (stockage objet type S3, Backblaze B2…). Une copie sur le même VPS ne protège ni d'une panne disque, ni d'une suppression du serveur. |
| Conservation | 7 quotidiennes, 4 hebdomadaires, 12 mensuelles |
| Perte maximale acceptée | Une journée de saisie |
| Preuve que ça marche | Une restauration testée **au moins une fois par trimestre** |

---

## Option A — Sauvegardes intégrées de Coolify (recommandée si la base est gérée par Coolify)

Si la base de production est une ressource « Database » de Coolify :

1. Coolify → **S3 Storages** : ajouter un stockage (Backblaze B2, AWS S3, Cloudflare R2…) et le
   valider.
2. Ouvrir la ressource PostgreSQL de production → **Backups** → activer les sauvegardes planifiées :
   fréquence `0 3 * * *` (3 h du matin), envoi vers le stockage S3, conservation selon le tableau.
3. Lancer une sauvegarde manuelle tout de suite et vérifier qu'elle apparaît dans le stockage S3.
4. Faire un test de restauration (plus bas).

## Option B — Script `pg_dump` planifié sur le VPS

Si la base tourne dans un conteneur non géré par les sauvegardes Coolify. À adapter : nom du
conteneur, utilisateur et nom de la base (voir les variables de la ressource dans Coolify).

```bash
#!/bin/sh
# /opt/naturalodge/backup.sh — sauvegarde quotidienne de la base de production
set -eu
CONTAINER=<nom-du-conteneur-postgres>
DB_USER=<utilisateur>
DB_NAME=<base>
DIR=/opt/naturalodge/backups
STAMP=$(date +%Y-%m-%d_%H%M)

mkdir -p "$DIR"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom --no-owner \
  > "$DIR/naturalodge_$STAMP.dump"

# Copie hors du VPS (rclone configuré une fois avec `rclone config`)
rclone copy "$DIR/naturalodge_$STAMP.dump" remote:naturalodge-backups/

# Ne garder que 7 jours en local ; la rétention longue est gérée côté stockage distant
find "$DIR" -name 'naturalodge_*.dump' -mtime +7 -delete
```

Planification (`crontab -e` sur le VPS) :
```
0 3 * * * /opt/naturalodge/backup.sh >> /var/log/naturalodge-backup.log 2>&1
```

Le format `custom` est compressé et permet de restaurer une table seule si besoin.

---

## Sauvegarde manuelle avant une migration sensible

Même commande que ci-dessus, lancée à la main juste avant le déploiement, en nommant le fichier
d'après la version : `naturalodge_avant-2.6.0.dump`. La garder jusqu'à ce que la version soit
validée en production.

---

## Tester une restauration (chaque trimestre)

On ne restaure **jamais** un test sur la base de production. On restaure dans une base jetable,
en local ou sur la préprod :

```bash
# 1. Une base vide (exemple en local avec le Postgres de make db-up)
createdb -h localhost -U naturalodge naturalodge_restore

# 2. Restauration
pg_restore -h localhost -U naturalodge -d naturalodge_restore --no-owner naturalodge_2026-11-20_0300.dump

# 3. Vérifications rapides
psql -h localhost -U naturalodge -d naturalodge_restore -c 'SELECT count(*) FROM "Booking";'
psql -h localhost -U naturalodge -d naturalodge_restore -c 'SELECT max("createdAt") FROM "Invoice";'
```

Pour aller plus loin, pointer un serveur local sur cette base (`DATABASE_URL`) et ouvrir le
back-office : les dernières réservations et factures doivent être là. Noter la date du test et la
durée de restauration ci-dessous.

| Date du test | Sauvegarde utilisée | Durée | Résultat | Par |
|---|---|---|---|---|
| [à compléter] | | | | |

---

## Restaurer la production après un incident

1. Prévenir l'hôtel : l'application va être indisponible, et les saisies faites depuis la
   sauvegarde seront perdues (les noter sur papier si possible).
2. Arrêter le conteneur serveur dans Coolify, pour que plus rien n'écrive en base.
3. Faire un dump de l'état actuel, même abîmé : on peut en avoir besoin pour récupérer des données.
4. Restaurer la sauvegarde choisie dans la base de production (`pg_restore --clean --if-exists`).
5. Redémarrer le serveur. Les migrations plus récentes que la sauvegarde se réappliquent toutes
   seules (`prisma migrate deploy`).
6. Vérifier `/health`, se connecter, contrôler les dernières réservations et factures.
7. Noter l'incident dans le `CHANGELOG.md` ou un compte rendu : cause, données perdues, durée.
