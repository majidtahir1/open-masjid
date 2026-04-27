# syntax=docker/dockerfile:1.7

# -----------------------------------------------------------------------------
# Stage 1 — deps: install production dependencies with a good build cache.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# Sharp and other native modules benefit from having libc6-compat available.
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2 — builder: build Next.js (standalone output) + generate Payload types.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next's standalone build needs a no-op DATABASE_URI at build time because
# payload.config.ts is evaluated. A fake URI is fine — no DB connection is made
# during `next build`. Real URI is supplied at runtime via the container env.
ENV DATABASE_URI=postgres://build:build@localhost:5432/build
ENV PAYLOAD_SECRET=build-only-placeholder-secret
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3 — runner: minimal image with just the standalone server + public assets.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat tini

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create a non-root user to run the app.
RUN addgroup -S -g 1001 nodejs \
  && adduser -S -D -H -u 1001 -G nodejs nextjs

# Copy the standalone output + the static assets + the public folder.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Ensure public/media (where Media uploads land by default) is writable. In
# compose we mount a host/TrueNAS volume over this path so uploads persist.
RUN mkdir -p ./public/media \
  && chown -R nextjs:nodejs ./public/media

USER nextjs

EXPOSE 3000

# Tini handles PID 1 signal forwarding so `docker stop` shuts the Node server
# down gracefully instead of SIGKILL'ing it after 10s.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]

# -----------------------------------------------------------------------------
# Stage 4 — migrator: tiny image for running Payload migrations against the DB
# before the app boots. Uses full node_modules (payload CLI + tsx) so it can
# evaluate the TypeScript config + migration files directly.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS migrator
WORKDIR /app

RUN apk add --no-cache libc6-compat tini

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY src ./src
COPY tsconfig.json ./

ENV NODE_ENV=production

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "payload", "migrate"]
