import { describe, it, expect } from 'vitest'
import { normalizePhone } from '@/lib/phone'

describe('normalizePhone', () => {
  it('strips non-digits and keeps the last 10 digits', () => {
    expect(normalizePhone('(999) 000-0000')).toBe('9990000000')
    expect(normalizePhone('+1 999 000 0000')).toBe('9990000000')
  })
  it('returns digits as-is when 10 or fewer', () => {
    expect(normalizePhone('555-1234')).toBe('5551234')
  })
  it('tolerates null/undefined', () => {
    expect(normalizePhone(null)).toBe('')
    expect(normalizePhone(undefined)).toBe('')
  })
})
