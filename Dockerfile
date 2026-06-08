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

# Migrate toolchain: the standalone output does NOT include the Payload CLI or
# tsx, so we add the full node_modules + TypeScript sources the entrypoint needs
# to run `payload migrate` at startup. This is the same set of inputs the
# `migrator` stage uses. It grows the image but makes the container
# self-migrating under any restart mechanism (Watchtower, compose, manual).
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs src ./src
COPY --chown=nextjs:nodejs scripts ./scripts
COPY --chown=nextjs:nodejs tsconfig.json ./tsconfig.json
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Ensure public/media (where Media uploads land by default) is writable. In
# compose we mount a host/TrueNAS volume over this path so uploads persist.
RUN mkdir -p ./public/media \
  && chown -R nextjs:nodejs ./public/media

USER nextjs

EXPOSE 3000

# Tini handles PID 1 signal forwarding so `docker stop` shuts the Node server
# down gracefully instead of SIGKILL'ing it after 10s. The entrypoint runs
# pending migrations, then execs the standalone server.
ENTRYPOINT ["/sbin/tini", "--", "/app/docker-entrypoint.sh"]

# -----------------------------------------------------------------------------
# Stage 4 — migrator: standalone image for running Payload migrations against
# the DB. Uses full node_modules (payload CLI + tsx) so it can evaluate the
# TypeScript config + migration files directly.
#
# NOTE: the production app now self-migrates on startup (see docker-entrypoint.sh
# in the runner stage), so this stage is NOT part of the deploy path. It is kept
# only for ad-hoc manual use: `docker build --target migrator -t om-migrator .`
# then `docker run --rm --env-file .env om-migrator`.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS migrator
WORKDIR /app

RUN apk add --no-cache libc6-compat tini

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY src ./src
COPY scripts ./scripts
COPY tsconfig.json ./

ENV NODE_ENV=production

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "payload", "migrate"]
