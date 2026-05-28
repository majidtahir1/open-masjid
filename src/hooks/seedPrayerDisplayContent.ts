import type { CollectionAfterChangeHook } from 'payload'
import { prayerContentSeedRows } from '../lib/kiosk/prayerContentSeeds'

/**
 * After a tenant is created, seed its prayer-display content library with the
 * default verses / hadith / Bismillah so admins start with an editable set
 * rather than an empty collection. (An empty collection silently falls back to
 * the in-code seeds, which surprises admins and flips to "only my entry" the
 * moment they add one.)
 *
 * Uses overrideAccess: runs as part of tenant creation, possibly before the
 * tenant's first user exists.
 */
export const seedPrayerDisplayContent: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc
  for (const row of prayerContentSeedRows(doc.id)) {
    await req.payload.create({
      collection: 'prayer-display-content',
      data: row,
      overrideAccess: true,
    })
  }
  return doc
}

export default seedPrayerDisplayContent
