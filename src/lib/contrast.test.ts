import { describe, it, expect } from 'vitest'
import { contrastRatio } from './contrast'

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
  })

  it('returns 1 for identical colors', () => {
    expect(contrastRatio('#0F1E4A', '#0F1E4A')).toBeCloseTo(1, 5)
  })

  it('is symmetric', () => {
    const a = contrastRatio('#28A0B4', '#ffffff')
    const b = contrastRatio('#ffffff', '#28A0B4')
    expect(a).toBeCloseTo(b, 6)
  })

  it('handles 3-digit hex and missing leading #', () => {
    expect(contrastRatio('fff', '000')).toBeCloseTo(21, 1)
  })

  it('computes a known navy/white ratio above 12', () => {
    // #0F1E4A on white is roughly 14.6:1
    const r = contrastRatio('#0F1E4A', '#ffffff')
    expect(r).toBeGreaterThan(12)
    expect(r).toBeLessThan(17)
  })
})
