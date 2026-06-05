// tests/lib/demo-seed.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ensureDemoTenant,
  seedDemoContent,
  resetDemoContent,
  ensureDemoAdmin,
} from '@/lib/demo/seedDemo'

/**
 * Collection-aware mock payload mirroring the style of
 * membership-webhook.test.ts. `find`/`findByID`/`create`/`update`/`delete` are
 * vi.fn()s branching on `collection`. Per-collection seed data can be injected
 * via `over` to drive create-vs-update branches.
 */
function makePayload(
  over: {
    tenant?: { id: number } | null // tenant resolved by slug
    tiers?: any[] // existing membership tiers (matched by name)
    adminUser?: { id: number } | null // existing demo admin user
  } = {},
) {
  const tenantDocs = over.tenant === undefined ? [{ id: 7 }] : over.tenant ? [over.tenant] : []
  const tiers = over.tiers ?? []
  const adminDocs = over.adminUser === undefined ? [] : over.adminUser ? [over.adminUser] : []

  const find = vi.fn(async ({ collection, where }: any) => {
    if (collection === 'tenants') return { docs: tenantDocs }
    if (collection === 'membership-tiers') {
      // Match the upsert lookup by name (where.and[1].name.equals).
      const name = where?.and?.[1]?.name?.equals
      const match = tiers.find((t) => t.name === name)
      return { docs: match ? [match] : [] }
    }
    if (collection === 'users') return { docs: adminDocs }
    return { docs: [] }
  })
  const findByID = vi.fn(async ({ id }: any) => ({ id }))
  const create = vi.fn(async (a: any) => ({ id: 99, ...a.data }))
  const update = vi.fn(async (a: any) => ({ id: a.id, ...a.data }))
  const del = vi.fn(async () => ({ docs: [] }))

  return { find, findByID, create, update, delete: del } as any
}

beforeEach(() => {
  process.env.DEMO_STRIPE_ACCOUNT_ID = 'acct_test_dummy'
  process.env.DEMO_ADMIN_PASSWORD = 'demo-pass-123'
  delete process.env.DEMO_ADMIN_EMAIL
})

describe('ensureDemoTenant', () => {
  it('creates the tenant when none exists', async () => {
    const payload = makePayload({ tenant: null })
    const id = await ensureDemoTenant(payload)
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'tenants' }),
    )
    expect(payload.update).not.toHaveBeenCalled()
    expect(id).toBe(99)
  })

  it('updates the tenant when it already exists', async () => {
    const payload = makePayload({ tenant: { id: 42 } })
    const id = await ensureDemoTenant(payload)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'tenants', id: 42 }),
    )
    expect(payload.create).not.toHaveBeenCalled()
    expect(id).toBe(42)
  })

  it('throws when DEMO_STRIPE_ACCOUNT_ID is unset', async () => {
    delete process.env.DEMO_STRIPE_ACCOUNT_ID
    const payload = makePayload({ tenant: null })
    await expect(ensureDemoTenant(payload)).rejects.toThrow('DEMO_STRIPE_ACCOUNT_ID')
  })
})

describe('seedDemoContent', () => {
  it('bulk-deletes only transactional data, NOT imported content or membership-tiers', async () => {
    const payload = makePayload()
    await seedDemoContent(payload, 7)
    const deleted = payload.delete.mock.calls.map((c: any[]) => c[0].collection)
    for (const c of ['members', 'donations', 'form-submissions']) {
      expect(deleted).toContain(c)
    }
    // Imported website content is no longer wiped (it persists across resets).
    for (const c of ['announcements', 'events', 'forms', 'services', 'hero-slides']) {
      expect(deleted).not.toContain(c)
    }
    expect(deleted).not.toContain('membership-tiers')
  })

  it('upserts tiers — creates a tier that does not yet exist', async () => {
    const payload = makePayload({ tiers: [] }) // no existing tiers
    await seedDemoContent(payload, 7)
    const tierCreates = payload.create.mock.calls.filter(
      (c: any[]) => c[0].collection === 'membership-tiers',
    )
    expect(tierCreates).toHaveLength(3)
    // Every tier create carries the tenant relationship.
    for (const call of tierCreates) {
      expect(call[0].data.tenant).toBe(7)
    }
  })

  it('upserts tiers — updates an existing tier rather than creating', async () => {
    const payload = makePayload({ tiers: [{ id: 500, name: 'Supporter' }] })
    await seedDemoContent(payload, 7)
    const tierUpdates = payload.update.mock.calls.filter(
      (c: any[]) => c[0].collection === 'membership-tiers',
    )
    const tierCreates = payload.create.mock.calls.filter(
      (c: any[]) => c[0].collection === 'membership-tiers',
    )
    // Supporter is updated; Family + Patron are created.
    expect(tierUpdates).toHaveLength(1)
    expect(tierUpdates[0][0].id).toBe(500)
    expect(tierCreates).toHaveLength(2)
  })

  it('does NOT recreate imported content (announcements/events/forms)', async () => {
    const payload = makePayload()
    await seedDemoContent(payload, 7)
    const created = payload.create.mock.calls.map((c: any[]) => c[0].collection)
    expect(created).not.toContain('announcements')
    expect(created).not.toContain('events')
    expect(created).not.toContain('forms')
  })
})

describe('resetDemoContent', () => {
  it('creates the tenant when find returns none, then seeds content', async () => {
    const payload = makePayload({ tenant: null })
    const { tenantId } = await resetDemoContent(payload)
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'tenants' }),
    )
    expect(tenantId).toBe(99)
    // Content wipe ran against the new tenant id.
    expect(payload.delete).toHaveBeenCalled()
  })

  it('updates the tenant when it exists', async () => {
    const payload = makePayload({ tenant: { id: 42 } })
    const { tenantId } = await resetDemoContent(payload)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'tenants', id: 42 }),
    )
    expect(tenantId).toBe(42)
  })
})

describe('ensureDemoAdmin', () => {
  it('creates the admin when none exists', async () => {
    const payload = makePayload({ adminUser: null })
    await ensureDemoAdmin(payload, 7)
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        data: expect.objectContaining({
          email: 'demo-admin@demo.openmasjid.app',
          role: 'admin',
          tenant: 7,
          password: 'demo-pass-123',
        }),
      }),
    )
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('updates the admin (incl. password) when it exists', async () => {
    const payload = makePayload({ adminUser: { id: 88 } })
    await ensureDemoAdmin(payload, 7)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 88,
        data: expect.objectContaining({ password: 'demo-pass-123', tenant: 7 }),
      }),
    )
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('honors DEMO_ADMIN_EMAIL override', async () => {
    process.env.DEMO_ADMIN_EMAIL = 'custom@demo.test'
    const payload = makePayload({ adminUser: null })
    await ensureDemoAdmin(payload, 7)
    expect(payload.create.mock.calls[0][0].data.email).toBe('custom@demo.test')
  })

  it('throws when DEMO_ADMIN_PASSWORD is unset', async () => {
    delete process.env.DEMO_ADMIN_PASSWORD
    const payload = makePayload({ adminUser: null })
    await expect(ensureDemoAdmin(payload, 7)).rejects.toThrow('DEMO_ADMIN_PASSWORD')
  })
})
