# Multi-stage build for the Express API + outbox worker.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# shared/ lives next to server/ at build time — mount it or copy it in before build
RUN npm run build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Default: API; override `CMD` with `start:worker` for the worker container.
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
