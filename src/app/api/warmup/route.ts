/**
 * GET /api/warmup
 *
 * Pre-warm endpoint hit once at server boot (from `instrumentation.ts`) and
 * optionally by a healthcheck after deploy. Initializes the Payload singleton
 * and opens a Postgres connection so the next user request doesn't pay the
 * cold-start cost (typically 1–3s).
 *
 * Always returns 200 with a small JSON body; failures are swallowed so the
 * route never poisons a healthcheck.
 */

import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const payload = await getPayload({ config })
    await payload
      .find({
        collection: 'tenants',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => {})
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
