import { describe, it, expect } from 'vitest'
import { weeklyDates } from '@/hooks/generateClassSessions'

describe('weeklyDates', () => {
  it('returns each Sunday between start and end inclusive', () => {
    // 2026-09-06 is a Sunday; 2026-09-27 is a Sunday.
    const dates = weeklyDates('2026-09-06', '2026-09-30', 'sunday')
    expect(dates).toEqual(['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27'])
  })
  it('skips to the first matching weekday when start is mid-week', () => {
    // 2026-09-01 is a Tuesday; first Sunday is 2026-09-06.
    const dates = weeklyDates('2026-09-01', '2026-09-14', 'sunday')
    expect(dates).toEqual(['2026-09-06', '2026-09-13'])
  })
  it('returns empty when range contains no matching weekday', () => {
    expect(weeklyDates('2026-09-07', '2026-09-11', 'sunday')).toEqual([])
  })
})
