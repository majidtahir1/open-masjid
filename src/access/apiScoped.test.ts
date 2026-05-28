import { describe, expect, it } from 'vitest'
import type { PayloadRequest } from 'payload'

import { isApiKeyAuth } from './apiScoped'

const reqWith = (user: Record<string, unknown> | null): PayloadRequest =>
  ({ user } as unknown as PayloadRequest)

describe('isApiKeyAuth', () => {
  it('returns false when there is no user', () => {
    expect(isApiKeyAuth(reqWith(null))).toBe(false)
  })

  it('returns false for session-authenticated users', () => {
    expect(isApiKeyAuth(reqWith({ id: 1, _strategy: 'local-jwt' }))).toBe(false)
  })

  it('returns true for api-key-authenticated users', () => {
    expect(isApiKeyAuth(reqWith({ id: 1, _strategy: 'api-key' }))).toBe(true)
  })

  it('returns false when _strategy is missing', () => {
    expect(isApiKeyAuth(reqWith({ id: 1 }))).toBe(false)
  })
})
