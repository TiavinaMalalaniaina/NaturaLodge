# --- Dependencies --------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ---------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Runtime (nginx static) ------------------------------------------------
FROM nginx:1.27-alpine AS runtime
# Nom d'hôte du conteneur serveur pour le proxy /api (voir nginx.conf.template) — "server" convient
# au docker-compose.yml local ; surchargé par une variable d'environnement Coolify
# (API_UPSTREAM=naturalodge-server-container) quand server/db/client sont 3 ressources séparées,
# pas ce docker-compose.yml (voir monitoring/README.md).
ENV API_UPSTREAM=server
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
