import { describe, it, expect } from 'vitest'
import { isDemoTenant } from '@/lib/demo/guard'

describe('isDemoTenant', () => {
  it('returns true for a demo tenant', () => {
    expect(isDemoTenant({ demoMode: true })).toBe(true)
  })
  it('returns false for a normal tenant', () => {
    expect(isDemoTenant({ demoMode: false })).toBe(false)
  })
  it('returns false when demoMode is null/undefined', () => {
    expect(isDemoTenant({ demoMode: null })).toBe(false)
    expect(isDemoTenant({})).toBe(false)
  })
  it('returns false when tenant is missing', () => {
    expect(isDemoTenant(null)).toBe(false)
    expect(isDemoTenant(undefined)).toBe(false)
  })
})
