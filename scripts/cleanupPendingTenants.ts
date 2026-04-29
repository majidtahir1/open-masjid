/**
 * Sweep tenants that signed up but never activated.
 *
 * A tenant becomes 'active' the first time its admin logs in (see the
 * afterLogin hook on the Users collection). If 7 days pass without that
 * happening, this script deletes both the tenant row and its users —
 * freeing the slug for the next person who wants it and keeping the DB
 * clean of abandoned signups.
 *
 * Run via:
 *   npm run cleanup:pending-tenants
 *
 * In production schedule it daily (cron, GitHub Actions, Vercel Cron).
 * Idempotent — safe to run repeatedly.
 */

import { getPayload } from 'payload'
import config from '../src/payload.config'

const TTL_DAYS = 7

async function run() {
  const payload = await getPayload({ config })
  const cutoff = new Date(Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const stale = await payload.find({
    collection: 'tenants',
    where: {
      and: [
        { status: { equals: 'pending' } },
        { createdAt: { less_than: cutoff } },
      ],
    },
    limit: 1000,
    overrideAccess: true,
  })

  if (stale.docs.length === 0) {
    payload.logger.info('cleanupPendingTenants: nothing to do')
    return
  }

  for (const tenant of stale.docs as Array<{ id: string | number; slug: string; name: string }>) {
    payload.logger.info(
      `cleanupPendingTenants: deleting pending tenant "${tenant.name}" (slug=${tenant.slug}, id=${tenant.id})`,
    )

    // Delete users belonging to this tenant first to avoid orphaned rows.
    const users = await payload.find({
      collection: 'users',
      where: { tenant: { equals: tenant.id } },
      limit: 100,
      overrideAccess: true,
    })
    for (const u of users.docs as Array<{ id: string | number }>) {
      await payload.delete({ collection: 'users', id: u.id, overrideAccess: true })
    }

    await payload.delete({ collection: 'tenants', id: tenant.id, overrideAccess: true })
  }

  payload.logger.info(`cleanupPendingTenants: deleted ${stale.docs.length} pending tenant(s)`)
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err)
    process.exit(1)
  },
)
