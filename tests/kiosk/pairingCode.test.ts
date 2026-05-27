import { describe, it, expect } from 'vitest'
import { generatePairingCode, normalizePairingCode, isValidPairingCode } from '@/lib/kiosk/pairingCode'

describe('pairingCode', () => {
  it('generates a code matching XXX-XXX format with allowed chars', () => {
    for (let i = 0; i < 50; i++) {
      const code = generatePairingCode()
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/)
    }
  })

  it('normalizes lowercase, missing hyphen, surrounding whitespace', () => {
    expect(normalizePairingCode(' k7m3pq ')).toBe('K7M-3PQ')
    expect(normalizePairingCode('k7m-3pq')).toBe('K7M-3PQ')
    expect(normalizePairingCode('K7M3PQ')).toBe('K7M-3PQ')
  })

  it('rejects ambiguous chars (0, O, 1, I, L)', () => {
    expect(isValidPairingCode('O0O-1IL')).toBe(false)
  })

  it('accepts valid code', () => {
    expect(isValidPairingCode('K7M-3PQ')).toBe(true)
  })
})
