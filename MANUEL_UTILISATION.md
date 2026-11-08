# NaturaLodge — Manuel d’utilisation par rôle

Édition du 2 novembre 2026 · Application de gestion hôtelière

Ce guide s’adresse à la réception, aux responsables de l’établissement et aux personnes chargées de la comptabilité et des accès. Il décrit l’application de gestion ; le site public de présentation de l’hôtel est indépendant.

Les menus et les actions disponibles dépendent des permissions attribuées à votre rôle. Les intitulés ci-dessous correspondent à l’interface française ; certaines fenêtres conservent des textes en anglais.

## Sommaire

- [Choisir son parcours et comprendre les droits](#choisir-son-parcours-et-comprendre-les-droits)
- [GERANT — Accueil et gestion des séjours](#gerant--accueil-et-gestion-des-séjours)
- [MANAGER — Supervision et gestion financière](#manager--supervision-et-gestion-financière)
- [ADMIN — Administration et contrôle](#admin--administration-et-contrôle)
- [HOUSEKEEPING — Consultation pour le service des chambres](#housekeeping--consultation-pour-le-service-des-chambres)
- [Procédures détaillées communes](#procédures-détaillées-communes)

## Choisir son parcours et comprendre les droits

Ce manuel est organisé selon les quatre rôles initialisés dans l’application : **GERANT**, **MANAGER**, **ADMIN** et **HOUSEKEEPING**. Commencez par votre chapitre ; les liens vous conduisent ensuite aux procédures détaillées.

Les droits ci-dessous proviennent de la configuration initiale du dépôt, pas d’une lecture de la base de votre établissement. Un administrateur peut les modifier ou créer d’autres rôles. Pour un rôle personnalisé, faites confirmer les tâches autorisées par l’administrateur.

Dans cette configuration, **GERANT** assure les opérations d’accueil ; **MANAGER** dispose de responsabilités financières supplémentaires. Ces noms désignent les rôles de l’application et ne constituent pas une hiérarchie professionnelle.

### Repères des permissions par défaut

| Action | GERANT | MANAGER | ADMIN | HOUSEKEEPING |
| --- | --- | --- | --- | --- |
| Consulter chambres, clients et réservations | Oui | Oui | Oui | Oui |
| Consulter factures, historique des paiements et dépenses | Oui | Oui | Oui | Oui |
| Créer un client, ajouter des notes et gérer un séjour | Oui | Oui | Oui | Non |
| Modifier une chambre, notamment son statut de maintenance | Oui | Oui | Oui | Non |
| Créer une chambre, gérer types, caractéristiques et catalogue de suppléments | Non | Oui | Oui | Non |
| Générer facture/acompte et supprimer un brouillon | Oui | Oui | Oui | Non |
| Viser un document, modifier ses lignes ou annuler un paiement | Non | Oui | Oui | Non |
| Enregistrer un paiement sur un document visé | Oui | Oui | Oui | Non |
| Effectuer un départ avec impayé ou modifier après départ | Non | Oui | Oui | Non |
| Clôturer un séjour terminé et payé | Non | Oui | Oui | Non |
| Consulter les soldes de trésorerie | Selon comptes autorisés | Tous les comptes | Tous les comptes | Non |
| Enregistrer dépenses, virements et apports | Non | Oui | Oui | Non |
| Consulter rapports et KPI | Non | Oui | Oui | Non |
| Consulter le personnel | Non | Oui | Oui | Non |
| Créer un compte personnel ou attribuer un rôle | Non | Non | Oui | Non |
| Gérer plan comptable, catégories de dépenses et accès trésorerie | Non | Non | Oui | Non |
| Gérer les permissions et consulter le journal d’audit | Non | Non | Oui | Non |

« Oui » indique une permission initiale. L’état du dossier et la disponibilité de la fonction dans l’interface restent déterminants. Les limites des écrans sont décrites dans [Paramètres et limites](#11-paramètres-et-limites-de-la-version).

## GERANT — Accueil et gestion des séjours

**Votre mission dans l’application :** préparer les séjours, accueillir les clients, suivre les chambres et enregistrer les règlements des documents déjà visés.

### Commencer le service

1. [Connectez-vous](#1-première-connexion-et-navigation) avec votre compte personnel.
2. Consultez le [tableau de bord](#2-tableau-de-bord), puis les arrivées et départs dans **Réservations**.
3. Repérez les réservations en attente, les séjours en retard et les chambres en maintenance.
4. Préparez avec le manager les documents à viser et les dossiers présentant un impayé.

### Enregistrer une réservation

1. Dans **Clients**, recherchez le client avant de créer un profil. Voir [Clients](#3-clients).
2. Dans **Réservations → Nouvelle réservation**, choisissez le client, les dates et les chambres.
3. Vérifiez les dates de chaque chambre, les suppléments et le total, puis enregistrez.
4. Ouvrez le dossier créé : son statut initial est **En attente de confirmation**.
5. Après vérification, utilisez **Confirmer la réservation**.

Consultez la [procédure de réservation](#4-réservations-et-suivi-des-séjours) pour les changements de chambre, de dates et les annulations.

### Accueillir et suivre le client

1. Ouvrez le séjour affiché **Arrivée du jour**, vérifiez son contenu et confirmez le **Check-in**.
2. Pendant le séjour, mettez à jour les chambres et suppléments si nécessaire et ajoutez les notes utiles.
3. Si une chambre nécessite une intervention, utilisez son statut de maintenance lorsque la situation le justifie ; traitez les réservations actives concernées avec le responsable.

Vous pouvez modifier une chambre existante, mais la création des chambres, les types et les catalogues relèvent du manager ou de l’administrateur. Voir [Chambres](#5-chambres-types-et-suppléments).

### Préparer la facture et encaisser

1. Depuis la réservation, générez la facture ou créez un acompte si nécessaire.
2. Contrôlez le brouillon et demandez à un **MANAGER** ou **ADMIN** de le vérifier et de le **viser**.
3. Une fois le document visé, ouvrez **Enregistrer un paiement**.
4. Saisissez la somme réellement reçue, le moyen, le compte et la référence.
5. Confirmez et vérifiez le reste à payer.

Vous ne pouvez pas viser un document, modifier les lignes de facture ou annuler un paiement avec les droits initiaux. Faites traiter ces opérations par un manager ou un administrateur. Voir [Factures et paiements](#6-factures-acomptes-et-paiements).

### Enregistrer le départ et transmettre les exceptions

1. Vérifiez la facture et encaissez le solde réel.
2. Effectuez le **Check-out** lorsque le séjour est réglé et que le client est parti.
3. Si un solde subsiste, transmettez le dossier à un manager : le départ avec impayé nécessite un droit supplémentaire.
4. Faites également traiter la clôture définitive et toute modification après départ par le manager.
5. Pour une annulation, vérifiez le taux de remboursement avec le responsable et transmettez les avoirs à viser. Le remboursement effectif doit être contrôlé séparément.

**Fin de service :** rapprochez vos règlements avec les fonds reçus, transmettez les impayés et brouillons en attente, puis déconnectez-vous. Vous pouvez consulter les dépenses et les soldes des comptes autorisés, mais ne pouvez pas créer de dépense, de virement ou d’apport par défaut.

## MANAGER — Supervision et gestion financière

**Votre mission dans l’application :** superviser les séjours, valider la facturation, suivre les flux financiers et traiter les exceptions de l’accueil.

Vous pouvez effectuer les opérations du [parcours GERANT](#gerant--accueil-et-gestion-des-séjours), ainsi que les tâches suivantes.

### Contrôler les opérations du jour

1. Vérifiez les arrivées, départs, retards et impayés au tableau de bord et au planning.
2. Traitez les demandes de réassignation et les incidents de maintenance.
3. Contrôlez les réservations terminées qui nécessitent encore une facture, un règlement ou une correction.
4. Si un départ avec impayé est nécessaire, vérifiez le solde et consignez les informations utiles avant de confirmer. L’impayé reste à suivre après le départ.
5. Après régularisation, clôturez les réservations **Terminées et payées**. La clôture est définitive.

### Vérifier et viser les documents

1. Dans **Factures**, utilisez **Brouillons uniquement** pour identifier les documents à traiter.
2. Vérifiez le client, les dates, les nuitées, les suppléments, la TVA, les remises et les acomptes.
3. Corrigez les lignes nécessaires. Les charges et remises ne recalculent pas automatiquement la TVA.
4. Cliquez sur **Viser** lorsque le document est correct ; contrôlez son numéro définitif.
5. Autorisez ensuite son encaissement par l’accueil, ou enregistrez vous-même le règlement reçu.

Pour une annulation, contrôlez les avoirs générés, visez-les après vérification, puis enregistrez les remboursements réellement effectués. Pour corriger un paiement erroné, utilisez l’action d’annulation autorisée et contrôlez le nouveau solde. Voir [Factures, acomptes et paiements](#6-factures-acomptes-et-paiements).

### Gérer les chambres et les catalogues

Vous pouvez créer des chambres, gérer les types, les caractéristiques et les suppléments facturables. Vérifiez les tarifs et le mode de calcul des suppléments avant leur utilisation par l’accueil. Voir [Chambres, types et suppléments](#5-chambres-types-et-suppléments).

### Suivre les finances

1. Enregistrez les [dépenses](#7-dépenses) avec la catégorie, le compte et la date corrects.
2. Dans [Trésorerie](#8-trésorerie), contrôlez les soldes et les mouvements.
3. Enregistrez les virements internes avec leurs frais éventuels et les apports externes lorsqu’ils ont lieu.
4. Consultez les [rapports et KPI](#9-rapports-et-indicateurs), en vérifiant les périodes et les différences entre facturation et encaissement.
5. Exportez le grand livre si nécessaire pour les contrôles comptables.

Vous avez accès à tous les comptes de trésorerie par défaut. La création des comptes, la gestion des catégories de dépenses et les restrictions d’accès relèvent de l’administrateur.

**Fin de service :** contrôlez les soldes, les règlements, les remboursements, les brouillons et les impayés ; transmettez les anomalies à l’administrateur. Vous pouvez consulter le personnel, mais la création des comptes et l’attribution des rôles ne font pas partie de vos droits initiaux.

## ADMIN — Administration et contrôle

**Votre mission dans l’application :** configurer les accès et les référentiels, contrôler les opérations et maintenir une répartition adaptée des responsabilités.

Vous disposez des permissions initiales du [parcours MANAGER](#manager--supervision-et-gestion-financière), en plus des fonctions d’administration suivantes. Une permission ne rend pas opérationnel un bouton encore incomplet.

### Préparer les accès du personnel

1. Dans **Permissions**, vérifiez les rôles existants et leurs autorisations.
2. Si nécessaire, créez un rôle et accordez-lui les permissions utiles. Un nouveau rôle personnalisé démarre sans permission associée.
3. Dans **Personnel → Accorder un accès**, créez le compte avec son nom d’utilisateur, son mot de passe initial et le rôle voulu.
4. Vérifiez le rôle affecté avant de communiquer les informations de connexion à la personne concernée.
5. Pour changer un rôle, sélectionnez le nouveau rôle sur la ligne du membre et confirmez.

Les commandes **Modifier**, **Réinitialiser le mot de passe** et **Révoquer l’accès** du menu d’un membre restent inactives dans cette version ; faites intervenir le support pour ces besoins. Voir [Personnel et droits d’accès](#10-personnel-et-droits-daccès).

### Configurer la comptabilité et les comptes autorisés

1. Dans **Comptes**, créez les comptes nécessaires avec un code, un nom et un type adaptés.
2. Pour un compte de trésorerie, indiquez son usage et les moyens de paiement acceptés.
3. Vérifiez le code et le type avant création : ils ne sont plus modifiables ensuite. Un compte se désactive ; il ne se supprime pas.
4. Dans **Dépenses → Catégories**, associez chaque catégorie au compte de charge approprié.
5. Dans **Accès trésorerie**, configurez par rôle la visibilité et les usages des comptes.

Attention à la règle de configuration : **aucune case cochée ne signifie pas aucun accès**. Une colonne d’usage sans restriction autorise les comptes visibles. La permission **Voir tous les comptes de trésorerie**, accordée initialement à ADMIN et MANAGER, prévaut sur ces restrictions. Voir [Accès trésorerie](#10-personnel-et-droits-daccès).

### Contrôler les opérations sensibles

1. Consultez le **Journal d’audit** avec la période et la ressource recherchées.
2. Rapprochez les opérations concernées avec les factures, paiements et mouvements de trésorerie.
3. Vérifiez les départs avec impayé, annulations de paiement, avoirs, remboursements et modifications après départ.
4. Examinez les permissions accordées lorsqu’une action inattendue est signalée.
5. Faites analyser tout déséquilibre du bilan en conservant la date et les références utiles.

Les suppressions techniques prévues pour certains dossiers ne doivent pas être assimilées aux parcours usuels d’annulation, d’avoir ou de clôture. Utilisez les actions réellement proposées par l’interface et contrôlez leurs conséquences.

**Contrôle périodique :** revoyez les rôles, les accès de trésorerie, les comptes et catégories désactivés, les brouillons non traités et les impayés. Pour les champs de propriété et autres réglages incomplets, consultez les [limites de la version](#11-paramètres-et-limites-de-la-version).

## HOUSEKEEPING — Consultation pour le service des chambres

**Votre mission dans l’application :** consulter les informations utiles à la préparation des chambres et transmettre les besoins d’intervention à l’accueil ou au manager.

Ce rôle est configuré en **lecture seule**. Il ne permet pas de modifier les chambres, de marquer une chambre comme nettoyée, de saisir une note ou de changer le statut d’un séjour.

### Préparer la tournée

1. Connectez-vous avec votre compte personnel.
2. Consultez le tableau de bord pour repérer les arrivées et départs prévus.
3. Ouvrez **Réservations → Grille** et choisissez la période du service.
4. Repérez les chambres avec une arrivée, un départ ou un séjour en cours.
5. Ouvrez le détail d’un séjour ou d’une chambre pour consulter les informations utiles à la préparation.

### Signaler une difficulté

1. Relevez le numéro de chambre et décrivez le problème observé.
2. Transmettez ces informations à l’accueil ou au manager par le canal de travail habituel.
3. Faites traiter par une personne autorisée la mise en maintenance, la réassignation ou la mise à jour du séjour.

Un statut **Disponible** n’est pas un indicateur de nettoyage effectué. L’application examinée ne propose pas de parcours dédié au suivi du ménage ; confirmez l’état réel de la chambre avec l’équipe.

### Limites et fin de service

Les permissions initiales permettent également de consulter les clients, factures, historiques de paiement et dépenses. Elles ne donnent pas accès aux comptes de trésorerie, aux rapports, au personnel ou à l’administration. Si l’établissement souhaite limiter davantage la consultation, l’administrateur doit adapter les permissions du rôle.

À la fin du service, transmettez les incidents encore ouverts et déconnectez-vous. Pour un problème d’accès, consultez le [tableau de dépannage](#13-résolution-des-difficultés).

## Procédures détaillées communes

Les fiches suivantes complètent les parcours par rôle. N’exécutez une procédure que si elle correspond aux permissions de votre compte. La routine générale de la fiche 12 est à adapter à votre rôle.

1. [Première connexion et navigation](#1-première-connexion-et-navigation)
2. [Tableau de bord](#2-tableau-de-bord)
3. [Clients](#3-clients)
4. [Réservations et suivi des séjours](#4-réservations-et-suivi-des-séjours)
5. [Chambres, types et suppléments](#5-chambres-types-et-suppléments)
6. [Factures, acomptes et paiements](#6-factures-acomptes-et-paiements)
7. [Dépenses](#7-dépenses)
8. [Trésorerie](#8-trésorerie)
9. [Rapports et indicateurs](#9-rapports-et-indicateurs)
10. [Personnel et droits d’accès](#10-personnel-et-droits-daccès)
11. [Paramètres et limites de la version](#11-paramètres-et-limites-de-la-version)
12. [Routine quotidienne](#12-routine-quotidienne)
13. [Résolution des difficultés](#13-résolution-des-difficultés)
14. [Lexique](#14-lexique)

## 1. Première connexion et navigation

### Se connecter

1. Ouvrez l’adresse de gestion communiquée par votre administrateur.
2. Saisissez votre **nom d’utilisateur** et votre **mot de passe**.
3. Cliquez sur **Se connecter**.
4. Si l’application demande un changement de mot de passe, saisissez et confirmez le nouveau mot de passe, puis enregistrez-le. Reconnectez-vous après la redirection.

En cas d’oubli du mot de passe, contactez votre administrateur ou le support. Le menu de réinitialisation de l’écran Personnel n’est pas encore opérationnel dans cette version. Si un lien de réinitialisation est invalide ou expiré, contactez également le support.

### Se repérer

Le menu latéral regroupe les écrans en trois ensembles :

| Groupe | Écrans principaux |
| --- | --- |
| Général | Tableau de bord, Réservations, Chambres, Clients |
| Comptabilité | Factures, Dépenses, Trésorerie, Rapports, KPI hôteliers, Comptes, Accès trésorerie |
| Administration | Personnel, Paramètres, Journal d’audit, Permissions |

Cliquez sur le nom d’un groupe pour le déplier. Sur mobile, ouvrez le menu avec le bouton prévu dans la barre supérieure.

Le sélecteur de langue permet de choisir le français, l’anglais ou le malgache. La cloche ouvre le centre d’alertes : vous pouvez consulter les notifications, les marquer comme lues ou les effacer. Effacer ces notifications ne supprime pas les opérations enregistrées dans l’application.

Pour terminer votre session, utilisez **Déconnexion** dans le menu.

## 2. Tableau de bord

Le **Tableau de bord** donne une vue d’ensemble de l’activité : occupation, revenus, arrivées, départs et paiements en attente.

Au début du service :

1. Consultez les arrivées et les départs du jour.
2. Ouvrez les réservations à traiter ou utilisez **Planning complet**.
3. Consultez les paiements en attente pour préparer les encaissements.
4. Utilisez **Nouvelle réservation** pour saisir un séjour.

Le **Check-in rapide**, lorsqu’il est disponible, permet d’enregistrer une arrivée après confirmation. Vérifiez le client et le séjour avant de confirmer.

## 3. Clients

### Créer un profil

1. Ouvrez **Clients**, puis **Nouveau profil**.
2. Renseignez l’identité et les coordonnées demandées : nom, e-mail, téléphone, ville, pays et adresse selon les champs proposés.
3. Choisissez la classification et renseignez les préférences utiles. Dans le champ prévu, séparez les préférences par des virgules.
4. Cliquez sur **Créer le profil**.

Vous pouvez également créer un client pendant la saisie d’une réservation, si votre rôle le permet.

Avant toute création, recherchez le client par nom ou e-mail pour éviter les doublons.

### Consulter un profil

Ouvrez un client pour retrouver ses coordonnées, ses préférences, son historique de séjours et les notes internes. Les notes internes sont destinées à l’équipe : renseignez des informations utiles à l’accueil et au suivi du séjour.

## 4. Réservations et suivi des séjours

### Consulter le planning ou la liste

Dans **Réservations**, choisissez la vue **Grille** ou **Liste**.

- La grille présente les séjours par chambre et par date. Cliquez sur un bloc de réservation pour le consulter ; une cellule libre permet de démarrer une saisie selon vos droits.
- La liste permet de rechercher un client ou une chambre et de filtrer les réservations.
- Utilisez les filtres de date, de type ou de statut proposés. Si une réservation semble manquer, effacez les filtres et vérifiez la période affichée.

### Créer une réservation

1. Cliquez sur **Nouvelle réservation**.
2. Recherchez et sélectionnez le client, ou créez son profil.
3. Définissez les dates d’arrivée et de départ par défaut. Le départ doit être postérieur à l’arrivée.
4. Passez à l’étape de sélection des chambres.
5. Sélectionnez une ou plusieurs chambres disponibles. Utilisez la recherche et les filtres pour affiner le choix.
6. Vérifiez les dates de chaque chambre : une réservation peut contenir des chambres avec des périodes différentes.
7. Ajoutez, si nécessaire, les suppléments disponibles et leurs quantités.
8. Contrôlez le résumé, le nombre de nuits et le total estimé, puis validez la saisie.
9. Retrouvez la réservation dans le planning et vérifiez son statut.

Une nouvelle réservation est créée par défaut **En attente de confirmation**. Le bouton final de saisie ne remplace pas l’action **Confirmer la réservation** dans le suivi du séjour.

Une chambre en maintenance ou déjà réservée sur la période demandée peut empêcher l’enregistrement. Adaptez les dates ou choisissez une autre chambre.

### Comprendre les statuts

Le statut affiché tient compte de l’état du séjour, des dates et de la situation de paiement.

| Statut affiché | Signification et action habituelle |
| --- | --- |
| En attente de confirmation | Réservation saisie à confirmer après vérification. |
| À venir | Réservation confirmée dont l’arrivée est future. |
| Arrivée du jour | Arrivée à traiter ; le check-in est proposé aux personnes autorisées. |
| En cours | Client enregistré dans l’établissement. |
| Doit quitter | Départ à traiter. |
| En retard | Période prévue dépassée ; vérifier la situation réelle du séjour. |
| Terminée non payée | Départ effectué avec un solde restant ou une facturation à régulariser. |
| Terminée et payée | Départ effectué et séjour réglé ; la clôture peut être proposée. |
| Clôturée | Réservation archivée définitivement. |
| Annulée | Séjour annulé. |

### Confirmer puis enregistrer l’arrivée

1. Ouvrez la réservation.
2. Pour une réservation en attente, cliquez sur **Confirmer la réservation** et confirmez l’action.
3. Lorsque le séjour affiche **Arrivée du jour**, vérifiez le client, les chambres et les dates.
4. Cliquez sur **Check-in**, puis confirmez. Les chambres passent en occupation.

En cas d’erreur, **Annuler le check-in** est proposé pour certains séjours en cours, selon vos droits. La réservation repasse alors en confirmé.

### Modifier une réservation

Depuis le détail, utilisez **Réassigner** pour changer de chambre, de dates et/ou de tarif. Vérifiez les nouvelles disponibilités, le récapitulatif et les conséquences sur le montant avant de confirmer.

La gestion des chambres permet, selon vos droits, d’ajouter une chambre ou d’en retirer une. La dernière chambre d’une réservation ne peut pas être retirée. Les suppléments se gèrent chambre par chambre ; vérifiez leur quantité et leur tarification.

Les réservations annulées et clôturées ne sont pas modifiables. Après le check-out, les modifications nécessitent une permission particulière. Si une facture existe déjà, contrôlez aussi son montant après toute modification.

### Enregistrer le départ et clôturer

1. Ouvrez le séjour et vérifiez les chambres, les suppléments et les documents de facturation.
2. Encaissez le solde éventuel depuis la facture.
3. Cliquez sur **Check-out** et confirmez. La chambre est libérée.
4. Pour un séjour en retard, l’action peut s’intituler **Forcer la sortie**. Vérifiez que le client a effectivement quitté les lieux avant de l’utiliser.
5. Lorsque le séjour est **Terminé et payé**, utilisez **Clôturer** si votre rôle l’autorise.

Un départ avec impayé nécessite une permission spécifique. Le check-out et la clôture sont deux étapes distinctes : **Clôturer** archive définitivement la réservation.

### Annuler une réservation

1. Ouvrez une réservation dont le statut permet l’annulation.
2. Cliquez sur l’action d’annulation.
3. Vérifiez le **taux de remboursement** proposé : il représente la part des documents visés retournée au client ; le reste est retenu comme frais d’annulation.
4. Confirmez, puis consultez les documents associés.
5. Traitez les éventuels avoirs et remboursements comme indiqué dans la section suivante.

L’annulation du séjour ne prouve pas qu’un remboursement a été versé. Les brouillons concernés sont supprimés et les documents déjà visés donnent lieu à des avoirs en brouillon à examiner.

L’action **Annuler l’annulation**, lorsqu’elle est proposée, remet la réservation en attente de confirmation. Vérifiez ensuite les disponibilités et les documents financiers ; ne supposez pas qu’ils sont rétablis automatiquement.

## 5. Chambres, types et suppléments

### Gérer les types et les chambres

Dans **Chambres**, utilisez **Types de chambre** pour créer ou modifier les catégories d’hébergement et leurs caractéristiques. Un type encore utilisé par des chambres ne peut pas être supprimé.

Pour ajouter une chambre :

1. Cliquez sur **Ajouter une chambre**.
2. Renseignez le numéro, le type et les informations demandées.
3. Vérifiez les caractéristiques, l’image et le tarif applicable.
4. Enregistrez, puis ouvrez la fiche pour contrôler le résultat.

La fiche présente notamment la capacité, la surface, la literie, la vue, les équipements et les disponibilités à venir. Un tarif spécifique à la chambre peut remplacer celui du type lorsque cette option est utilisée.

### Gérer la maintenance

Depuis la fiche d’une chambre, utilisez **Signaler pour maintenance**, puis confirmez. La chambre devient non réservable. Si des réservations actives sont signalées, réassignez-les ou annulez-les selon la situation.

Après intervention, utilisez **Prêt pour le service** pour remettre la chambre en service. Contrôlez ensuite le planning.

### Distinguer caractéristiques et suppléments

- Les **Caractéristiques** décrivent l’hébergement et ses équipements.
- Les **Suppléments** constituent le catalogue des extras facturables associés aux chambres d’une réservation.

Dans **Chambres → Suppléments**, créez un extra avec un nom, un tarif et un mode de calcul : **Par nuit** ou **Forfait unique**. Un supplément peut être désactivé puis réactivé.

Exemple : pour deux nuits, un supplément de 10 000 Ar par nuit, en quantité 1, représente 20 000 Ar. Au forfait unique, le même supplément représente 10 000 Ar.

## 6. Factures, acomptes et paiements

### Retrouver un document

Ouvrez **Factures** pour rechercher un document par numéro ou client. Utilisez les filtres de statut et **Brouillons uniquement** si nécessaire. Les documents d’un séjour sont également accessibles depuis le détail de la réservation et son historique des documents.

### Générer et viser une facture

1. Depuis la réservation, ouvrez sa facture.
2. Si aucune facture n’existe, renseignez le taux de TVA, l’échéance et les notes selon les champs proposés, puis cliquez sur **Générer la facture**.
3. Contrôlez le brouillon : identité du client, chambres, nuits, tarifs, suppléments, TVA et total.
4. Ajoutez les charges ou remises nécessaires si vous y êtes autorisé.
5. Cliquez sur **Viser** lorsque le document est correct.
6. Vérifiez l’attribution du numéro définitif et le statut du document.

**Générer** prépare un brouillon. **Viser** lui attribue son numéro définitif et l’enregistre au grand livre. Le visa est irréversible et un brouillon ne peut pas recevoir de paiement.

Un brouillon peut être supprimé avec **Supprimer le brouillon**, selon vos droits. Un document déjà visé ne se supprime pas de cette manière.

### Ajouter une charge ou une remise

Depuis la facture, utilisez **Charge** pour ajouter une ligne avec une description, une quantité et un prix unitaire. Utilisez **Remise** pour choisir un pourcentage ou un montant fixe et, si nécessaire, préciser un libellé.

Une remise en pourcentage suit les évolutions du montant de la facture ; une remise fixe conserve son montant. Les ajouts de lignes et les remises ne recalculent pas automatiquement la TVA. Contrôlez les totaux ; une modification d’un document visé peut aussi ajuster le grand livre.

### Enregistrer un paiement

1. Ouvrez une facture visée avec un reste à payer.
2. Cliquez sur **Enregistrer un paiement**.
3. Saisissez le montant réellement reçu.
4. Choisissez le moyen proposé : **Espèces**, **MVOLA** ou **Orange Money**.
5. Sélectionnez le compte qui a reçu les fonds. Les comptes proposés dépendent du moyen de paiement et des accès configurés.
6. Ajoutez la référence et les notes utiles, puis confirmez.
7. Vérifiez l’historique, le montant encaissé, le reste à payer et le nouveau statut.

Un règlement partiel laisse un solde à encaisser ; un règlement complet fait passer la facture à **Payée**. Saisissez les montants en ariary entiers.

Exemple sans TVA ni acompte : une facture de 300 000 Ar, réglée une première fois à hauteur de 100 000 Ar, conserve un reste à payer de 200 000 Ar. Le second règlement de 200 000 Ar solde la facture.

L’application enregistre le règlement déclaré. Pour un paiement mobile, vérifiez la réception effective des fonds avant de le saisir.

### Créer et encaisser un acompte

1. Ouvrez l’espace de facturation de la réservation.
2. Cliquez sur **Créer un acompte**, saisissez le montant et les notes, puis confirmez.
3. Ouvrez le document d’acompte dans l’historique.
4. Vérifiez son montant et cliquez sur **Viser**.
5. Enregistrez le paiement reçu sur cet acompte.
6. Lors du visa de la facture définitive, contrôlez la prise en compte des acomptes et le solde restant.

Un acompte visé est repris dans le traitement comptable de la facture définitive. Vérifiez aussi son encaissement : créer ou viser un acompte ne signifie pas que l’argent a été reçu. Le montant d’un acompte en brouillon peut être modifié avec les droits nécessaires.

### Traiter un avoir et un remboursement

Après l’annulation d’un séjour comportant des documents visés :

1. Ouvrez les avoirs associés dans l’historique des documents.
2. Vérifiez le document d’origine, le taux retenu et le montant de l’avoir.
3. Visez l’avoir lorsque les informations sont correctes.
4. Si une somme doit effectivement être rendue, utilisez **Enregistrer un remboursement** sur l’avoir.
5. Renseignez le montant, le moyen, le compte et la référence, puis confirmez.
6. Vérifiez l’historique des remboursements et le reste à rembourser.

Si le document d’origine n’a jamais été encaissé, l’interface indique qu’aucun remboursement n’est à effectuer. Distinguez l’avoir, qui corrige la situation financière, du remboursement, qui constate la sortie d’argent.

### Corriger un paiement et imprimer

L’historique propose une action **Annuler** aux personnes autorisées. Vérifiez le paiement concerné avant de confirmer, puis contrôlez le solde et les mouvements. Cette correction d’enregistrement ne déclenche pas à elle seule une opération auprès d’un opérateur de paiement.

Utilisez **Imprimer** pour ouvrir la boîte d’impression du navigateur. Vous pouvez choisir une imprimante ou l’option d’enregistrement en PDF si votre navigateur la propose. Vérifiez si le document est encore un brouillon avant de le remettre au client.

## 7. Dépenses

### Enregistrer une dépense

1. Ouvrez **Dépenses**, puis **Enregistrer une dépense**.
2. Choisissez une catégorie active.
3. Saisissez un montant positif et une description précise.
4. Sélectionnez le compte de trésorerie utilisé et la date de la dépense.
5. Enregistrez, puis vérifiez la ligne dans la liste et le mouvement de trésorerie correspondant.

Utilisez les filtres de catégorie et de période pour retrouver une opération.

### Gérer les catégories

Le bouton **Catégories** permet aux personnes autorisées de créer ou modifier les catégories et leur compte de charge. Si aucun compte de charge n’est disponible, créez-le dans **Comptes**.

La catégorie détermine l’affectation comptable de la dépense. Une catégorie peut être désactivée puis réactivée ; elle n’est pas supprimée.

## 8. Trésorerie

Dans **Trésorerie**, consultez les soldes des comptes autorisés et leur **Relevé**. Définissez les dates de début et de fin pour examiner les mouvements de la période.

### Effectuer un virement interne

1. Cliquez sur **Virement**.
2. Choisissez le compte source et le compte destination ; ils doivent être différents.
3. Renseignez le montant et les autres informations demandées.
4. Indiquez les frais de transfert éventuels.
5. Confirmez, puis vérifiez les mouvements des deux comptes.

Le compte destination reçoit le montant saisi. Les frais s’ajoutent au prélèvement sur le compte source et sont comptabilisés en charge.

### Enregistrer un apport

Utilisez **Apport** pour enregistrer de l’argent injecté depuis l’extérieur de l’hôtel, par exemple par le propriétaire. Renseignez le compte destinataire, le montant et les informations demandées.

L’apport est affecté au capital ; il ne représente pas un revenu d’exploitation ni un paiement client.

## 9. Rapports et indicateurs

### Rapports comptables

L’écran **Rapports** permet de consulter :

- le **Bilan**, à la date choisie, avec une option pour afficher les comptes à zéro ;
- le **Compte de résultat**, sur une période ;
- les **Acomptes en cours**, encore en attente d’absorption par une facture définitive ;
- le **Grand livre**, à télécharger avec **Exporter le grand livre (CSV)**.

Vérifiez la période avant de consulter ou d’exporter les données. Si le bilan signale un déséquilibre, transmettez le cas au responsable avec la date sélectionnée.

### KPI hôteliers

Choisissez le mois à analyser, puis consultez les trois volets :

| Volet | Exemples de mesures |
| --- | --- |
| Occupation & revenu | Nuitées vendues, occupation, prix moyen (ADR), RevPAR, revenu réel et théorique, détail par chambre. |
| Facturation & encaissement | Factures, encaissements nets, remboursements, recouvrement, créances clients. |
| Rentabilité & structure des charges | Produits comptables, résultat net, marge et poids des charges. |

Le planning alimente l’occupation et les nuitées ; le grand livre alimente les montants comptables. Un encaissement peut concerner une facture d’une autre période : les revenus facturés et les sommes encaissées ne coïncident donc pas toujours.

Les chambres disponibles excluent les chambres actuellement en maintenance, sans historique de leur statut. Tenez compte de cette limite pour interpréter les périodes passées. Certains ratios peuvent dépasser 100 % lorsque les encaissements concernent d’autres périodes.

## 10. Personnel et droits d’accès

### Accorder un accès

1. Ouvrez **Personnel**, puis **Accorder un accès**.
2. Renseignez le nom, le nom d’utilisateur, l’e-mail si nécessaire, le mot de passe et sa confirmation.
3. Choisissez soigneusement le rôle attribué.
4. Validez et vérifiez la présence du membre dans la liste.

Le changement de rôle est disponible selon vos permissions. Confirmez-le après avoir vérifié la personne concernée. Les entrées **Modifier**, **Réinitialiser le mot de passe** et **Révoquer l’accès** du menu d’un membre ne déclenchent actuellement aucune opération ; contactez le support pour ces besoins.

### Configurer les permissions

L’écran **Permissions** présente une matrice des actions par rôle. Les personnes autorisées peuvent créer ou renommer un rôle et cliquer sur les cases pour accorder ou retirer une permission. Les modifications sont enregistrées au fil des actions.

Les droits sont configurables : le nom d’un rôle ne garantit pas un ensemble fixe d’autorisations. Vérifiez particulièrement les droits de visa des factures, de correction des paiements, de départ avec impayé et de modification après départ.

### Configurer les accès à la trésorerie

Dans **Accès trésorerie**, définissez par rôle et par compte :

| Colonne | Usage |
| --- | --- |
| Visible | Consultation du compte. |
| Source | Départ d’un virement. |
| Arrivée | Destination d’un virement. |
| Dépenses | Règlement d’une dépense depuis ce compte. |

**Aucun compte coché ne signifie pas aucun accès.** Sans restriction de visibilité, le rôle voit tous les comptes. Pour une colonne d’usage sans case cochée, tous les comptes visibles conviennent.

La permission **Voir tous les comptes de trésorerie** permet de contourner ces restrictions. Si elle est accordée, retirez-la dans **Permissions** pour que les restrictions de cet écran s’appliquent.

### Consulter le journal d’audit

Ouvrez **Journal d’audit** et utilisez les filtres proposés pour retrouver les actions enregistrées sur une période et une ressource. Cet écran aide à comprendre une modification ou à analyser une opération avec le responsable.

## 11. Paramètres et limites de la version

Dans **Paramètres → Localisation**, le sélecteur de langue est utilisable.

Les autres éléments suivants restent des interfaces de démonstration ou des fonctions incomplètes dans la version examinée :

- **Identité propriété** : les champs sont affichés, mais **Enregistrer la configuration** simule l’enregistrement sans sauvegarde des informations de l’hôtel.
- Les sections **Notifications**, **Sécurité & Accès** et **Design interface** des paramètres affichent un contenu d’attente.
- La page **Équipements / Amenity Operations** présente des données de démonstration et n’est pas proposée dans le menu principal. Elle ne doit pas servir de registre opérationnel.
- Dans **Personnel**, les entrées **Modifier**, **Réinitialiser le mot de passe** et **Révoquer l’accès** du menu d’un membre ne sont pas encore raccordées à une opération.

Pour gérer les accès, utilisez les écrans **Personnel**, **Permissions** et **Accès trésorerie**. Pour les équipements des chambres et les extras facturables, utilisez **Chambres → Caractéristiques / Suppléments**.

## 12. Routine quotidienne

### Début de service

1. Consulter les arrivées, départs et paiements en attente du tableau de bord.
2. Contrôler le planning, les réservations à confirmer et les séjours en retard.
3. Vérifier les chambres en maintenance et les éventuelles réassignations.

### Pendant le service

1. Rechercher le client avant de créer un profil.
2. Confirmer les réservations vérifiées et enregistrer les arrivées réelles.
3. Ajouter les suppléments consommés et les notes utiles.
4. Contrôler et viser les documents avant d’enregistrer les règlements reçus.
5. Enregistrer les dépenses avec le bon compte et la bonne catégorie.

### Fin de service

1. Traiter les départs et identifier les impayés restants.
2. Vérifier les remboursements et les documents encore en brouillon.
3. Rapprocher les encaissements saisis avec les espèces et les transactions mobiles réellement reçues.
4. Consulter le relevé de trésorerie et transmettre les anomalies au responsable.
5. Se déconnecter.

## 13. Résolution des difficultés

| Difficulté | Vérification ou action |
| --- | --- |
| Identifiants incorrects | Vérifier le nom d’utilisateur, le mot de passe et la casse ; contacter le gestionnaire du personnel si nécessaire. |
| Lien de réinitialisation invalide | Contacter l’administrateur ou le support pour rétablir l’accès. |
| Menu ou bouton absent | Vérifier le rôle, les permissions et le statut du dossier avec l’administrateur. |
| Réservation introuvable | Effacer les filtres, vérifier les dates, puis rechercher le client ou la chambre. |
| Chambre indisponible | Vérifier les chevauchements de dates et le statut de maintenance ; choisir une autre chambre ou période. |
| Check-in absent | Vérifier que la réservation est confirmée et affiche « Arrivée du jour », ainsi que les droits de votre rôle. |
| Check-out impossible avec un solde | Encaisser le solde ou faire intervenir une personne autorisée à effectuer un départ avec impayé. |
| Impossible d’encaisser | Vérifier le visa du document, son solde, son statut et vos permissions. |
| Aucun compte de paiement proposé | Faire vérifier les comptes actifs, les moyens acceptés et les restrictions de trésorerie. |
| Aucune catégorie de dépense | Faire créer ou réactiver une catégorie liée à un compte de charge. |
| Montant inattendu | Contrôler les dates par chambre, les tarifs, quantités, suppléments, remises, TVA et acomptes. |
| Erreur de chargement | Vérifier la connexion et recharger la page ; si l’erreur persiste, contacter le support de l’établissement. |
| Doute après un enregistrement interrompu | Consulter d’abord la liste ou l’historique avant de ressaisir l’opération pour éviter un doublon. |

Pour signaler un problème, relevez l’écran concerné, la référence du dossier, l’heure, l’action effectuée et le message affiché. Ne transmettez pas votre mot de passe.

## 14. Lexique

| Terme | Définition |
| --- | --- |
| Check-in | Enregistrement de l’arrivée du client. |
| Check-out | Enregistrement du départ et libération de la chambre. |
| Clôture | Archivage définitif d’une réservation terminée et payée. |
| Brouillon | Document non visé, sans numéro définitif ni inscription au grand livre. |
| Visa | Validation du document avec attribution du numéro définitif et comptabilisation. |
| Acompte | Document permettant de demander puis d’enregistrer un versement avant la facture définitive. |
| Avoir | Document corrigeant tout ou partie d’un document facturé. |
| Encaissement | Enregistrement d’une somme reçue sur un compte. |
| Remboursement | Enregistrement d’une somme rendue au client. |
| Grand livre | Ensemble des écritures comptables enregistrées. |
| ADR | Prix moyen par nuitée vendue. |
| RevPAR | Revenu d’hébergement par nuitée disponible. |

---

Document établi à partir des écrans, traductions et règles du code présent dans le dépôt à la date d’édition. Les parcours n’ont pas été exécutés dans une instance en fonctionnement pour cette rédaction. Les permissions et la configuration de votre établissement peuvent modifier les actions proposées.
