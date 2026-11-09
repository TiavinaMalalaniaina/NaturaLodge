FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Baked into the static JS: without it the site would silently call http://localhost:4000 in production.
ARG PUBLIC_API_URL
RUN test -n "$PUBLIC_API_URL" || (echo "PUBLIC_API_URL est obligatoire (ex: --build-arg PUBLIC_API_URL=https://api.example.com/api/public)" >&2; exit 1)
ENV PUBLIC_API_URL=$PUBLIC_API_URL
RUN API_ORIGIN=$(node -e "console.log(new URL(process.env.PUBLIC_API_URL).origin)") \
 && sed "s|__API_ORIGIN__|$API_ORIGIN|" security-headers.conf > security-headers.generated.conf
RUN npm run build
# Hors production (préprod) : le site ne doit jamais être indexé ni concurrencer le vrai site.
ARG PUBLIC_APP_ENV=production
RUN if [ "$PUBLIC_APP_ENV" != "production" ]; then \
      echo 'add_header X-Robots-Tag "noindex, nofollow" always;' >> security-headers.generated.conf \
      && printf 'User-agent: *\nDisallow: /\n' > dist/robots.txt; \
    fi

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/security-headers.generated.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
