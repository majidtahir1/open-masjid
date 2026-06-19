import type { CollectionBeforeDeleteHook } from 'payload'
import { APIError } from 'payload'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Block hard-deleting a class that has any sessions or enrollments — history
 * (including attendance, which hangs off sessions) must be preserved. Admins
 * should archive (status: 'archived') instead. Mirrors the UI's `canHardDelete`
 * guard so a raw REST DELETE can't bypass it.
 */
export const blockClassDeleteWithHistory: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const payload = req.payload as any
  const [enr, ses] = await Promise.all([
    payload.find({ collection: 'enrollments', where: { class: { equals: id } }, limit: 0, depth: 0, overrideAccess: true, req }),
    payload.find({ collection: 'class-sessions', where: { class: { equals: id } }, limit: 0, depth: 0, overrideAccess: true, req }),
  ])
  if ((enr.totalDocs ?? 0) > 0 || (ses.totalDocs ?? 0) > 0) {
    throw new APIError('This class has enrollments or sessions — archive it instead of deleting.', 400)
  }
}
