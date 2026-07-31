import { describe, expect, it } from 'vitest'
import { localDateKey, localDayFloorISO } from '@/lib/local-date'

describe('localDateKey', () => {
  it('returns the calendar date in the given timezone', () => {
    // 6:48 PM CDT on July 31 = 23:48 UTC July 31
    expect(localDateKey(new Date('2026-07-31T23:48:00Z'), 'America/Chicago')).toBe(
      '2026-07-31',
    )
  })

  it('stays on the local date after UTC rolls over to the next day', () => {
    // 7:30 PM CDT on July 31 = 00:30 UTC August 1
    expect(localDateKey(new Date('2026-08-01T00:30:00Z'), 'America/Chicago')).toBe(
      '2026-07-31',
    )
  })

  it('handles timezones ahead of UTC', () => {
    // 1:00 AM AEST August 1 = 15:00 UTC July 31
    expect(localDateKey(new Date('2026-07-31T15:00:00Z'), 'Australia/Sydney')).toBe(
      '2026-08-01',
    )
  })

  it('falls back to UTC when no timezone is given', () => {
    expect(localDateKey(new Date('2026-07-31T23:48:00Z'))).toBe('2026-07-31')
  })
})

describe('localDayFloorISO', () => {
  it('returns UTC midnight of the local calendar date', () => {
    expect(localDayFloorISO(new Date('2026-08-01T00:30:00Z'), 'America/Chicago')).toBe(
      '2026-07-31T00:00:00.000Z',
    )
  })
})
