import { describe, it, expect } from 'vitest'
import {
  buildFreeMemberData,
  validateFreeSignup,
} from '@/lib/membership-signup'

const freeTier = { id: 1, active: true, amountCents: 0 }
const paidTier = { id: 2, active: true, amountCents: 2500 }
const inactiveTier = { id: 3, active: false, amountCents: 0 }

describe('validateFreeSignup', () => {
  it('returns trimmed/lowercased values on valid input', () => {
    const out = validateFreeSignup(
      { name: '  Asha Rahman  ', email: '  ASHA@Example.com ', phone: ' 555-0100 ' },
      freeTier,
    )
    expect(out).toEqual({ name: 'Asha Rahman', email: 'asha@example.com', phone: '555-0100' })
  })

  it('treats blank phone as null', () => {
    const out = validateFreeSignup({ name: 'A', email: 'a@b.co', phone: '   ' }, freeTier)
    expect(out.phone).toBeNull()
  })

  it('throws when tier is paid', () => {
    expect(() =>
      validateFreeSignup({ name: 'A', email: 'a@b.co' }, paidTier),
    ).toThrow(/not free/)
  })

  it('throws when tier is inactive', () => {
    expect(() =>
      validateFreeSignup({ name: 'A', email: 'a@b.co' }, inactiveTier),
    ).toThrow(/not active/)
  })

  it('throws on missing name', () => {
    expect(() =>
      validateFreeSignup({ name: '   ', email: 'a@b.co' }, freeTier),
    ).toThrow(/Name is required/)
  })

  it('throws on invalid email', () => {
    expect(() =>
      validateFreeSignup({ name: 'A', email: 'not-an-email' }, freeTier),
    ).toThrow(/email/i)
  })
})

describe('buildFreeMemberData', () => {
  it('uses now() for new members', () => {
    const before = Date.now()
    const data = buildFreeMemberData(7, 1, { name: 'A', email: 'a@b.co', phone: null }, null)
    const after = Date.now()
    expect(data.tenant).toBe(7)
    expect(data.tier).toBe(1)
    expect(data.email).toBe('a@b.co')
    expect(data.name).toBe('A')
    expect(data.phone).toBeNull()
    expect(data.status).toBe('active')
    const ts = Date.parse(data.joinedAt)
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('preserves an existing joinedAt on re-signup', () => {
    const data = buildFreeMemberData(
      7,
      1,
      { name: 'A', email: 'a@b.co', phone: null },
      '2025-01-01T00:00:00.000Z',
    )
    expect(data.joinedAt).toBe('2025-01-01T00:00:00.000Z')
  })
})
