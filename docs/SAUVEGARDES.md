# Sauvegardes de la base de production

La base contient les réservations, les factures, la comptabilité et les preuves de paiement
(colonne `WebsitePaymentProof.data`) : aucun fichier sur disque à sauvegarder à part, un dump de
PostgreSQL suffit.

---

## En place

La base de production est sauvegardée par un dump PostgreSQL envoyé avec **rclone** vers un
**Google Drive**. Le script et sa planification vivent sur le VPS, pas dans ce dépôt.

| | Valeur |
|---|---|
| Script | [à compléter : chemin sur le VPS] |
| Planification | [à compléter : ligne cron ou timer systemd, heure] |
| Commande de dump | [à compléter : `pg_dump` dans le conteneur ? format `custom` ou SQL ?] |
| Remote rclone | [à compléter : nom du remote et dossier, ex. `gdrive:naturalodge-backups/`] |
| Compte Google Drive | [à compléter : à qui appartient le compte] |
| Conservation | [à compléter : combien de sauvegardes gardées, et qui supprime les anciennes] |
| Journal | [à compléter : fichier de log du script] |
| Dernière restauration testée | [à compléter] |

Pour la reprise par un autre développeur, copier le script dans ce dépôt (par exemple
`scripts/backup.sh`, **sans aucun secret** : la configuration rclone reste dans
`~/.config/rclone/rclone.conf` sur le VPS).

---

## Points de vigilance

- **Le compte Google Drive** : s'il s'agit d'un compte personnel, les sauvegardes partent avec son
  propriétaire. Pour une passation, utiliser un compte ou un dossier partagé appartenant à
  l'hôtel, et y donner accès au nouveau développeur.
- **Le jeton rclone expire ou est révoqué** (changement de mot de passe Google, révocation de
  l'accès, application OAuth en mode test) : le script continue de tourner mais n'envoie plus
  rien. Vérifier régulièrement que le dernier fichier sur le Drive est bien d'hier, ou faire
  envoyer une alerte par le script en cas d'échec (Uptime Kuma accepte des pings « push »).
- **L'espace du Drive** : 15 Go gratuits partagés avec Gmail. Sans suppression des anciennes
  sauvegardes, il finit par se remplir et les envois échouent.
- **Les données sont sensibles** (clients, preuves de paiement) : le dossier ne doit être partagé
  qu'avec les personnes qui en ont besoin. rclone peut chiffrer les fichiers avant envoi
  (remote `crypt`).

---

## Sauvegarde manuelle avant une migration sensible

Lancer le script à la main juste avant le déploiement, ou faire un dump nommé d'après la version
(`naturalodge_avant-2.6.0.dump`) et le garder jusqu'à ce que la version soit validée en production.

---

## Tester une restauration (chaque trimestre)

On ne restaure **jamais** un test sur la base de production, mais dans une base jetable, en local
ou sur la préprod :

```bash
# 1. Récupérer la dernière sauvegarde
rclone copy <remote>:<dossier>/<fichier> ./

# 2. Une base vide (exemple en local avec le Postgres de make db-up)
createdb -h localhost -U naturalodge naturalodge_restore

# 3. Restauration : pg_restore pour un dump au format custom, psql pour un dump SQL
pg_restore -h localhost -U naturalodge -d naturalodge_restore --no-owner <fichier>.dump
#   ou : psql -h localhost -U naturalodge -d naturalodge_restore -f <fichier>.sql

# 4. Vérifications rapides
psql -h localhost -U naturalodge -d naturalodge_restore -c 'SELECT count(*) FROM "Booking";'
psql -h localhost -U naturalodge -d naturalodge_restore -c 'SELECT max("createdAt") FROM "Invoice";'
```

Pour aller plus loin, pointer un serveur local sur cette base (`DATABASE_URL`) et ouvrir le
back-office : les dernières réservations et factures doivent être là. Noter le test ci-dessous.

| Date du test | Sauvegarde utilisée | Durée | Résultat | Par |
|---|---|---|---|---|
| [à compléter] | | | | |

---

## Restaurer la production après un incident

1. Prévenir l'hôtel : l'application va être indisponible, et les saisies faites depuis la
   sauvegarde seront perdues (les noter sur papier si possible).
2. Arrêter le conteneur serveur dans Coolify, pour que plus rien n'écrive en base.
3. Faire un dump de l'état actuel, même abîmé : on peut en avoir besoin pour récupérer des données.
4. Restaurer la sauvegarde choisie dans la base de production (`pg_restore --clean --if-exists`,
   ou `psql` pour un dump SQL).
5. Redémarrer le serveur. Les migrations plus récentes que la sauvegarde se réappliquent toutes
   seules (`prisma migrate deploy`).
6. Vérifier `/health`, se connecter, contrôler les dernières réservations et factures.
7. Noter l'incident dans le `CHANGELOG.md` ou un compte rendu : cause, données perdues, durée.
