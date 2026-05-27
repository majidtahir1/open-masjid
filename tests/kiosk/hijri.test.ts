import { describe, it, expect } from 'vitest'
import { formatHijri } from '@/lib/hijri'

describe('formatHijri', () => {
  it('returns a non-empty string containing a 4-digit hijri year', () => {
    const out = formatHijri(new Date(2026, 4, 26), 'America/Chicago')
    expect(typeof out).toBe('string')
    expect(out).toMatch(/1\d{3}/) // hijri year ~14xx
  })
  it('does not throw on a bad timezone (falls back to UTC)', () => {
    expect(() => formatHijri(new Date(2026, 4, 26), 'Not/AZone')).not.toThrow()
  })
})
