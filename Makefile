COMPOSE = docker compose

.PHONY: help build up down restart stop logs logs-server logs-client ps clean migrate seed studio sh-server sh-client sh-db

help: ## Affiche cette aide
	@echo "Cibles disponibles :"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

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
