// tests/lib/cloneTenantContent.test.ts
import { describe, it, expect, vi } from 'vitest'
import { cloneTenantContent, wipeTenantContent } from '@/lib/demo/cloneTenantContent'

const SRC = 1
const DEST = 2

const OLD_MEDIA_FLYER = 10 // referenced by an event's flyerImage
const OLD_MEDIA_HERO = 11 // referenced by a hero-slide's splitFields.image
const NEW_MEDIA_FLYER = 110
const NEW_MEDIA_HERO = 111

/**
 * Collection-aware mock payload mirroring the style of demo-seed.test.ts.
 * `find`/`create`/`delete` are vi.fn()s branching on `collection`.
 *
 * Source fixtures:
 *  - media: two docs (flyer + hero background)
 *  - events: one doc whose flyerImage = OLD_MEDIA_FLYER
 *  - hero-slides: one doc whose splitFields.image = OLD_MEDIA_HERO
 *  - services/forms/announcements: one plain doc each
 *
 * `create` for media returns a deterministic new id keyed off the source file
 * so the test can assert the remap.
 */
function makePayload(
  over: {
    /** drop a media id from the map by making its create throw (file missing). */
    failMediaFilename?: string
  } = {},
) {
  const mediaDocs = [
    { id: OLD_MEDIA_FLYER, filename: 'flyer.png', alt: 'Flyer', tenant: SRC },
    { id: OLD_MEDIA_HERO, filename: 'hero.jpg', alt: 'Hero', tenant: SRC },
  ]
  const srcByCollection: Record<string, any[]> = {
    services: [{ id: 1, title: 'Marriage Services', tenant: SRC }],
    'hero-slides': [
      {
        id: 2,
        title: 'Welcome',
        tenant: SRC,
        splitFields: { cardTitle: 'X', image: OLD_MEDIA_HERO },
        photoFields: { ayah: 'Y', image: null },
      },
    ],
    events: [{ id: 3, title: 'Eid', tenant: SRC, flyerImage: OLD_MEDIA_FLYER }],
    forms: [{ id: 4, title: 'RSVP', tenant: SRC }],
    announcements: [{ id: 5, title: 'Notice', tenant: SRC }],
  }

  const newMediaId: Record<string, number> = {
    'flyer.png': NEW_MEDIA_FLYER,
    'hero.jpg': NEW_MEDIA_HERO,
  }

  const find = vi.fn(async ({ collection }: any) => {
    if (collection === 'media') return { docs: mediaDocs }
    return { docs: srcByCollection[collection] ?? [] }
  })

  const create = vi.fn(async (a: any) => {
    if (a.collection === 'media') {
      const fname = a.filePath?.split('/').pop()
      if (over.failMediaFilename && fname === over.failMediaFilename) {
        throw new Error('ENOENT: file missing')
      }
      return { id: newMediaId[fname] ?? 999, ...a.data }
    }
    return { id: 1000, ...a.data }
  })

  const del = vi.fn(async () => ({ docs: [] }))

  return { find, create, delete: del } as any
}

const PII = ['members', 'donations', 'form-submissions', 'users']

describe('cloneTenantContent', () => {
  it('clones media BEFORE content and remaps an event flyerImage to the new id', async () => {
    const payload = makePayload()
    await cloneTenantContent(payload, SRC, DEST)

    const createCollections = payload.create.mock.calls.map((c: any[]) => c[0].collection)
    // First creates must be media.
    expect(createCollections[0]).toBe('media')
    expect(createCollections[1]).toBe('media')

    const eventCreate = payload.create.mock.calls
      .map((c: any[]) => c[0])
      .find((a: any) => a.collection === 'events')
    expect(eventCreate.data.flyerImage).toBe(NEW_MEDIA_FLYER)
  })

  it('sets tenant=dest and strips id/createdAt/updatedAt on every content create', async () => {
    const payload = makePayload()
    await cloneTenantContent(payload, SRC, DEST)

    const contentCreates = payload.create.mock.calls
      .map((c: any[]) => c[0])
      .filter((a: any) => a.collection !== 'media')
    expect(contentCreates.length).toBeGreaterThan(0)
    for (const a of contentCreates) {
      expect(a.data.tenant).toBe(DEST)
      expect(a.data).not.toHaveProperty('id')
      expect(a.data).not.toHaveProperty('createdAt')
      expect(a.data).not.toHaveProperty('updatedAt')
    }
  })

  it('never reads or writes PII collections', async () => {
    const payload = makePayload()
    await cloneTenantContent(payload, SRC, DEST)

    const readCollections = payload.find.mock.calls.map((c: any[]) => c[0].collection)
    const writeCollections = payload.create.mock.calls.map((c: any[]) => c[0].collection)
    for (const c of PII) {
      expect(readCollections).not.toContain(c)
      expect(writeCollections).not.toContain(c)
    }
  })

  it('remaps a hero-slides splitFields.image upload to the new media id', async () => {
    const payload = makePayload()
    await cloneTenantContent(payload, SRC, DEST)

    const heroCreate = payload.create.mock.calls
      .map((c: any[]) => c[0])
      .find((a: any) => a.collection === 'hero-slides')
    expect(heroCreate.data.splitFields.image).toBe(NEW_MEDIA_HERO)
  })

  it('nulls an upload field when its media id is missing from the map', async () => {
    // The flyer media create fails → OLD_MEDIA_FLYER never enters the map.
    const payload = makePayload({ failMediaFilename: 'flyer.png' })
    const report = await cloneTenantContent(payload, SRC, DEST)

    expect(report.media.skipped).toBe(1)
    expect(report.media.copied).toBe(1)

    const eventCreate = payload.create.mock.calls
      .map((c: any[]) => c[0])
      .find((a: any) => a.collection === 'events')
    expect(eventCreate.data.flyerImage).toBeNull()
  })
})

describe('wipeTenantContent', () => {
  it('deletes exactly the 5 content collections + media for dest, never PII', async () => {
    const payload = makePayload()
    await wipeTenantContent(payload, DEST)

    const deleted = payload.delete.mock.calls.map((c: any[]) => c[0].collection)
    expect(new Set(deleted)).toEqual(
      new Set(['announcements', 'forms', 'events', 'hero-slides', 'services', 'media']),
    )
    expect(deleted).toHaveLength(6)
    for (const c of PII) expect(deleted).not.toContain(c)
    // All scoped to the dest tenant.
    for (const call of payload.delete.mock.calls) {
      expect(call[0].where.tenant.equals).toBe(DEST)
    }
  })
})
