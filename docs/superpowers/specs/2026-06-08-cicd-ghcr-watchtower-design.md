# CI/CD: build-on-merge to GHCR + Watchtower auto-deploy

**Date:** 2026-06-08
**Status:** Approved design, ready for implementation planning

## Goal

When code is merged to `main`, GitHub Actions builds the production Docker
image and pushes it to GitHub Container Registry (GHCR). The production server
runs Watchtower, which detects the new image, pulls it, and recreates the app
container. Database migrations run automatically on app startup.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Registry | GitHub Container Registry (`ghcr.io/majidtahir1/open-masjid`) |
| Deploy mechanism | Watchtower (pull-based, polls registry on the prod server) |
| Migrations | Run in the app container's entrypoint (`payload migrate` → `node server.js`) |
| CI gating | `publish` job gated on existing `test` + `build` jobs passing |
| Fast-ship override | `[fast-ship]` in commit message skips gates; `workflow_dispatch` manual trigger as backup |
| Image | Single app image (the `runner` target, extended with the migrate toolchain). The separate `migrator` image is no longer needed for prod. |

## Architecture

```
merge to main ──▶ GitHub Actions (publish job in ci.yml)
                     │  builds Dockerfile `runner` target, pushes to GHCR
                     ▼
        ghcr.io/majidtahir1/open-masjid:latest  (+ :sha-<short> tag)
                     │
                     ▼ (Watchtower polls every 300s)
   prod server: Watchtower ──▶ pulls new image ──▶ recreates `app`
                                                      │
                                  entrypoint: payload migrate → node server.js
```

## Component 1 — Build & publish workflow

Folded into the existing `.github/workflows/ci.yml` as a new `publish` job (not
a separate workflow file), so a red build can never publish an image.

- **Triggers:** existing `pull_request`/`push` triggers stay; add
  `workflow_dispatch` for manual on-demand publish.
- **Gating:** `publish` has `needs: [test, build]` and runs only on
  `push` to `main`.
- **Fast-ship override:** the `test` and `build` jobs gain
  `if: ${{ !(github.event_name == 'push' && contains(github.event.head_commit.message, '[fast-ship]')) }}`
  so they are skipped (not failed) on cosmetic commits. Skipped dependencies
  resolve instantly, so `publish` does not wait for them.
- **Publish condition:**

  ```yaml
  publish:
    needs: [test, build]
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
  ```

- **Steps:** `actions/checkout` → `docker/setup-buildx-action` →
  `docker/login-action` to `ghcr.io` with `${{ secrets.GITHUB_TOKEN }}` →
  `docker/metadata-action` to derive tags → `docker/build-push-action`:
  - `target: runner`
  - `tags: ghcr.io/majidtahir1/open-masjid:latest` and `:sha-<short-sha>`
  - `cache-from: type=gha`, `cache-to: type=gha,mode=max`
- **No new CI secret:** the built-in `GITHUB_TOKEN` with `packages: write`
  authenticates the push.

> Reserved-token note: use `[fast-ship]`, **not** `[skip ci]` — the latter
> cancels the whole workflow run (including `publish`).

## Component 2 — App image change (migrations in entrypoint)

The current `runner` stage ships only the minimal Next.js standalone output,
which lacks the Payload CLI and `tsx` needed by `payload migrate`. The image is
extended so migrations can run at startup.

- Copy the migrate toolchain into the `runner` stage (the same inputs the
  existing `migrator` stage uses): full `node_modules` (from the `deps`
  stage), `src`, `scripts`, `tsconfig.json`.
- Add `docker-entrypoint.sh`:

  ```sh
  #!/bin/sh
  set -e
  npx payload migrate    # idempotent; no-op when nothing is pending
  exec node server.js
  ```

- Replace the runner `CMD` with this entrypoint (still wrapped by `tini` for
  PID-1 signal handling: `ENTRYPOINT ["/sbin/tini", "--", "/app/docker-entrypoint.sh"]`).
- The `nextjs` non-root user must be able to read the toolchain files and run
  migrate; chown copied paths accordingly.

**Accepted trade-off:** bundling full `node_modules` + `src` grows the app
image by several hundred MB over the lean standalone build. The user accepted
this in exchange for self-contained, correctly-ordered migrations that work
under any restart mechanism (Watchtower, compose, manual).

The standalone `migrator` stage can be left in the Dockerfile for ad-hoc manual
use but is no longer part of the prod deploy path.

## Component 3 — Production stack (`docker-compose.prod.yml`)

- **`app` service:**
  - Set `image: ghcr.io/majidtahir1/open-masjid:latest`.
  - Remove the `build:` block — prod pulls, never builds.
  - Add a Watchtower enable label so only this container is auto-updated:
    `com.centurylinklabs.watchtower.enable=true`.
- **`migrate` service:** removed (redundant — entrypoint handles migrations).
  The `app` no longer needs `depends_on: migrate`.
- **`watchtower` service (new):**
  - Image `containrrr/watchtower`.
  - Mounts `/var/run/docker.sock:/var/run/docker.sock`.
  - Mounts the GHCR auth config (read-only PAT) so it can pull the private
    image — e.g. `~/.docker/config.json:/config.json:ro` with
    `DOCKER_CONFIG=/`.
  - Env: `WATCHTOWER_POLL_INTERVAL=300`, `WATCHTOWER_CLEANUP=true`
    (prune replaced images), `WATCHTOWER_LABEL_ENABLE=true` (only watch
    labelled containers, leaving `db` and `cron` untouched).
  - `restart: unless-stopped`.
- **`db` and `cron` services:** unchanged.

## Component 4 — Secrets & access

- **CI push:** no new secret. Built-in `GITHUB_TOKEN` + `permissions: packages: write`.
- **Prod pull:** a GHCR personal access token scoped `read:packages`, placed on
  the server in `~/.docker/config.json` (via `docker login ghcr.io`) and
  mounted into Watchtower. One-time manual setup.
- **Package visibility:** GHCR package kept **private** (PAT-gated pull).

## Component 5 — Documentation

Update the README "Deploying with Docker" section:

- Creating the GHCR read-only PAT and running `docker login ghcr.io` on the
  server.
- How Watchtower behaves (poll interval, cleanup, label scope).
- Manual operations: force a pull
  (`docker compose pull app && docker compose up -d app`) and roll back to a
  pinned `:sha-<short>` tag.

## Out of scope

- Blue/green or zero-downtime deploys (single-container recreate is acceptable).
- Multi-arch image builds (prod is a single known architecture).
- Trimming the app image back down after the toolchain addition (possible
  future optimization).

## Risks & mitigations

- **Migration failure blocks startup:** Watchtower stops the old container
  before starting the new one, so if `payload migrate` fails the new container
  enters a crash/restart loop and there is a brief outage (no automatic
  rollback). Mitigation: the CI `build` job exercises the same code path before
  publish; a failed migration is loud in container logs and recovered by
  pinning the `app` service back to the previous `:sha-<short>` tag and
  `docker compose up -d app`. Document this rollback path.
- **Watchtower pulling a broken `:latest`:** mitigated by the CI gate — only
  test+build-passing commits publish `:latest` (except deliberate
  `[fast-ship]` cosmetic commits).
- **GHCR PAT expiry:** document rotation; pull failures surface in Watchtower
  logs.
