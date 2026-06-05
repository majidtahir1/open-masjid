import type { Payload } from 'payload'
import path from 'path'

const MEDIA_STATIC_DIR = 'public/media'

// Collections to clone, in dependency order, with the dot-paths of fields that
// hold a `media` upload id (to remap to the cloned media).
const CLONE_CONFIG: Array<{ collection: string; uploads: string[] }> = [
  { collection: 'services', uploads: [] },
  { collection: 'hero-slides', uploads: ['splitFields.image', 'photoFields.image'] },
  { collection: 'events', uploads: ['flyerImage'] },
  { collection: 'forms', uploads: [] },
  { collection: 'announcements', uploads: [] },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const seedReq = (): any => ({ user: { id: 0, role: 'platformOwner', email: 'demo-import@seed' } })

export interface CloneReport {
  media: { copied: number; skipped: number }
  collections: Record<string, number>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPath(obj: any, dotted: string): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return dotted.split('.').reduce((o: any, k) => (o == null ? undefined : o[k]), obj)
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setPath(obj: any, dotted: string, value: unknown): void {
  const keys = dotted.split('.')
  let o = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (o[keys[i]] == null || typeof o[keys[i]] !== 'object') return // path absent; nothing to set
    o = o[keys[i]]
  }
  o[keys[keys.length - 1]] = value
}
/** Extract a relationship/upload id whether scalar or populated `{id}`. */
function relId(v: unknown): string | number | null {
  if (v == null) return null
  if (typeof v === 'object' && 'id' in (v as object)) return (v as { id: string | number }).id
  return v as string | number
}

/**
 * Clone visible site content (+ referenced media files) from one tenant to
 * another. PII collections are never touched. Idempotency (wiping the dest
 * first) is the caller's responsibility.
 */
export async function cloneTenantContent(
  payload: Payload,
  srcTenantId: string | number,
  destTenantId: string | number,
): Promise<CloneReport> {
  const report: CloneReport = { media: { copied: 0, skipped: 0 }, collections: {} }

  // 1. Media first → build id map.
  const mediaMap = new Map<string | number, string | number>()
  const media = await payload.find({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collection: 'media' as any,
    where: { tenant: { equals: srcTenantId } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const m of media.docs as any[]) {
    try {
      const created = (await payload.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: 'media' as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { alt: m.alt ?? undefined, tenant: destTenantId } as any,
        filePath: path.join(MEDIA_STATIC_DIR, m.filename),
        overrideAccess: true,
        req: seedReq(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any
      mediaMap.set(m.id, created.id)
      report.media.copied++
    } catch (err) {
      console.warn(`[clone] skipped media ${m.filename}: ${(err as Error).message}`)
      report.media.skipped++
    }
  }

  // 2. Content collections in order.
  for (const cfg of CLONE_CONFIG) {
    const docs = await payload.find({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: cfg.collection as any,
      where: { tenant: { equals: srcTenantId } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    let n = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const src of docs.docs as any[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = { ...src }
      delete data.id
      delete data.createdAt
      delete data.updatedAt
      data.tenant = destTenantId
      for (const p of cfg.uploads) {
        const cur = relId(getPath(data, p))
        if (cur != null) setPath(data, p, mediaMap.get(cur) ?? null)
      }
      try {
        await payload.create({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          collection: cfg.collection as any,
          data,
          overrideAccess: true,
          req: seedReq(),
        })
        n++
      } catch (err) {
        console.warn(`[clone] ${cfg.collection} doc failed: ${(err as Error).message}`)
      }
    }
    report.collections[cfg.collection] = n
  }
  return report
}

/** Delete the dest tenant's cloneable content + media (content first to avoid
 *  upload FK issues), so a re-import is clean. */
export async function wipeTenantContent(
  payload: Payload,
  destTenantId: string | number,
): Promise<void> {
  for (const c of ['announcements', 'forms', 'events', 'hero-slides', 'services', 'media']) {
    await payload.delete({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: c as any,
      where: { tenant: { equals: destTenantId } },
      overrideAccess: true,
      req: seedReq(),
    })
  }
}
