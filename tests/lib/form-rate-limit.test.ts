import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit, _resetForTest } from '@/lib/form-rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => _resetForTest())
  it('allows up to 5 hits per minute then blocks', () => {
    const key = 'ip:abc'
    for (let i = 0; i < 5; i++) expect(checkRateLimit(key)).toBe(true)
    expect(checkRateLimit(key)).toBe(false)
  })
  it('refills after a minute', () => {
    const key = 'ip:abc'
    for (let i = 0; i < 5; i++) checkRateLimit(key)
    _resetForTest()
    expect(checkRateLimit(key)).toBe(true)
  })
})
