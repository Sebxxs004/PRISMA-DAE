FROM node:20 AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/. ./
COPY --from=build /app/server/public ./public

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "index.js"]
