import { describe, it, expect } from 'vitest'
import { shouldSendForTenant } from '@/lib/form-notifications'

describe('demo email gate', () => {
  it('suppresses email for a demo tenant', () => {
    expect(shouldSendForTenant({ demoMode: true })).toBe(false)
  })
  it('allows email for a normal tenant', () => {
    expect(shouldSendForTenant({ demoMode: false })).toBe(true)
  })
  it('allows email when tenant is missing', () => {
    expect(shouldSendForTenant(null)).toBe(true)
    expect(shouldSendForTenant(undefined)).toBe(true)
  })
})
