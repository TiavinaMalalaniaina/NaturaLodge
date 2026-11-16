FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Baked into the static JS. Default: same origin as the site, relayed to the API by nginx (see
# nginx.conf) so the customer session cookie stays first-party (SameSite=Lax). An absolute URL still
# works when the API is on the same site (api.example.com for example.com), never on another domain.
ARG PUBLIC_API_URL=/api/public
ENV PUBLIC_API_URL=$PUBLIC_API_URL
RUN API_ORIGIN=$(node -e "const u = process.env.PUBLIC_API_URL; console.log(u.startsWith('/') ? '' : new URL(u).origin)") \
 && sed "s|__API_ORIGIN__|$API_ORIGIN|" security-headers.conf > security-headers.generated.conf
RUN npm run build
# Hors production (préprod) : le site ne doit jamais être indexé ni concurrencer le vrai site.
ARG PUBLIC_APP_ENV=production
RUN if [ "$PUBLIC_APP_ENV" != "production" ]; then \
      echo 'add_header X-Robots-Tag "noindex, nofollow" always;' >> security-headers.generated.conf \
      && printf 'User-agent: *\nDisallow: /\n' > dist/robots.txt; \
    fi

FROM nginx:stable-alpine
# Upstream of the /api/public relay, substituted at container start (see nginx.conf).
ENV API_UPSTREAM=server
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/security-headers.generated.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
