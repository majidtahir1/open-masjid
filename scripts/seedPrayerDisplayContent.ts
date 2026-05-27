/**
 * Backfill the prayer-display content library for existing tenants.
 *
 * New tenants are seeded automatically by the `seedPrayerDisplayContent`
 * afterChange hook on the Tenants collection. This script covers tenants that
 * existed before that hook landed: any tenant with zero `prayer-display-content`
 * rows gets the default verses / hadith / Bismillah inserted.
 *
 * Run via:
 *   npm run seed:prayer-display-content
 *
 * Idempotent — only seeds tenants that currently have no content rows, so it's
 * safe to run repeatedly.
 */

import { getPayload } from 'payload'
import config from '../src/payload.config'
import { prayerContentSeedRows } from '../src/lib/kiosk/prayerContentSeeds'

async function run() {
  const payload = await getPayload({ config })

  const tenants = await payload.find({
    collection: 'tenants',
    limit: 1000,
    overrideAccess: true,
  })

  let seeded = 0
  for (const tenant of tenants.docs as Array<{ id: number; name?: string; slug?: string }>) {
    const label = tenant.name ?? tenant.slug ?? String(tenant.id)

    const existing = await payload.find({
      collection: 'prayer-display-content',
      where: { tenant: { equals: tenant.id } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.totalDocs > 0) {
      payload.logger.info(
        `seedPrayerDisplayContent: "${label}" already has ${existing.totalDocs} entr${existing.totalDocs === 1 ? 'y' : 'ies'} — skipping`,
      )
      continue
    }

    const rows = prayerContentSeedRows(tenant.id)
    for (const row of rows) {
      await payload.create({
        collection: 'prayer-display-content',
        data: row,
        overrideAccess: true,
      })
    }
    seeded++
    payload.logger.info(`seedPrayerDisplayContent: seeded ${rows.length} entries for "${label}"`)
  }

  payload.logger.info(`seedPrayerDisplayContent: done — seeded ${seeded} tenant(s)`)
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err)
    process.exit(1)
  },
)
