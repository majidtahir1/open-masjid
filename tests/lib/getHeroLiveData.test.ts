import { describe, expect, it } from 'vitest'

import {
  parseTimeToMinutes,
  pickNextIqamahFromDay,
} from '@/lib/getHeroLiveData'

describe('parseTimeToMinutes', () => {
  it('parses 12-hour with AM/PM', () => {
    expect(parseTimeToMinutes('5:45 AM', 'fajr')).toBe(5 * 60 + 45)
    expect(parseTimeToMinutes('1:30 PM', 'zuhr')).toBe(13 * 60 + 30)
  })
  it('treats bare Fajr as AM and others as PM', () => {
    expect(parseTimeToMinutes('5:45', 'fajr')).toBe(5 * 60 + 45)
    expect(parseTimeToMinutes('6:00', 'asr')).toBe(18 * 60)
  })
  it('handles 12 AM/PM correctly', () => {
    expect(parseTimeToMinutes('12:00 AM', 'fajr')).toBe(0)
    expect(parseTimeToMinutes('12:30 PM', 'zuhr')).toBe(12 * 60 + 30)
  })
  it('returns null for unparseable input', () => {
    expect(parseTimeToMinutes('nope', 'fajr')).toBeNull()
    expect(parseTimeToMinutes('', 'fajr')).toBeNull()
  })
})

describe('pickNextIqamahFromDay', () => {
  const day = {
    fajr: { iqamah: '5:45 AM' },
    zuhr: { iqamah: '1:30 PM' },
    asr: { iqamah: '6:00 PM' },
    maghrib: { iqamah: '8:15 PM' },
    isha: { iqamah: '9:45 PM' },
  }

  it('returns the next iqamah after current time', () => {
    const noon = new Date(2026, 4, 1, 12, 0, 0) // 12:00 PM
    const result = pickNextIqamahFromDay(day, noon)
    expect(result).not.toBeNull()
    expect(result?.name).toBe('Zuhr')
    expect(result?.atTime).toBe('1:30 pm')
    expect(result?.secondsUntil).toBe(90 * 60) // 90 minutes
  })

  it('skips passed iqamahs and picks the very next one', () => {
    const fivePm = new Date(2026, 4, 1, 17, 30, 0) // 5:30 PM
    const result = pickNextIqamahFromDay(day, fivePm)
    expect(result?.name).toBe('Asr')
    expect(result?.secondsUntil).toBe(30 * 60)
  })

  it('returns Isha exactly at boundary (>=)', () => {
    const exactly = new Date(2026, 4, 1, 21, 45, 0)
    const result = pickNextIqamahFromDay(day, exactly)
    expect(result?.name).toBe('Isha')
    expect(result?.secondsUntil).toBe(0)
  })

  it('returns null after Isha (caller must roll over to tomorrow Fajr)', () => {
    const lateNight = new Date(2026, 4, 1, 22, 30, 0) // 10:30 PM
    const result = pickNextIqamahFromDay(day, lateNight)
    expect(result).toBeNull()
  })

  it('returns null for empty day data', () => {
    expect(pickNextIqamahFromDay(null, new Date())).toBeNull()
    expect(pickNextIqamahFromDay({}, new Date())).toBeNull()
  })

  it('skips prayers without iqamah configured', () => {
    const partial = {
      fajr: { iqamah: null },
      zuhr: { iqamah: '1:30 PM' },
    }
    const morning = new Date(2026, 4, 1, 7, 0, 0) // 7 AM
    const result = pickNextIqamahFromDay(partial, morning)
    expect(result?.name).toBe('Zuhr')
  })
})
