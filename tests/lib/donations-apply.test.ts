import { describe, it, expect } from 'vitest'
import { applyDonationAction } from '@/lib/donations-apply'
import type { Payload } from 'payload'

type Row = Record<string, any> & { id: string }

function makeMockPayload() {
  const tables: Record<string, Row[]> = { donations: [], tenants: [] }
  let nextId = 1

  const matches = (row: Row, where: any): boolean => {
    if (!where) return true
    return Object.entries(where).every(([key, cond]: [string, any]) => {
      const val = key.includes('.')
        ? key.split('.').reduce((acc, k) => acc?.[k], row)
        : row[key]
      if (cond && typeof cond === 'object' && 'equals' in cond) {
        return val === cond.equals
      }
      return false
    })
  }

  const payload = {
    async find({ collection, where }: any) {
      const rows = tables[collection] || []
      const docs = rows.filter((r) => matches(r, where))
      return { docs, totalDocs: docs.length }
    },
    async create({ collection, data }: any) {
      const id = `${collection}_${nextId++}`
      const row = { id, ...data }
      tables[collection] = tables[collection] || []
      tables[collection].push(row)
      return row
    },
    async update({ collection, id, data }: any) {
      const rows = tables[collection] || []
      const idx = rows.findIndex((r) => r.id === id)
      if (idx === -1) throw new Error('not found')
      // shallow merge with one-level deep merge for nested objects
      const existing = rows[idx]
      const merged = { ...existing }
      for (const [k, v] of Object.entries(data)) {
        if (
          v &&
          typeof v === 'object' &&
          !Array.isArray(v) &&
          existing[k] &&
          typeof existing[k] === 'object'
        ) {
          merged[k] = { ...existing[k], ...v }
        } else {
          merged[k] = v
        }
      }
      rows[idx] = merged
      return merged
    },
  }
  return { payload: payload as unknown as Payload, tables }
}

describe('applyDonationAction — recordDonation', () => {
  it('inserts a donation row', async () => {
    const { payload, tables } = makeMockPayload()
    await applyDonationAction(payload, {
      kind: 'recordDonation',
      tenantId: '1',
      fundId: '1',
      frequency: 'one_time',
      amountCents: 5000,
      currency: 'usd',
      status: 'succeeded',
      stripePaymentIntentId: 'pi_1',
      stripeAccountId: 'acct_1',
    })
    expect(tables.donations).toHaveLength(1)
    expect(tables.donations[0]).toMatchObject({
      tenant: 1,
      fund: 1,
      amount: 5000,
      currency: 'usd',
      frequency: 'one_time',
      status: 'succeeded',
      stripePaymentIntentId: 'pi_1',
      stripeAccountId: 'acct_1',
    })
  })

  it('is idempotent by stripePaymentIntentId — second call does not create a duplicate', async () => {
    const { payload, tables } = makeMockPayload()
    const action = {
      kind: 'recordDonation' as const,
      tenantId: '1',
      fundId: '1',
      frequency: 'one_time' as const,
      amountCents: 5000,
      currency: 'usd',
      status: 'succeeded' as const,
      stripePaymentIntentId: 'pi_dup',
      stripeAccountId: 'acct_1',
    }
    await applyDonationAction(payload, action)
    await applyDonationAction(payload, action)
    expect(tables.donations).toHaveLength(1)
  })
})

describe('applyDonationAction — refundDonation', () => {
  it('updates status to refunded when charge id matches', async () => {
    const { payload, tables } = makeMockPayload()
    tables.donations.push({
      id: 'd_1',
      stripeChargeId: 'ch_1',
      status: 'succeeded',
    })
    await applyDonationAction(payload, { kind: 'refundDonation', stripeChargeId: 'ch_1' })
    expect(tables.donations[0].status).toBe('refunded')
  })

  it('is a no-op when no donation matches the charge id', async () => {
    const { payload, tables } = makeMockPayload()
    tables.donations.push({ id: 'd_1', stripeChargeId: 'ch_other', status: 'succeeded' })
    await applyDonationAction(payload, { kind: 'refundDonation', stripeChargeId: 'ch_missing' })
    expect(tables.donations[0].status).toBe('succeeded')
  })
})

describe('applyDonationAction — syncAccount', () => {
  it('updates the tenant whose donationConfig.stripeAccountId matches', async () => {
    const { payload, tables } = makeMockPayload()
    tables.tenants.push({
      id: 'tn_1',
      donationConfig: { stripeAccountId: 'acct_1', stripeChargesEnabled: false, stripePayoutsEnabled: false },
    })
    await applyDonationAction(payload, {
      kind: 'syncAccount',
      stripeAccountId: 'acct_1',
      chargesEnabled: true,
      payoutsEnabled: true,
    })
    expect(tables.tenants[0].donationConfig.stripeChargesEnabled).toBe(true)
    expect(tables.tenants[0].donationConfig.stripePayoutsEnabled).toBe(true)
    expect(typeof tables.tenants[0].donationConfig.stripeAccountLastSyncedAt).toBe('string')
    // preserved
    expect(tables.tenants[0].donationConfig.stripeAccountId).toBe('acct_1')
  })

  it('is a no-op when no tenant matches', async () => {
    const { payload, tables } = makeMockPayload()
    tables.tenants.push({
      id: 'tn_1',
      donationConfig: { stripeAccountId: 'acct_other', stripeChargesEnabled: false, stripePayoutsEnabled: false },
    })
    await applyDonationAction(payload, {
      kind: 'syncAccount',
      stripeAccountId: 'acct_missing',
      chargesEnabled: true,
      payoutsEnabled: true,
    })
    expect(tables.tenants[0].donationConfig.stripeChargesEnabled).toBe(false)
    expect(tables.tenants[0].donationConfig.stripePayoutsEnabled).toBe(false)
  })
})
