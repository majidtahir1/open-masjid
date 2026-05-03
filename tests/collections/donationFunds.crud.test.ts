import { describe, it, expect } from 'vitest'
import { DonationFunds } from '@/collections/DonationFunds'

/**
 * CRUD-shape tests for DonationFunds.
 *
 * The repo intentionally does not spin up a full Payload instance for tests;
 * instead, we model CRUD behaviour against an in-memory store that mirrors
 * the schema's invariants (the composite [tenant, slug] unique index from
 * Task 1.3 is the source of truth for slug uniqueness — verified directly
 * against `DonationFunds.indexes`).
 *
 * Subtask 3.1 — failing CRUD test (TDD entry point for Task 3).
 */

type Fund = {
  id: number
  tenant: number
  name: string
  slug: string
  zakatEligible?: boolean
  active?: boolean
  sortOrder?: number
}

class FundsStore {
  private rows: Fund[] = []
  private nextId = 1

  private uniqueIndex(): { fields: string[]; unique?: boolean } {
    const idx = (DonationFunds.indexes ?? []).find(
      (i: any) =>
        Array.isArray(i.fields) &&
        i.fields.includes('tenant') &&
        i.fields.includes('slug') &&
        i.unique,
    ) as { fields: string[]; unique?: boolean } | undefined
    if (!idx) {
      throw new Error(
        'DonationFunds is missing the required unique [tenant, slug] index',
      )
    }
    return idx
  }

  create(data: Omit<Fund, 'id'>): Fund {
    // Enforce composite-unique index just like the DB would.
    this.uniqueIndex()
    const conflict = this.rows.find(
      (r) => r.tenant === data.tenant && r.slug === data.slug,
    )
    if (conflict) {
      throw new Error(
        `duplicate key value violates unique constraint on (tenant, slug): tenant=${data.tenant} slug=${data.slug}`,
      )
    }
    const row: Fund = {
      id: this.nextId++,
      active: true,
      sortOrder: 0,
      zakatEligible: false,
      ...data,
    }
    this.rows.push(row)
    return row
  }

  find(where: Partial<Fund> = {}): Fund[] {
    return this.rows
      .filter((r) =>
        Object.entries(where).every(([k, v]) => (r as any)[k] === v),
      )
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  }

  update(id: number, patch: Partial<Fund>): Fund {
    const row = this.rows.find((r) => r.id === id)
    if (!row) throw new Error(`fund ${id} not found`)
    const next = { ...row, ...patch }
    if (next.slug !== row.slug || next.tenant !== row.tenant) {
      const conflict = this.rows.find(
        (r) =>
          r.id !== id && r.tenant === next.tenant && r.slug === next.slug,
      )
      if (conflict) {
        throw new Error(
          `duplicate key value violates unique constraint on (tenant, slug)`,
        )
      }
    }
    Object.assign(row, patch)
    return row
  }
}

describe('DonationFunds CRUD (in-memory, schema-driven)', () => {
  it('admin can create, list, edit, archive, and reorder funds', () => {
    const store = new FundsStore()

    // CREATE
    const sadaqah = store.create({
      tenant: 1,
      name: 'Sadaqah',
      slug: 'sadaqah',
      sortOrder: 0,
    })
    const building = store.create({
      tenant: 1,
      name: 'Building Fund',
      slug: 'building',
      sortOrder: 1,
    })
    expect(sadaqah.id).toBeGreaterThan(0)
    expect(building.id).toBeGreaterThan(0)

    // LIST (tenant-scoped)
    const list = store.find({ tenant: 1 })
    expect(list.map((f) => f.slug)).toEqual(['sadaqah', 'building'])

    // EDIT (rename)
    const renamed = store.update(building.id, { name: 'New Building Fund' })
    expect(renamed.name).toBe('New Building Fund')

    // ARCHIVE (active: false hides from public)
    const archived = store.update(building.id, { active: false })
    expect(archived.active).toBe(false)
    const visible = store.find({ tenant: 1, active: true })
    expect(visible.map((f) => f.slug)).toEqual(['sadaqah'])

    // REORDER via sortOrder
    store.update(sadaqah.id, { sortOrder: 5 })
    store.update(building.id, { sortOrder: 1, active: true })
    const reordered = store.find({ tenant: 1 })
    expect(reordered.map((f) => f.slug)).toEqual(['building', 'sadaqah'])
  })

  it('rejects duplicate slug within the same tenant', () => {
    const store = new FundsStore()
    store.create({ tenant: 1, name: 'Sadaqah', slug: 'sadaqah' })
    expect(() =>
      store.create({ tenant: 1, name: 'Sadaqah Two', slug: 'sadaqah' }),
    ).toThrow(/unique constraint/i)
  })

  it('allows the same slug across different tenants (per-tenant uniqueness)', () => {
    const store = new FundsStore()
    const a = store.create({ tenant: 1, name: 'Sadaqah', slug: 'sadaqah' })
    const b = store.create({ tenant: 2, name: 'Sadaqah', slug: 'sadaqah' })
    expect(a.tenant).toBe(1)
    expect(b.tenant).toBe(2)
    expect(a.slug).toBe(b.slug)
  })

  it('rejects an update that would create a cross-row slug collision in one tenant', () => {
    const store = new FundsStore()
    store.create({ tenant: 1, name: 'Sadaqah', slug: 'sadaqah' })
    const zakat = store.create({ tenant: 1, name: 'Zakat', slug: 'zakat' })
    expect(() => store.update(zakat.id, { slug: 'sadaqah' })).toThrow(
      /unique constraint/i,
    )
  })
})
