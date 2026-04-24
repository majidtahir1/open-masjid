/**
 * Next.js instrumentation hook — runs once per server boot, before any
 * request is handled. Survives HMR (the `register` function is only called
 * on full server init, not on file changes), which makes it the right place
 * to set up long-lived background timers.
 *
 * In dev, Payload's built-in Croner-based `jobs.autoRun` doesn't tick
 * reliably because Next.js periodically invalidates the module holding it.
 * So we run our own minute-long `setInterval` here, fire-and-forget calling
 * `payload.jobs.run()` to drain the scheduled-publish queue.
 *
 * In production we do not start the interval — a platform cron / scheduler
 * (Vercel Cron, Fly scheduled machines, crontab, etc.) should POST to
 * `/api/payload-jobs/run` every minute instead. See README.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV !== 'development') return

  const url =
    (process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000') +
    '/api/run-jobs-dev'
  const INTERVAL_MS = 30_000

  const tick = async () => {
    try {
      await fetch(url, { method: 'POST' })
    } catch {
      // Swallow errors — a failed tick shouldn't crash dev, and early ticks
      // may hit the server before the route registers.
    }
  }

  // Delay the first tick a few seconds so the Next.js server is up and the
  // custom endpoint is registered.
  setTimeout(tick, 5_000)
  setInterval(tick, INTERVAL_MS)
}
