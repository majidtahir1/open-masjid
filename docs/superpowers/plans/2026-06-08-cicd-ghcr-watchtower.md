# CI/CD: GHCR build-on-merge + Watchtower auto-deploy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On merge to `main`, GitHub Actions builds the production app image and pushes it to GHCR; the prod server's Watchtower pulls it and recreates the app, which runs DB migrations on startup.

**Architecture:** Extend the existing `.github/workflows/ci.yml` with a gated `publish` job that builds the Dockerfile `runner` target and pushes to `ghcr.io/majidtahir1/open-masjid`. The `runner` image is extended with the Payload migrate toolchain and an entrypoint that runs `payload migrate` before `node server.js`. `docker-compose.prod.yml` switches the app to a pulled image and adds a Watchtower service; the old one-shot `migrate` service is removed.

**Tech Stack:** GitHub Actions, `docker/build-push-action`, GHCR, Docker multi-stage build, Watchtower, Payload CMS migrations, Next.js standalone.

**Note on testing:** This is infrastructure config. "Verify" steps use YAML/Docker validation commands (`docker compose config`, `docker build`, `actionlint` if available) instead of unit tests. Build verification of the full image is the primary gate.

---

## File Structure

- `Dockerfile` (modify): extend the `runner` stage with the migrate toolchain; add entrypoint.
- `docker-entrypoint.sh` (create): runs `payload migrate` then `node server.js`.
- `.github/workflows/ci.yml` (modify): add `workflow_dispatch`, make `test`/`build` skip on `[fast-ship]`, add `publish` job.
- `docker-compose.prod.yml` (modify): app uses GHCR image + Watchtower label; remove `migrate` service; add `watchtower` service.
- `README.md` (modify): "Deploying with Docker" — GHCR login, Watchtower behavior, manual pull/rollback.

---

## Task 1: Add the app entrypoint script (migrate → serve)

**Files:**
- Create: `docker-entrypoint.sh`

- [ ] **Step 1: Create the entrypoint script**

Create `docker-entrypoint.sh`:

```sh
#!/bin/sh
# Entrypoint for the production app container.
#
# Runs pending Payload migrations against the runtime DATABASE_URI, then starts
# the Next.js standalone server. `payload migrate` is idempotent: it is a no-op
# when nothing is pending. If a migration fails the script exits non-zero and
# the container does NOT start serving (loud failure, recover by rolling back
# to the previous :sha- image tag).
set -e

echo "[entrypoint] running payload migrate..."
npx payload migrate

echo "[entrypoint] starting server..."
exec node server.js
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x docker-entrypoint.sh && ls -l docker-entrypoint.sh`
Expected: mode shows `-rwxr-xr-x` (executable bit set).

- [ ] **Step 3: Verify it is syntactically valid shell**

Run: `sh -n docker-entrypoint.sh && echo OK`
Expected: prints `OK` (no syntax errors).

- [ ] **Step 4: Commit**

```bash
git add docker-entrypoint.sh
git commit -m "feat(docker): add app entrypoint that migrates before serving"
```

---

## Task 2: Extend the runner image with the migrate toolchain + entrypoint

**Files:**
- Modify: `Dockerfile` (runner stage, lines ~38–69)

The `runner` stage currently copies only the standalone output (no Payload CLI / `tsx` / migration sources). Add the toolchain the `migrator` stage already uses, copy in the entrypoint, and switch `CMD`→entrypoint.

- [ ] **Step 1: Add the migrate toolchain + entrypoint to the runner stage**

In `Dockerfile`, the runner stage currently ends:

```dockerfile
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
```

Replace that block with:

```dockerfile
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
```

(Note: the `CMD ["node", "server.js"]` line is removed — the entrypoint script invokes the server directly.)

- [ ] **Step 2: Build the runner image to verify it compiles**

Run: `docker build --target runner -t openmasjid/app:plan-test .`
Expected: build completes successfully through the runner stage (exit 0).

- [ ] **Step 3: Verify the entrypoint + toolchain are present in the image**

Run: `docker run --rm --entrypoint sh openmasjid/app:plan-test -c "ls -l /app/docker-entrypoint.sh && ls /app/node_modules/.bin/payload && ls /app/src/payload.config.ts"`
Expected: the entrypoint script (executable), the `payload` CLI bin, and `payload.config.ts` all exist.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile
git commit -m "feat(docker): bundle migrate toolchain + entrypoint into runner image"
```

---

## Task 3: Make CI gates skippable via `[fast-ship]` and add `workflow_dispatch`

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add `workflow_dispatch` to triggers**

In `.github/workflows/ci.yml`, the `on:` block is:

```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
```

Replace with:

```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  workflow_dispatch: {}
```

- [ ] **Step 2: Make `test` and `build` jobs skip on `[fast-ship]` push commits**

Add this `if` to BOTH the `test` job and the `build` job, as the first line under each `job`'s name (i.e. directly under `test:` add it above `name:`, and likewise under `build:`):

```yaml
    if: ${{ !(github.event_name == 'push' && contains(github.event.head_commit.message, '[fast-ship]')) }}
```

So `test` becomes:

```yaml
  test:
    if: ${{ !(github.event_name == 'push' && contains(github.event.head_commit.message, '[fast-ship]')) }}
    name: Type check + tests
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      ...
```

and `build` becomes:

```yaml
  build:
    if: ${{ !(github.event_name == 'push' && contains(github.event.head_commit.message, '[fast-ship]')) }}
    name: Build
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      ...
```

- [ ] **Step 3: Validate the workflow YAML**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')"`
Expected: prints `YAML OK`.

(If `actionlint` is installed: `actionlint .github/workflows/ci.yml` — expected no errors. Skip if not installed.)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add workflow_dispatch and [fast-ship] gate skip"
```

---

## Task 4: Add the `publish` job that builds & pushes to GHCR

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Append the `publish` job**

Add this job at the end of the `jobs:` block in `.github/workflows/ci.yml`:

```yaml
  # Build the prod app image and push to GHCR. Runs only on merges to main
  # (or manual dispatch). Gated on test+build passing, UNLESS the commit
  # message contains [fast-ship] (cosmetic changes) or it's a manual dispatch.
  publish:
    name: Build & push image
    needs: [test, build]
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
      packages: write
    if: >
      always()
      && ((github.event_name == 'push' && github.ref == 'refs/heads/main')
          || github.event_name == 'workflow_dispatch')
      && (
        (needs.test.result == 'success' && needs.build.result == 'success')
        || contains(github.event.head_commit.message, '[fast-ship]')
        || github.event_name == 'workflow_dispatch'
      )
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Derive image tags
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/majidtahir1/open-masjid
          tags: |
            type=raw,value=latest
            type=sha,prefix=sha-,format=short

      - name: Build and push runner image
        uses: docker/build-push-action@v6
        with:
          context: .
          target: runner
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 2: Validate the workflow YAML**

Run: `python3 -c "import yaml,sys; d=yaml.safe_load(open('.github/workflows/ci.yml')); assert 'publish' in d['jobs']; print('publish job present, YAML OK')"`
Expected: prints `publish job present, YAML OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: publish app image to GHCR on merge to main"
```

---

## Task 5: Update prod compose — GHCR image, Watchtower, drop migrate service

**Files:**
- Modify: `docker-compose.prod.yml`

- [ ] **Step 1: Remove the one-shot `migrate` service**

Delete the entire `migrate:` service block (migrations now run in the app entrypoint):

```yaml
  migrate:
    build:
      context: .
      dockerfile: Dockerfile
      target: migrator
    image: openmasjid/migrator:latest
    restart: "no"
    depends_on:
      db:
        condition: service_healthy
    env_file: ${ENV_FILE:-.env}
```

- [ ] **Step 2: Point `app` at the GHCR image, remove build, drop migrate dependency, add Watchtower label**

The `app` service currently is:

```yaml
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    image: openmasjid/app:latest
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    env_file: ${ENV_FILE:-.env}
    ports:
      - "${APP_BIND:-0.0.0.0}:${APP_HOST_PORT:-3000}:3000"
    volumes:
      - ${MEDIA_PATH:-./media}:/app/public/media
```

Replace it with:

```yaml
  app:
    image: ghcr.io/majidtahir1/open-masjid:latest
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    env_file: ${ENV_FILE:-.env}
    labels:
      # Only this container is auto-updated by Watchtower (label-scoped below).
      com.centurylinklabs.watchtower.enable: "true"
    ports:
      # Publish on the LAN so an off-box NPM can proxy to
      # http://<host-ip>:${APP_HOST_PORT}. Use APP_BIND=127.0.0.1 to restrict
      # to localhost only (e.g. when NPM runs on the same machine).
      - "${APP_BIND:-0.0.0.0}:${APP_HOST_PORT:-3000}:3000"
    volumes:
      # Host/TrueNAS mount for uploaded media. Point MEDIA_PATH at a local
      # directory OR an NFS-mounted share. Default: ./media (host).
      - ${MEDIA_PATH:-./media}:/app/public/media
```

- [ ] **Step 3: Add the `watchtower` service**

Add this service to the `services:` block (e.g. after `app`, before `cron`):

```yaml
  watchtower:
    image: containrrr/watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      # GHCR auth so Watchtower can pull the private image. Create this on the
      # host with `docker login ghcr.io` using a read:packages PAT (see README).
      - ${DOCKER_CONFIG_PATH:-~/.docker/config.json}:/config.json:ro
    environment:
      # Only watch containers explicitly labelled enable=true (the app).
      WATCHTOWER_LABEL_ENABLE: "true"
      # Poll the registry every 5 minutes.
      WATCHTOWER_POLL_INTERVAL: "300"
      # Remove the old image after a successful update.
      WATCHTOWER_CLEANUP: "true"
    command: ["--label-enable"]
```

- [ ] **Step 4: Validate the compose file resolves**

Run: `docker compose -f docker-compose.prod.yml config >/dev/null && echo "compose OK"`
Expected: prints `compose OK` (no `migrate` service, `app` uses the GHCR image, `watchtower` present). Warnings about unset env vars are fine.

- [ ] **Step 5: Confirm the `migrate` service is gone and `watchtower` is present**

Run: `docker compose -f docker-compose.prod.yml config --services | sort`
Expected: lists `app`, `cron`, `db`, `watchtower` — and NOT `migrate`.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.prod.yml
git commit -m "feat(deploy): pull app from GHCR + Watchtower auto-update, drop migrate service"
```

---

## Task 6: Document deploy in README

**Files:**
- Modify: `README.md` ("Deploying with Docker" section)

- [ ] **Step 1: Locate the deploy section**

Run: `grep -n "Deploying with Docker" README.md`
Expected: prints the line number of the section header. (If absent, add a new `## Deploying with Docker` section near other deploy docs.)

- [ ] **Step 2: Add the GHCR + Watchtower subsection**

Under "Deploying with Docker", add the following subsection (place it after any existing intro paragraph):

````markdown
### Automated image builds & Watchtower deploys

On every merge to `main`, GitHub Actions builds the production app image and
pushes it to GHCR as `ghcr.io/majidtahir1/open-masjid:latest` (plus a
`sha-<short>` tag for the exact commit). The publish step is gated on the
`test` + `build` jobs passing. For cosmetic changes that don't need the full
gate, include `[fast-ship]` in the commit message to skip the test/build wait,
or trigger the workflow manually from the Actions tab ("Run workflow").

**One-time server setup — GHCR pull auth.** The image package is private, so the
server needs a read-only token to pull it. Create a GitHub Personal Access
Token with the `read:packages` scope, then on the server:

```bash
echo "<YOUR_PAT>" | docker login ghcr.io -u <your-github-username> --password-stdin
```

This writes `~/.docker/config.json`, which the `watchtower` service mounts
read-only. Override the path with `DOCKER_CONFIG_PATH` in `.env` if it lives
elsewhere.

**How auto-deploy works.** The `watchtower` service polls GHCR every 5 minutes
(`WATCHTOWER_POLL_INTERVAL=300`). When a new `:latest` image is available it
pulls it, recreates the `app` container, and prunes the old image
(`WATCHTOWER_CLEANUP=true`). Only the `app` container is watched (it carries the
`com.centurylinklabs.watchtower.enable=true` label); `db` and `cron` are left
alone. On startup the app runs `payload migrate` before serving, so schema
changes apply automatically.

**Manual operations.**

```bash
# Force an immediate pull + restart of the app:
docker compose -f docker-compose.prod.yml pull app
docker compose -f docker-compose.prod.yml up -d app

# Roll back to a specific build (a migration broke, etc.): pin the app image to
# a known-good sha tag and bring it up.
#   1. Edit docker-compose.prod.yml: app.image: ghcr.io/majidtahir1/open-masjid:sha-<short>
#   2. docker compose -f docker-compose.prod.yml up -d app
# (Or override per-invocation without editing the file.)
```
````

- [ ] **Step 3: Verify the docs render / mention the key pieces**

Run: `grep -n "watchtower\|ghcr.io\|fast-ship\|read:packages" README.md`
Expected: matches for GHCR image, Watchtower, the fast-ship override, and the PAT scope.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: GHCR build + Watchtower deploy instructions"
```

---

## Task 7: Final full-image build verification

**Files:** none (verification only)

- [ ] **Step 1: Build the full image one more time from a clean state**

Run: `docker build --target runner -t openmasjid/app:final-check .`
Expected: clean successful build (exit 0).

- [ ] **Step 2: Smoke-test the entrypoint wiring without a DB**

Run: `docker run --rm --entrypoint sh openmasjid/app:final-check -c "head -1 /app/docker-entrypoint.sh && test -x /app/docker-entrypoint.sh && echo entrypoint-executable"`
Expected: prints `#!/bin/sh` and `entrypoint-executable`.

(A full migrate+serve run requires a real `DATABASE_URI`; that is validated on the prod server at first deploy, not in this plan.)

- [ ] **Step 3: Clean up test images**

Run: `docker rmi openmasjid/app:plan-test openmasjid/app:final-check 2>/dev/null; echo done`
Expected: prints `done`.

---

## Self-Review Notes

- **Spec coverage:** Component 1 (publish workflow) → Tasks 3–4; Component 2 (app image migrate toolchain + entrypoint) → Tasks 1–2; Component 3 (prod compose: GHCR image, Watchtower, drop migrate) → Task 5; Component 4 (secrets/access) → README in Task 6 (CI uses built-in `GITHUB_TOKEN`, no code change needed; prod PAT documented); Component 5 (docs) → Task 6. Final build gate → Task 7.
- **`[fast-ship]` reserved-token caution** from the spec is honored: we use `[fast-ship]`, never `[skip ci]`.
- **Migrator stage** is intentionally left in the Dockerfile for manual use; no task removes it (matches spec "can be left for ad-hoc manual use").
