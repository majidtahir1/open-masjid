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

  const { getPayload } = await import('payload')
  const config = (await import('@payload-config')).default
  const payload = await getPayload({ config })

  const INTERVAL_MS = 30_000
  const LIMIT = 25

  const tick = async () => {
    try {
      await payload.jobs.run({ limit: LIMIT, queue: 'default' })
    } catch {
      // Swallow errors — a failed tick shouldn't crash dev.
    }
  }

  // Kick once immediately so already-due jobs run right after boot.
  tick()
  setInterval(tick, INTERVAL_MS)
}
