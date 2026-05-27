import type { CollectionAfterChangeHook } from 'payload'

/**
 * After any kiosk content doc is created or updated, bump the tenant's
 * `kioskBroadcastAt` timestamp. Kiosks poll for state every ~5s; this
 * timestamp is folded into the version hash, so connected displays pick up
 * the change on their next poll without needing a manual push.
 */
export const bumpKioskBroadcast: CollectionAfterChangeHook = async ({ doc, req }) => {
  try {
    const tenantId =
      typeof doc.tenant === 'object' && doc.tenant !== null && 'id' in doc.tenant
        ? (doc.tenant as { id: string | number }).id
        : doc.tenant
    if (!tenantId) return doc
    await req.payload.update({
      collection: 'tenants',
      id: tenantId as string | number,
      data: { kioskBroadcastAt: new Date().toISOString() },
      overrideAccess: true,
      req,
    })
  } catch (err) {
    req.payload.logger.error({ err, docId: doc.id }, 'bumpKioskBroadcast: failed')
  }
  return doc
}
