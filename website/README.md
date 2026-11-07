# Natura Lodge — site vitrine

Site Astro statique, avec réservation et suivi reliés à l’API de gestion. Français par défaut, Tailwind CSS, navigation mobile et liens de contact WhatsApp, téléphone, Facebook et Google Maps.

## Développement

```sh
npm ci
npm run dev
```

Sous PowerShell si l’exécution de `npm.ps1` est désactivée, utiliser `npm.cmd`.
Adresse locale : http://localhost:4321.

```sh
npm run build
npm run preview
```

Le build produit `dist/`, à servir avec Nginx. Les pages sont statiques ; les réservations nécessitent l’API Express et PostgreSQL.

## Modifier les contenus

- `src/data/hotel.ts` : coordonnées, liens, catégories, capacités et tarifs provisoires (Standard : 5 personnes, 130 000 Ar/nuit ; Standard supérieur : 6 personnes, 150 000 Ar/nuit).
- `src/pages/index.astro` : textes et sections.
- `src/styles/global.css` : palette, typographies, responsive.
- `public/logo.png` : copie conservée du logo original fourni dans `client/public/logo.png`.
- `public/logo-symbol.png` : symbole sans texte sur fond transparent, généré à partir du logo original et utilisé dans l’en-tête et le pied de page.
- `public/icon-rounded.png`, `public/favicon-rounded-32.png` et `public/apple-touch-icon-rounded.png` : icône aux coins arrondis et déclinaisons navigateur/mobile. Les versions carrées originales sont conservées.
- `public/images/` : photos réelles fournies par le propriétaire : maison, façade, intérieurs et bord de l’eau. Les textes alternatifs se modifient dans `index.astro` et `hotel.ts`.

Les tarifs affichés sont par chambre et par nuit, à confirmer avant publication. L’origine et l’utilisation des photos sont documentées dans `public/images/SOURCES.md`. Les vues intérieures présentent les chambres de l’hôtel ; leur correspondance exacte avec chaque catégorie reste à confirmer.

## Déployer sur le VPS

Option statique : copier le contenu de `dist/` dans le répertoire servi par Nginx. Adapter `server_name` au domaine retenu et activer HTTPS avec le reverse proxy du VPS.

Option Docker, depuis `website/` :

```sh
docker build -t naturalodge-website .
docker run -d --name naturalodge-website --restart unless-stopped -p 127.0.0.1:8081:80 naturalodge-website
```

Configurer ensuite le reverse proxy du VPS vers `http://127.0.0.1:8081`. Le conteneur reste indépendant de l’application de gestion. Le site n’a pas été déployé automatiquement.

## Avant publication

Confirmer l’affectation des photos aux catégories de chambres, les tarifs, capacités, unité de facturation et le point Google Maps. Ajouter les mentions légales de l’exploitant une fois les informations disponibles. Définir le domaine dans `astro.config.mjs` (`site`) puis ajouter canonical, URL absolue Open Graph et sitemap avec le domaine réel. Il n’y a pas de faux domaine configuré.

## Réservations reliées à la gestion

Le formulaire utilise les catégories, tarifs et disponibilités de l’API Express. La recherche de disponibilités et le choix des chambres sont accessibles sans compte ; la connexion client n’est demandée qu’à l’envoi de la demande (la sélection est conservée 24 h dans le navigateur pendant l’aller-retour par email). Les demandes sont enregistrées dans PostgreSQL et liées au compte client. Les anciennes simulations ne sont pas importées.

Définir PUBLIC_API_URL avant le build du site (par défaut http://localhost:4000/api/public). Avec Docker, passer --build-arg PUBLIC_API_URL=https://votre-api/api/public. Côté serveur, définir WEBSITE_URL avec l’origine du site pour CORS, et FRONTEND_URL avec celle de l’admin. Aucun secret dans PUBLIC_API_URL.

Depuis server/, appliquer la migration avec npm.cmd exec prisma migrate deploy avant de démarrer cette version.

Dans l’admin, « Demandes du site » permet de filtrer, accepter avec instructions et délai de paiement (1 à 72 heures), ou refuser avec motif. Accepter affecte les chambres disponibles et crée un séjour en attente. Depuis le lien de facturation, créer et viser la facture d’acompte puis enregistrer le paiement. Dès que le paiement cumulé atteint l’acompte complet, la demande et le séjour passent automatiquement en « confirmé » et le client reçoit l’email de confirmation ; le bouton « Confirmer » de la demande reste disponible pour un acompte enregistré avant cette version. Les cartes de la page d’accueil lisent tarif et capacité via `GET /api/public/room-types`, en associant chaque carte au type de chambre dont le nom est indiqué dans `roomType` (`src/data/hotel.ts`). Le délai est plafonné à la fin de la journée d’arrivée ; les demandes impayées expirent automatiquement.

Le client se connecte sur /connexion avec son adresse email. Un lien à usage unique, valable 15 minutes, permet de créer le compte ou de se connecter après confirmation explicite. La session est conservée 7 jours dans un cookie HttpOnly ; la déconnexion la révoque côté serveur. Aucun compte de gestion n’est créé. Les anciennes demandes du site correspondant à l’email vérifié sont rattachées au compte lors de la connexion. Le client retrouve toutes ses demandes sur /mes-reservations, actualisé toutes les 30 secondes, sans saisir de référence. Les anciennes routes publiques de suivi par clé et de renvoi par référence sont supprimées. La référence reste un identifiant interne pour l’équipe et les emails.

Appliquer aussi la migration `20261107060000_website_customers` avec `npm.cmd exec prisma migrate deploy` depuis `server/`. En production, utiliser HTTPS pour le site et l’API. Les cookies utilisent Secure et SameSite=None en production ; privilégier le même domaine principal pour le site et l’API, car les navigateurs peuvent bloquer les cookies tiers entre domaines distincts. L’origine des requêtes de connexion, déconnexion et réservation doit correspondre à `WEBSITE_URL`. Il n’y a pas de paiement en ligne ni de facture PDF jointe à ces emails.

### Configurer les emails

Renseigner dans `server/.env` : `SMTP_HOST`, `SMTP_PORT` (587 par défaut), `SMTP_SECURE` (`true` pour TLS direct sur 465, `false` pour STARTTLS sur 587), `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` (expéditeur autorisé par votre fournisseur) et `WEBSITE_URL` (origine publique réelle du site, en HTTPS en production). Utiliser un `JWT_SECRET` privé et aléatoire. Aucun de ces secrets ne doit être ajouté aux variables publiques Astro.

Avec Docker Compose, définir ces variables dans le fichier `.env` à la racine ou dans l’environnement du déploiement ; `server/.env` n’est pas lu automatiquement par Compose. Redémarrer le serveur après modification. SMTP doit fonctionner pour permettre une nouvelle connexion client. Un échec d’email de notification ne supprime pas une demande enregistrée ; son suivi reste disponible dans le compte. Aucun renvoi automatique des échecs n’est effectué. Les demandes de connexion sont limitées à un email par minute par adresse et à 60 requêtes publiques par minute par IP, par instance serveur. Derrière un reverse proxy, l’IP réelle est lue depuis X-Forwarded-For : `TRUST_PROXY` (défaut `loopback, uniquelocal`) doit couvrir les proxys placés devant l’API, sinon tous les visiteurs partagent la même limite.

Vérifier avec une boîte de test SMTP : connexion sur un nouveau navigateur, lien invalide/expiré/déjà utilisé, déconnexion, réservation refusée sans session et email de réservation imposé par le compte. Connecter deux clients et vérifier l’isolation de leurs demandes ainsi que le rattachement des anciennes demandes à l’email vérifié. Vérifier réception de la demande, acceptation et instructions, refus, puis confirmation après acompte validé. Ne pas utiliser une boîte client réelle pour ces essais.

Un contrôle d’intégration est disponible : depuis `server/`, après le build, exécuter `node scripts/check-website-customer.cjs`. Il exige PostgreSQL local avec les migrations appliquées, simule les emails, crée deux clients de test et nettoie leurs données à la fin. Il vérifie les liens, sessions, droits d’accès, l’email imposé par le compte et la déconnexion.

Vérification manuelle : envoyer une demande depuis le site, la retrouver dans l’admin, accepter et vérifier les instructions côté site. Confirmer sans acompte doit échouer. Enregistrer l’acompte puis confirmer et vérifier le suivi. Vérifier refus, expiration, permissions, indisponibilité concurrente et rendu mobile/bureau.
