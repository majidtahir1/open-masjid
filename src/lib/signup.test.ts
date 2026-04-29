import { describe, it, expect, beforeEach } from 'vitest'
import {
  RESERVED_SLUGS,
  validateSlug,
  validateEmail,
  suggestAlternativeSlugs,
  checkIpThrottle,
  _resetIpThrottleForTests,
} from './signup'

describe('validateSlug', () => {
  it('accepts canonical slugs', () => {
    expect(validateSlug('alnoor')).toBeNull()
    expect(validateSlug('icp')).toBeNull()
    expect(validateSlug('masjid-al-noor')).toBeNull()
    expect(validateSlug('a1b2c3')).toBeNull()
  })

  it('rejects too-short, too-long, or malformed slugs', () => {
    expect(validateSlug('a')).toBe('format')
    expect(validateSlug('ab')).toBe('format')
    expect(validateSlug('UPPER')).toBe('format')
    expect(validateSlug('-leading')).toBe('format')
    expect(validateSlug('trailing-')).toBe('format')
    expect(validateSlug('has spaces')).toBe('format')
    expect(validateSlug('has_underscore')).toBe('format')
    expect(validateSlug('a'.repeat(33))).toBe('format')
  })

  it('rejects reserved slugs', () => {
    for (const reserved of RESERVED_SLUGS) {
      expect(validateSlug(reserved)).toBe('reserved')
    }
  })
})

describe('validateEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(validateEmail('a@b.co')).toBe(true)
    expect(validateEmail('first.last+tag@example.org')).toBe(true)
  })
  it('rejects malformed addresses', () => {
    expect(validateEmail('no-at-sign')).toBe(false)
    expect(validateEmail('no@dot')).toBe(false)
    expect(validateEmail('a b@c.de')).toBe(false)
    expect(validateEmail('')).toBe(false)
  })
})

describe('suggestAlternativeSlugs', () => {
  it('returns 3 candidates derived from the base', () => {
    const out = suggestAlternativeSlugs('alnoor')
    expect(out).toHaveLength(3)
    expect(out[0]).toBe('alnoor-masjid')
    expect(out[1]).toBe('alnoor-2')
    expect(out[2]).toMatch(/^alnoor-[a-z0-9]{4}$/)
  })

  it('falls back when base is empty', () => {
    const out = suggestAlternativeSlugs('')
    expect(out[0]).toBe('masjid-masjid')
  })

  it('caps each suggestion at 32 chars', () => {
    const out = suggestAlternativeSlugs('a'.repeat(40))
    out.forEach((s) => expect(s.length).toBeLessThanOrEqual(32))
  })
})

describe('checkIpThrottle', () => {
  beforeEach(() => _resetIpThrottleForTests())

  it('allows 5 in an hour, blocks the 6th', () => {
    const ip = '1.2.3.4'
    const t = 1_000_000_000_000
    for (let i = 0; i < 5; i++) {
      expect(checkIpThrottle(ip, t + i * 1000).ok).toBe(true)
    }
    const blocked = checkIpThrottle(ip, t + 5000)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('frees up the slot after the window expires', () => {
    const ip = '5.6.7.8'
    const t = 2_000_000_000_000
    for (let i = 0; i < 5; i++) checkIpThrottle(ip, t + i * 1000)
    expect(checkIpThrottle(ip, t + 5000).ok).toBe(false)
    // Past the 1-hour window of the oldest hit
    expect(checkIpThrottle(ip, t + 60 * 60 * 1000 + 1).ok).toBe(true)
  })

  it('tracks IPs independently', () => {
    const t = 3_000_000_000_000
    for (let i = 0; i < 5; i++) checkIpThrottle('a', t + i)
    expect(checkIpThrottle('a', t + 5).ok).toBe(false)
    expect(checkIpThrottle('b', t + 5).ok).toBe(true)
  })
})
