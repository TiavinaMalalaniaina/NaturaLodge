COMPOSE = docker compose

.PHONY: help build up down restart stop logs logs-server logs-client ps clean migrate seed studio sh-server sh-client sh-db \
	install install-server install-client dev dev-server dev-client db-up db-down local-migrate local-seed local-studio

help: ## Affiche cette aide
	@echo Cibles disponibles :
	@echo   [Docker]
	@echo     build         Build les images (server + client)
	@echo     up            Build puis demarre la stack (db + server + client)
	@echo     down          Arrete et supprime les conteneurs (donnees conservees)
	@echo     restart       Redemarre toute la stack
	@echo     stop          Stoppe les conteneurs sans les supprimer
	@echo     logs          Suit les logs de tous les services
	@echo     logs-server   Suit les logs du serveur
	@echo     logs-client   Suit les logs du client
	@echo     ps            Liste les conteneurs et leur statut
	@echo     clean         Down + suppression des volumes (efface la DB)
	@echo     migrate       Applique les migrations Prisma (conteneur)
	@echo     seed          Injecte les donnees de demo (conteneur)
	@echo     studio        Ouvre Prisma Studio (conteneur, port 5555)
	@echo     sh-server     Shell dans le conteneur server
	@echo     sh-client     Shell dans le conteneur client
	@echo     sh-db         Shell psql dans le conteneur db
	@echo   [Local, sans Docker]
	@echo     install       Installe les dependances npm (client + serveur)
	@echo     dev           Lance serveur+client en parallele (meme terminal)
	@echo     dev-server    Lance le serveur en local (port 4000)
	@echo     dev-client    Lance le client en local (port 3000)
	@echo     db-up         Optionnel: Postgres via Docker si vous n'en avez pas
	@echo     db-down       Arrete le Postgres lance par db-up
	@echo     local-migrate Migrations Prisma en local
	@echo     local-seed    Seed en local
	@echo     local-studio  Prisma Studio en local

build: ## Build les images (server + client)
	$(COMPOSE) build

up: ## Build puis démarre la stack (db + server + client) en arrière-plan
	$(COMPOSE) up -d --build

down: ## Arrête et supprime les conteneurs (les données Postgres sont conservées)
	$(COMPOSE) down

restart: down up ## Redémarre toute la stack

stop: ## Stoppe les conteneurs sans les supprimer
	$(COMPOSE) stop

logs: ## Suit les logs de tous les services
	$(COMPOSE) logs -f

logs-server: ## Suit les logs du serveur uniquement
	$(COMPOSE) logs -f server

logs-client: ## Suit les logs du client uniquement
	$(COMPOSE) logs -f client

ps: ## Liste les conteneurs et leur statut
	$(COMPOSE) ps

clean: ## Arrête et supprime conteneurs + volumes (⚠️ efface la base de données)
	$(COMPOSE) down -v

migrate: ## Applique les migrations Prisma en attente
	$(COMPOSE) exec server npx prisma migrate deploy

seed: ## Injecte les données de démo
	$(COMPOSE) exec server npx tsx prisma/seed.ts

studio: ## Ouvre Prisma Studio (http://localhost:5555)
	$(COMPOSE) run --rm -p 5555:5555 server npx prisma studio

sh-server: ## Ouvre un shell dans le conteneur server
	$(COMPOSE) exec server sh

sh-client: ## Ouvre un shell dans le conteneur client
	$(COMPOSE) exec client sh

sh-db: ## Ouvre un shell psql dans le conteneur db
	$(COMPOSE) exec db psql -U naturalodge -d naturalodge

# ─── Lancement en local (sans Docker) ──────────────────────────────────────
# Utilise npm run dev directement (client + serveur tournent sur la machine hôte).
# Nécessite server/.env avec un DATABASE_URL pointant vers un Postgres déjà
# accessible (natif ou autre) — voir CLAUDE.md. db-up/db-down sont de simples
# raccourcis optionnels si vous n'avez pas encore de Postgres local.

install: install-server install-client ## Installe les dépendances npm (client + serveur)

install-server: ## Installe les dépendances npm du serveur
	cd server && npm install

install-client: ## Installe les dépendances npm du client
	cd client && npm install

db-up: ## (optionnel) Démarre un Postgres via Docker sur le port 5432, si vous n'en avez pas déjà un local
	$(COMPOSE) up -d db

db-down: ## Arrête le Postgres lancé par db-up
	$(COMPOSE) stop db

dev-server: ## Lance le serveur en local avec hot-reload (npm run dev, port 4000)
	cd server && npm run dev

dev-client: ## Lance le client en local avec hot-reload (npm run dev, port 3000)
	cd client && npm run dev

dev: ## Lance serveur + client en local en parallele dans le meme terminal (via concurrently)
	npx --yes concurrently -n server,client -c blue,green "cd server && npm run dev" "cd client && npm run dev"

local-migrate: ## Applique les migrations Prisma en local (contre server/.env)
	cd server && npm run db:migrate

local-seed: ## Injecte les données de démo en local (contre server/.env)
	cd server && npm run db:seed

local-studio: ## Ouvre Prisma Studio en local (http://localhost:5555)
	cd server && npm run db:studio
