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
- `src/i18n/ui.ts` : tous les textes du site en français et en anglais (accueil, réservation, connexion, espace client, messages des scripts). Les noms, descriptions et textes alternatifs des chambres sont dans `src/data/hotel.ts`.
- `src/components/` : structure des pages (`Home.astro`, `ReservationPage.astro`, `LoginPage.astro`, `AccountPage.astro`). `src/pages/` et `src/pages/en/` ne font que les instancier avec la langue.

### Langues

Français à la racine (`/`, `/reservation/`…), anglais sous `/en/` avec les mêmes adresses. Un lien FR/EN dans l’en-tête bascule vers la page équivalente. La langue est enregistrée avec chaque demande : les emails de suivi et le lien de connexion sont envoyés dans cette langue et pointent vers les pages correspondantes. L’API répond en français ; les pages anglaises traduisent les messages destinés aux clients via `src/i18n/server.ts` (tout nouveau message serveur visible par le client doit y être ajouté). Les balises `hreflang` sont générées une fois `site` défini dans `astro.config.mjs`.
- `src/styles/global.css` : palette, typographies, responsive.
- `public/logo.png` : copie conservée du logo original fourni dans `client/public/logo.png`.
- `public/logo-symbol.png` : symbole sans texte sur fond transparent, généré à partir du logo original et utilisé dans l’en-tête et le pied de page.
- `public/icon-rounded.png`, `public/favicon-rounded-32.png` et `public/apple-touch-icon-rounded.png` : icône aux coins arrondis et déclinaisons navigateur/mobile. Les versions carrées originales sont conservées.
- `public/images/` : photos réelles fournies par le propriétaire : maison, façade, intérieurs et bord de l’eau. Les textes alternatifs se modifient dans `index.astro` et `hotel.ts`.

Les tarifs affichés sont par chambre et par nuit, à confirmer avant publication. L’origine et l’utilisation des photos sont documentées dans `public/images/SOURCES.md`. Les vues intérieures présentent les chambres de l’hôtel ; leur correspondance exacte avec chaque catégorie reste à confirmer.

## Déployer sur le VPS

Avec la stack complète : `docker compose up -d --build` lance aussi le service `website` (port `WEBSITE_PORT`, 4321 par défaut). `PUBLIC_API_URL` est obligatoire au build de l’image (le build échoue sinon) : c’est l’URL publique de l’API vue par le navigateur. Son origine est aussi injectée dans la Content-Security-Policy (`security-headers.conf`, `connect-src`).

Option statique : copier le contenu de `dist/` dans le répertoire servi par Nginx. Adapter `server_name` au domaine retenu et activer HTTPS avec le reverse proxy du VPS.

Option Docker, depuis `website/` :

```sh
docker build -t naturalodge-website .
docker run -d --name naturalodge-website --restart unless-stopped -p 127.0.0.1:8081:80 naturalodge-website
```

Configurer ensuite le reverse proxy du VPS vers `http://127.0.0.1:8081`. Le conteneur reste indépendant de l’application de gestion. Le site n’a pas été déployé automatiquement.

## Avant publication

Confirmer l’affectation des photos aux catégories de chambres, les tarifs, capacités, unité de facturation et le point Google Maps. Compléter l’identité de l’exploitant dans `src/data/hotel.ts` (`legal` : raison sociale, NIF, STAT, adresse, responsable de la publication, email pour les données personnelles, hébergeur, service d’emails) : les pages `/mentions-legales/`, `/confidentialite/` et `/conditions/` (et leurs versions `/en/`) affichent « [à compléter] » et le build l’avertit tant qu’un champ est vide. La règle d’annulation (acompte remboursé si annulation au moins 3 jours avant l’arrivée) figure dans les conditions, le formulaire de réservation et les instructions de paiement ; la changer aux trois endroits (`policy` dans `hotel.ts`, `src/i18n/ui.ts`, `client/src/lib/paymentInstructions.ts`). Les preuves de paiement sont supprimées automatiquement 1 an après la date de départ prévue. Faire relire les pages légales par un juriste avant publication. Définir le domaine dans `astro.config.mjs` (`site`) puis ajouter canonical, URL absolue Open Graph et sitemap avec le domaine réel. Il n’y a pas de faux domaine configuré.

## Réservations reliées à la gestion

Depuis « Mes réservations », le client peut annuler lui-même une demande en attente de validation ou en attente d’acompte, tant qu’aucun paiement n’a été enregistré : le séjour en attente est annulé, les chambres sont libérées et l’email d’annulation part. Un séjour confirmé ou déjà payé s’annule auprès de l’hôtel. Quand le gérant accepte une demande venant d’un compte du site (email vérifié), la fiche client portant cet email est réutilisée au lieu d’en créer une nouvelle.

Le formulaire utilise les catégories, tarifs et disponibilités de l’API Express. La recherche de disponibilités et le choix des chambres sont accessibles sans compte ; la connexion client n’est demandée qu’à l’envoi de la demande (la sélection est conservée 24 h dans le navigateur pendant l’aller-retour par email). Les demandes sont enregistrées dans PostgreSQL et liées au compte client. Les anciennes simulations ne sont pas importées.

Définir PUBLIC_API_URL avant le build du site (par défaut http://localhost:4000/api/public). Avec Docker, passer --build-arg PUBLIC_API_URL=https://votre-api/api/public. Côté serveur, définir WEBSITE_URL avec l’origine du site pour CORS, et FRONTEND_URL avec celle de l’admin. Aucun secret dans PUBLIC_API_URL.

Depuis server/, appliquer la migration avec npm.cmd exec prisma migrate deploy avant de démarrer cette version.

Dans l’admin, « Demandes du site » permet de filtrer, accepter avec instructions et délai de paiement (1 à 72 heures), ou refuser avec motif. Pour accepter, la gérante choisit elle-même les chambres à attribuer (parmi celles du type demandé, libres sur les dates ; les chambres occupées ou en maintenance sont grisées) ; elles sont bloquées et un séjour en attente est créé. Chaque demande à traiter indique combien de chambres restent libres, pour repérer un conflit entre deux demandes avant d’accepter. Les instructions de paiement sont générées depuis la **fiche de paiement** (bouton « Fiche de paiement ») : moyens de paiement de l’hôtel (nom, numéro ou compte, titulaire, proposé par défaut ou non), WhatsApp facultatif et une note en français et en anglais. À l’acceptation, la gérante coche les moyens à proposer et peut ajouter une note pour ce client ; le texte (montant de l’acompte, moyens, référence, dépôt de la preuve) est rédigé dans la langue du client. La fiche est vide à l’installation : la renseigner avant la mise en ligne.

Le client dépose sa **preuve de paiement** (JPG, PNG, WebP ou PDF, 5 Mo max., 5 par demande) depuis « Mes réservations » tant que l’acompte est attendu ; il peut la supprimer jusqu’à la confirmation. Le type réel du fichier est vérifié (signature), SVG/HTML refusés. Les preuves sont stockées en base (`WebsitePaymentProof`) et s’ouvrent depuis la demande dans l’admin ; l’onglet « En attente d’acompte » et le badge de la navigation comptent les paiements avec une preuve à vérifier. Le personnel est notifié dans la cloche de l’admin (sur tous les postes ouverts, toutes les 30 secondes) des événements du site : nouvelle demande, preuve de paiement reçue, annulation par le client, délai expiré, acompte reçu. Un clic ouvre « Demandes du site ». **Notifications push** (même admin fermé) : chaque membre du personnel les active sur son appareil depuis la cloche (« Recevoir les notifications sur cet appareil ») ; elles sont envoyées par le serveur (Web Push, `web-push`) et affichées par le service worker de la PWA (`client/public/push-sw.js`). Conditions : clés `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` dans l’environnement du serveur (générées une fois avec `npx web-push generate-vapid-keys`, à ne plus changer ensuite), admin servi en HTTPS (ou localhost) depuis le build de production (le service worker n’existe pas en `npm run dev`), et sur iPhone/iPad l’admin installé sur l’écran d’accueil (iOS 16.4+). Seuls les comptes actifs ayant le droit de voir les réservations sont notifiés ; la déconnexion désabonne l’appareil. Les événements (`WebsiteEvent`) sont conservés 30 jours. Le reverse proxy placé devant l’API doit accepter des corps d’au moins 6 Mo (`client_max_body_size 6m;` avec Nginx), sinon l’envoi échoue avant d’atteindre le serveur. Depuis le lien de facturation, créer et viser la facture d’acompte puis enregistrer le paiement. Dès que le paiement cumulé atteint l’acompte complet, la demande et le séjour passent automatiquement en « confirmé » et le client reçoit l’email de confirmation ; le bouton « Confirmer » de la demande reste disponible pour un acompte enregistré avant cette version. Les cartes de la page d’accueil lisent tarif et capacité via `GET /api/public/room-types`, en associant chaque carte au type de chambre dont le nom est indiqué dans `roomType` (`src/data/hotel.ts`). Le délai est plafonné à la fin de la journée d’arrivée ; les demandes impayées expirent automatiquement.

Le client se connecte sur /connexion avec son adresse email. Un lien à usage unique, valable 15 minutes, permet de créer le compte ou de se connecter après confirmation explicite. La session est conservée 7 jours dans un cookie HttpOnly ; la déconnexion la révoque côté serveur. Aucun compte de gestion n’est créé. Les anciennes demandes du site correspondant à l’email vérifié sont rattachées au compte lors de la connexion. Le client retrouve toutes ses demandes sur /mes-reservations, actualisé toutes les 30 secondes, sans saisir de référence. Les anciennes routes publiques de suivi par clé et de renvoi par référence sont supprimées. La référence reste un identifiant interne pour l’équipe et les emails.

Appliquer aussi la migration `20261107060000_website_customers` avec `npm.cmd exec prisma migrate deploy` depuis `server/`. En production, utiliser HTTPS pour le site et l’API. Les cookies utilisent Secure et SameSite=None en production ; privilégier le même domaine principal pour le site et l’API, car les navigateurs peuvent bloquer les cookies tiers entre domaines distincts. L’origine des requêtes de connexion, déconnexion et réservation doit correspondre à `WEBSITE_URL`. Il n’y a pas de paiement en ligne ni de facture PDF jointe à ces emails.

### Configurer les emails

Renseigner dans `server/.env` : `SMTP_HOST`, `SMTP_PORT` (587 par défaut), `SMTP_SECURE` (`true` pour TLS direct sur 465, `false` pour STARTTLS sur 587), `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` (expéditeur autorisé par votre fournisseur) et `WEBSITE_URL` (origine publique réelle du site, en HTTPS en production). Utiliser un `JWT_SECRET` privé et aléatoire. Aucun de ces secrets ne doit être ajouté aux variables publiques Astro.

Avec Docker Compose, définir ces variables dans le fichier `.env` à la racine ou dans l’environnement du déploiement ; `server/.env` n’est pas lu automatiquement par Compose. Redémarrer le serveur après modification. SMTP doit fonctionner pour permettre une nouvelle connexion client. Les emails de suivi (reçue, acceptée, confirmée, refusée, expirée, annulée) passent par une file d’envoi (table `WebsiteEmail`) remplie dans la même transaction que le changement de statut : un SMTP lent ne ralentit plus les réponses, et un échec est réessayé automatiquement (8 tentatives sur environ 2 jours). Un email encore non délivré est signalé sur la demande dans l’admin. Seul le lien de connexion est envoyé immédiatement. Les demandes de connexion sont limitées à un email par minute par adresse et à 60 requêtes publiques par minute par IP, par instance serveur. Derrière un reverse proxy, l’IP réelle est lue depuis X-Forwarded-For : `TRUST_PROXY` (défaut `loopback, uniquelocal`) doit couvrir les proxys placés devant l’API, sinon tous les visiteurs partagent la même limite.

Vérifier avec une boîte de test SMTP : connexion sur un nouveau navigateur, lien invalide/expiré/déjà utilisé, déconnexion, réservation refusée sans session et email de réservation imposé par le compte. Connecter deux clients et vérifier l’isolation de leurs demandes ainsi que le rattachement des anciennes demandes à l’email vérifié. Vérifier réception de la demande, acceptation et instructions, refus, puis confirmation après acompte validé. Ne pas utiliser une boîte client réelle pour ces essais.

Un contrôle d’intégration est disponible : depuis `server/`, après le build, exécuter `node scripts/check-website-customer.cjs`. Il exige PostgreSQL local avec les migrations appliquées, simule les emails, crée deux clients de test et nettoie leurs données à la fin. Il vérifie les liens, sessions, droits d’accès, l’email imposé par le compte et la déconnexion.

Vérification manuelle : envoyer une demande depuis le site, la retrouver dans l’admin, accepter et vérifier les instructions côté site. Confirmer sans acompte doit échouer. Enregistrer l’acompte puis confirmer et vérifier le suivi. Vérifier refus, expiration, permissions, indisponibilité concurrente et rendu mobile/bureau.
