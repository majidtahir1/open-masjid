#!/bin/sh
# Entrypoint for the production app container.
#
# Runs pending Payload migrations against the runtime DATABASE_URI, then starts
# the Next.js standalone server. `payload migrate` is idempotent: it is a no-op
# when nothing is pending. If a migration fails the script exits non-zero and
# the container does NOT start serving (loud failure, recover by rolling back
# to the previous :sha- image tag).
#
# On migration failure it also sends a best-effort Telegram alert (when
# TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID are set) so a crash-loop is visible
# instead of silent. A successful deploy is announced by Watchtower, so we only
# notify here on failure to avoid double messages.
set -e

# Best-effort Telegram ping. Never blocks startup: no-ops when unset, swallows
# network errors. Uses node (always present in the image) so HTTPS just works.
notify() {
  [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ] || return 0
  node -e '
    const https = require("https");
    const body = new URLSearchParams({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: process.argv[1],
    }).toString();
    const req = https.request(
      "https://api.telegram.org/bot" + process.env.TELEGRAM_BOT_TOKEN + "/sendMessage",
      { method: "POST", headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      } },
    );
    req.on("error", () => process.exit(0));
    req.end(body);
  ' "$1" 2>/dev/null || true
}

echo "[entrypoint] running payload migrate..."
if ! npx payload migrate; then
  echo "[entrypoint] migration FAILED"
  notify "❌ OpenMasjid: startup migration FAILED on $(hostname). App is NOT serving (container will keep retrying)."
  # Back off so a restart:unless-stopped crash-loop doesn't spam Telegram or
  # hammer the DB — at most one alert per minute.
  sleep 60
  exit 1
fi

echo "[entrypoint] starting server..."
exec node server.js
