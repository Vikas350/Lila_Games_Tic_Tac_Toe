FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN apk add --no-cache git && npm install && npm install --save-dev @rollup/plugin-typescript tslib

COPY tsconfig.json rollup.config.js ./
COPY src/ src/

RUN npx rollup --config rollup.config.js

FROM registry.heroiclabs.com/heroiclabs/nakama:3.21.1

COPY --from=builder /app/build/*.js /nakama/data/modules/build/
COPY local.yml /nakama/data/
