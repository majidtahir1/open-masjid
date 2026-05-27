import { describe, it, expect } from 'vitest'
import { filterAndSortSlides, type NormalizedSlide } from '@/lib/kiosk/composeState'

const base = (
  overrides: Partial<{
    id: string
    active: boolean
    priority: number
    startDate: string | null
    endDate: string | null
    updatedAt: string
  }>,
): NormalizedSlide => ({
  id: overrides.id ?? '1',
  type: 'carousel',
  active: overrides.active ?? true,
  priority: overrides.priority ?? 5,
  startDate: overrides.startDate ?? null,
  endDate: overrides.endDate ?? null,
  updatedAt: overrides.updatedAt ?? '2026-05-14T00:00:00Z',
  durationMs: 10000,
  payload: {},
})

describe('filterAndSortSlides', () => {
  const NOW = new Date('2026-05-14T12:00:00Z')

  it('excludes inactive slides', () => {
    const slides = [base({ id: '1', active: false }), base({ id: '2', active: true })]
    expect(filterAndSortSlides(slides, NOW, null).map((s) => s.id)).toEqual(['2'])
  })

  it('excludes slides outside date range', () => {
    const slides = [
      base({ id: '1', endDate: '2026-05-13T00:00:00Z' }),
      base({ id: '2', startDate: '2026-06-01T00:00:00Z' }),
      base({ id: '3' }),
    ]
    expect(filterAndSortSlides(slides, NOW, null).map((s) => s.id)).toEqual(['3'])
  })

  it('sorts by priority descending then updatedAt ascending', () => {
    const slides = [
      base({ id: 'a', priority: 3, updatedAt: '2026-05-14T01:00:00Z' }),
      base({ id: 'b', priority: 5, updatedAt: '2026-05-14T02:00:00Z' }),
      base({ id: 'c', priority: 5, updatedAt: '2026-05-14T01:00:00Z' }),
    ]
    expect(filterAndSortSlides(slides, NOW, null).map((s) => s.id)).toEqual(['c', 'b', 'a'])
  })

  it('intersects with overrides when provided', () => {
    const slides = [base({ id: '1' }), base({ id: '2' }), base({ id: '3' })]
    expect(
      filterAndSortSlides(slides, NOW, ['2', '3'])
        .map((s) => s.id)
        .sort(),
    ).toEqual(['2', '3'])
  })
})
