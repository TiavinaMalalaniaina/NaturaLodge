# Natura Lodge — site vitrine

Site Astro statique indépendant du client de gestion et de son API. Français par défaut, Tailwind CSS, navigation mobile et liens de contact WhatsApp, téléphone, Facebook et Google Maps.

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

Le build produit `dist/`, à servir avec Nginx. Aucune base de données ni serveur Node n’est nécessaire en production.

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

## Réservations — prochaine étape

Le site dirige pour le moment vers WhatsApp avec un message prérempli, sans formulaire ni appel API. L’acompte d’une nuit est annoncé, aucun paiement n’est encaissé sur le site. La future connexion API devra passer par une route publique dédiée et validée côté serveur, avec limitation des envois. Ne pas exposer les routes de gestion ni des identifiants dans la vitrine.
