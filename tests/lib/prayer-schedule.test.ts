import { beforeEach, describe, expect, it, vi } from 'vitest'

const findMock = vi.fn()

vi.mock('next/cache', () => ({ unstable_noStore: () => {} }))
vi.mock('@/lib/payloadClient', () => ({
  getPayloadClient: async () => ({ find: findMock }),
}))

import { findDayRow, getActiveSchedule } from '@/lib/prayer-schedule'

const julySchedule = {
  id: 1,
  name: 'July',
  startDate: '2026-07-01T00:00:00.000Z',
  endDate: '2026-07-31T00:00:00.000Z',
  days: [
    { date: '2026-07-30T00:00:00.000Z', fajr: { adhan: '5:00 AM', iqamah: '5:30 AM' } },
    { date: '2026-07-31T00:00:00.000Z', fajr: { adhan: '5:01 AM', iqamah: '5:30 AM' } },
  ],
}

beforeEach(() => {
  findMock.mockReset()
  findMock.mockResolvedValue({ docs: [julySchedule] })
})

describe('getActiveSchedule', () => {
  it('still matches the schedule on its last day, late in the tenant-local evening', async () => {
    // 6:48 PM CDT July 31 — endDate (midnight UTC July 31) is already "past"
    // as an instant, but July 31 is still inside the schedule's date range.
    await getActiveSchedule(1, new Date('2026-07-31T23:48:00Z'), 'America/Chicago')

    const where = findMock.mock.calls[0][0].where
    expect(where.startDate.less_than_equal).toBe('2026-07-31T00:00:00.000Z')
    expect(where.endDate.greater_than_equal).toBe('2026-07-31T00:00:00.000Z')
  })

  it('uses the tenant-local date after UTC rolls over to the next day', async () => {
    // 7:30 PM CDT July 31 = 00:30 UTC Aug 1. Tenant-local day is still July 31,
    // so the July schedule must match — not August's.
    await getActiveSchedule(1, new Date('2026-08-01T00:30:00Z'), 'America/Chicago')

    const where = findMock.mock.calls[0][0].where
    expect(where.startDate.less_than_equal).toBe('2026-07-31T00:00:00.000Z')
    expect(where.endDate.greater_than_equal).toBe('2026-07-31T00:00:00.000Z')
  })
})

describe('findDayRow', () => {
  it('matches the row for the tenant-local calendar date', () => {
    // 7:30 PM CDT July 31 = 00:30 UTC Aug 1 — must still pick the July 31 row.
    const row = findDayRow(
      julySchedule,
      new Date('2026-08-01T00:30:00Z'),
      'America/Chicago',
    )
    expect(row?.date).toBe('2026-07-31T00:00:00.000Z')
  })
})
