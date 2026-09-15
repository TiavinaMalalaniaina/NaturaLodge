# --- Base --------------------------------------------------------------
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl
# IPv6 vers registry.npmjs.org instable/coupé sur certains VPS (ex. Contabo) → Node résout le
# registry en IPv6 par défaut, la connexion traîne puis se coupe (ECONNRESET en plein téléchargement,
# vu en prod). Force IPv4 en priorité pour npm/Node sans dépendre d'une correction réseau côté hôte.
ENV NODE_OPTIONS=--dns-result-order=ipv4first

# --- Dependencies --------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
# Retries généreux : une coupure réseau isolée ne doit plus faire échouer tout le déploiement.
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm ci

# --- Build ---------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Runtime -----------------------------------------------------------
# Keeps the full node_modules (incl. the `prisma` CLI and `tsx`) since `migrate deploy`
# needs it at container start, alongside prisma.config.ts for the datasource URL. `src/` is
# also kept (not just `dist/`) so that one-off maintenance scripts under `prisma/` (backfills,
# etc.) can import the app's real Prisma client/services via `tsx` exactly like in local dev —
# same script, same import paths, both environments — instead of duplicating logic per-target.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY package.json ./

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
