import { describe, it, expect } from 'vitest'
import { signState, verifyState } from '@/lib/stripe-connect'

describe('connect state JWT', () => {
  it('round-trips tenantId + userId', () => {
    process.env.PAYLOAD_SECRET = 'test-secret-32-bytes-or-longer-please'
    const token = signState({ tenantId: 't1', userId: 'u1' })
    const decoded = verifyState(token)
    expect(decoded).toMatchObject({ tenantId: 't1', userId: 'u1' })
  })

  it('rejects forged tokens', () => {
    process.env.PAYLOAD_SECRET = 'test-secret-32-bytes-or-longer-please'
    expect(() => verifyState('bogus.value.here')).toThrow()
  })

  it('rejects expired tokens', () => {
    process.env.PAYLOAD_SECRET = 'test-secret-32-bytes-or-longer-please'
    const token = signState({ tenantId: 't1', userId: 'u1' }, { expiresInSec: -1 })
    expect(() => verifyState(token)).toThrow(/expired/i)
  })
})
