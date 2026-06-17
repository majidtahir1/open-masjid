import { describe, it, expect } from 'vitest'
import { weeklyDates, holidaySet, reconcileSessions } from '@/hooks/generateClassSessions'

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
  it('excludes holiday dates', () => {
    const dates = weeklyDates('2026-09-06', '2026-09-30', 'sunday', new Set(['2026-09-13', '2026-09-27']))
    expect(dates).toEqual(['2026-09-06', '2026-09-20'])
  })
})

describe('holidaySet', () => {
  it('normalizes term holidays (ISO datetimes) to a YYYY-MM-DD set', () => {
    const s = holidaySet([{ date: '2026-09-13T00:00:00.000Z' }, { date: '2026-12-27' }])
    expect(s.has('2026-09-13')).toBe(true)
    expect(s.has('2026-12-27')).toBe(true)
    expect(s.size).toBe(2)
  })
  it('handles null/empty', () => {
    expect(holidaySet(null).size).toBe(0)
    expect(holidaySet([{}]).size).toBe(0)
  })
})

describe('reconcileSessions', () => {
  it('creates missing dates, leaves matching ones alone', () => {
    const plan = reconcileSessions(
      ['2026-09-06', '2026-09-13'],
      [{ id: 1, date: '2026-09-06T00:00:00Z', hasAttendance: false }],
    )
    expect(plan.toCreate).toEqual(['2026-09-13'])
    expect(plan.toCancel).toEqual([])
    expect(plan.toDelete).toEqual([])
  })
  it('deletes an obsolete session with no attendance, cancels one that has attendance', () => {
    const plan = reconcileSessions(
      ['2026-09-06'],
      [
        { id: 1, date: '2026-09-06', hasAttendance: false },
        { id: 2, date: '2026-09-13', hasAttendance: false }, // now a holiday, no attendance → delete
        { id: 3, date: '2026-09-20', hasAttendance: true }, // now a holiday, has attendance → cancel
      ],
    )
    expect(plan.toCreate).toEqual([])
    expect(plan.toDelete).toEqual([2])
    expect(plan.toCancel).toEqual([3])
  })
})
