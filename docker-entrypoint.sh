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
