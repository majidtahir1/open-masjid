import { describe, it, expect } from 'vitest'
import { formatMembersCsv } from '@/lib/members-export'

describe('formatMembersCsv', () => {
  it('emits BOM + header row + escaped fields', () => {
    const csv = formatMembersCsv([
      {
        name: 'A, "B"',
        email: 'a@b.com',
        phone: null,
        tierName: 'Supporting',
        status: 'active',
        stripeSubscriptionStatus: 'active',
        joinedAt: '2026-01-01',
        currentPeriodEnd: '2026-02-01',
        canceledAt: null,
        stripeCustomerId: 'cus_x',
        stripeSubscriptionId: 'sub_x',
      },
    ])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('name,email,phone,tier,status')
    expect(csv).toContain('"A, ""B"""')
  })

  it('renders all 11 columns in header', () => {
    const csv = formatMembersCsv([])
    const header = csv.split('\n')[1] // skip BOM line? No — BOM is prefix, first line is header
    const firstLine = csv.replace('﻿', '').split('\n')[0]
    expect(firstLine).toBe(
      'name,email,phone,tier,status,stripeSubscriptionStatus,joinedAt,currentPeriodEnd,canceledAt,stripeCustomerId,stripeSubscriptionId',
    )
  })

  it('maps null/undefined fields to empty strings', () => {
    const csv = formatMembersCsv([
      {
        name: 'Jane',
        email: 'jane@test.com',
        phone: null,
        tierName: null,
        status: 'inactive',
        stripeSubscriptionStatus: null,
        joinedAt: null,
        currentPeriodEnd: null,
        canceledAt: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      },
    ])
    const lines = csv.replace('﻿', '').split('\n').filter(Boolean)
    const dataRow = lines[1]
    // name, email, phone(empty), tier(empty), status, stripeSubscriptionStatus(empty),
    // joinedAt(empty), currentPeriodEnd(empty), canceledAt(empty),
    // stripeCustomerId(empty), stripeSubscriptionId(empty)
    expect(dataRow).toBe('Jane,jane@test.com,,,inactive,,,,,,')
  })

  it('escapes values containing commas, quotes, and newlines', () => {
    const csv = formatMembersCsv([
      {
        name: 'Smith, John',
        email: 'smith@example.com',
        phone: '555\n1234',
        tierName: 'Gold "Premium"',
        status: 'active',
        stripeSubscriptionStatus: 'active',
        joinedAt: '2026-01-15T00:00:00.000Z',
        currentPeriodEnd: '2026-02-15T00:00:00.000Z',
        canceledAt: null,
        stripeCustomerId: 'cus_abc',
        stripeSubscriptionId: 'sub_abc',
      },
    ])
    expect(csv).toContain('"Smith, John"')
    expect(csv).toContain('"555\n1234"')
    expect(csv).toContain('"Gold ""Premium"""')
  })
})
