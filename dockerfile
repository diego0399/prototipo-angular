# ==============================
# ETAPA 1 - Compilar Angular
# ==============================
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build


# ==============================
# ETAPA 2 - Servir con Caddy
# ==============================
FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile

COPY --from=build /app/dist/prototipo-angular/browser /usr/share/caddy