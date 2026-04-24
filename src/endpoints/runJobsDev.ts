import type { Endpoint, PayloadHandler } from 'payload'

/**
 * Dev-only: drain pending jobs from the default queue.
 *
 * Called on a timer from `src/instrumentation.ts` via plain `fetch()` so the
 * instrumentation file doesn't need to `import 'payload'` (which drags the
 * entire Node-only dep graph into Next.js's bundler and blows up).
 *
 * Unauthenticated on purpose — `NEXT_PUBLIC_` node env check gates the route;
 * the handler itself refuses any request when NODE_ENV !== 'development'. In
 * production a real platform cron hits `/api/payload-jobs/run` with creds.
 */
const handler: PayloadHandler = async (req) => {
  if (process.env.NODE_ENV !== 'development') {
    return Response.json({ error: 'Not available in production.' }, { status: 403 })
  }
  try {
    const result = await req.payload.jobs.run({ limit: 25, queue: 'default' })
    return Response.json({ ok: true, result })
  } catch (err) {
    return Response.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    )
  }
}

export const runJobsDevEndpoint: Endpoint = {
  path: '/run-jobs-dev',
  method: 'post',
  handler,
}
