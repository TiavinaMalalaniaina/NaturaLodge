# --- Dependencies --------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
# IPv6 vers registry.npmjs.org instable/coupé sur certains VPS (ex. Contabo) → ECONNRESET en plein
# téléchargement, vu en prod côté server/Dockerfile — même fix ici par cohérence/prévention.
ENV NODE_OPTIONS=--dns-result-order=ipv4first
COPY package.json package-lock.json ./
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm ci

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
