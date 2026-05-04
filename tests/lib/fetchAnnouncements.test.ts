import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { TenantRecord } from '@/lib/tenant-parse'

// Capture the args payload.find is called with so we can assert the where-clause shape.
const findMock = vi.fn()

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    find: findMock,
  })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

// Re-import after mocks are registered.
import { fetchAnnouncements } from '@/lib/data'

const tenant: TenantRecord = { id: 7, slug: 'test', name: 'Test' }

describe('fetchAnnouncements', () => {
  beforeEach(() => {
    findMock.mockReset()
    findMock.mockResolvedValue({ docs: [] })
  })

  it('filters to active=true, _status=published, and unexpired (or no expiresAt)', async () => {
    await fetchAnnouncements(tenant)
    expect(findMock).toHaveBeenCalledTimes(1)
    const args = findMock.mock.calls[0]?.[0] as {
      collection: string
      where: Record<string, unknown>
      sort: string
      draft: boolean
      overrideAccess: boolean
    }
    expect(args.collection).toBe('announcements')
    expect(args.overrideAccess).toBe(true)
    expect(args.draft).toBe(false)
    expect(args.sort).toBe('-createdAt')
    expect(args.where).toMatchObject({
      tenant: { equals: 7 },
      active: { equals: true },
      _status: { equals: 'published' },
    })
    const orClause = args.where.or as Array<Record<string, unknown>>
    expect(Array.isArray(orClause)).toBe(true)
    expect(orClause).toHaveLength(2)
    // First clause: expiresAt > now (ISO string).
    const gt = (orClause[0] as { expiresAt: { greater_than: string } }).expiresAt.greater_than
    expect(typeof gt).toBe('string')
    // Loose ISO check.
    expect(Number.isNaN(Date.parse(gt))).toBe(false)
    // Second clause: evergreen (no expiresAt).
    expect(orClause[1]).toEqual({ expiresAt: { exists: false } })
  })

  it('skips the _status gate when draft=true', async () => {
    await fetchAnnouncements(tenant, { draft: true })
    const args = findMock.mock.calls[0]?.[0] as {
      where: Record<string, unknown>
      draft: boolean
    }
    expect(args.draft).toBe(true)
    expect(args.where._status).toBeUndefined()
    // Still keeps the active+expiresAt filters.
    expect(args.where.active).toEqual({ equals: true })
    expect(Array.isArray(args.where.or)).toBe(true)
  })

  it('returns [] when payload.find throws', async () => {
    findMock.mockRejectedValueOnce(new Error('db down'))
    const docs = await fetchAnnouncements(tenant)
    expect(docs).toEqual([])
  })
})
