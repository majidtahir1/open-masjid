import { describe, it, expect } from 'vitest'
import {
  parseTimeToMinutes,
  buildTimetable,
  buildDaybreak,
  formatClock,
  ISHRAQ_OFFSET_MIN,
  type DayData,
} from '@/lib/kiosk/prayerTimetable'

const day: DayData = {
  sunrise: '6:14 AM',
  fajr: { adhan: '5:01 AM', iqamah: '5:45 AM' },
  zuhr: { adhan: '1:25 PM', iqamah: '2:00 PM' },
  asr: { adhan: '5:08 PM', iqamah: '6:20 PM' },
  maghrib: { adhan: '8:28 PM', iqamah: '8:33 PM' },
  isha: { adhan: '9:48 PM', iqamah: '10:00 PM' },
}

describe('parseTimeToMinutes', () => {
  it('parses 12h am/pm', () => {
    expect(parseTimeToMinutes('5:45 AM')).toBe(5 * 60 + 45)
    expect(parseTimeToMinutes('2:00 PM')).toBe(14 * 60)
    expect(parseTimeToMinutes('12:00 AM')).toBe(0)
    expect(parseTimeToMinutes('12:30 PM')).toBe(12 * 60 + 30)
  })
  it('returns null for junk', () => {
    expect(parseTimeToMinutes('')).toBeNull()
    expect(parseTimeToMinutes(undefined)).toBeNull()
  })
})

describe('buildTimetable', () => {
  it('produces 5 columns in order with the next-prayer key', () => {
    const t = buildTimetable({ day, now: new Date(2026, 4, 26, 14, 30), isFriday: false, jummahTimes: [] })
    expect(t.entries.map((e) => e.key)).toEqual(['fajr', 'zuhr', 'asr', 'maghrib', 'isha'])
    expect(t.nextKey).toBe('asr') // 2:30pm → next adhan is Asr 5:08pm
  })
  it('rolls next to fajr after isha', () => {
    const t = buildTimetable({ day, now: new Date(2026, 4, 26, 23, 0), isFriday: false, jummahTimes: [] })
    expect(t.nextKey).toBe('fajr')
  })
  it('substitutes the first jummah time into the zuhr iqamah on Friday', () => {
    const t = buildTimetable({ day, now: new Date(2026, 4, 29, 11, 0), isFriday: true, jummahTimes: ['1:30 PM'] })
    const zuhr = t.entries.find((e) => e.key === 'zuhr')!
    expect(zuhr.iqamah).toBe('1:30 PM')
  })
  it('attaches the daybreak inset when sunrise is present', () => {
    const t = buildTimetable({ day, now: new Date(2026, 4, 26, 14, 30), isFriday: false, jummahTimes: [] })
    expect(t.daybreak?.map((r) => r.en)).toEqual(['Sunrise', 'Ishrāq'])
  })
})

describe('formatClock', () => {
  it('renders 12h clock with a lowercase meridiem', () => {
    expect(formatClock(6 * 60 + 14)).toEqual({ hm: '6:14', ampm: 'am' })
    expect(formatClock(0)).toEqual({ hm: '12:00', ampm: 'am' })
    expect(formatClock(12 * 60)).toEqual({ hm: '12:00', ampm: 'pm' })
    expect(formatClock(13 * 60 + 5)).toEqual({ hm: '1:05', ampm: 'pm' })
  })
})

describe('buildDaybreak', () => {
  it('derives ishrāq as sunrise + the configured offset', () => {
    const rows = buildDaybreak(day)!
    expect(rows[0]).toEqual({ en: 'Sunrise', time: { hm: '6:14', ampm: 'am' } })
    const expected = formatClock(6 * 60 + 14 + ISHRAQ_OFFSET_MIN)
    expect(rows[1]).toEqual({ en: 'Ishrāq', time: expected })
  })
  it('returns null when sunrise is missing or unparseable', () => {
    expect(buildDaybreak({ ...day, sunrise: undefined })).toBeNull()
    expect(buildDaybreak({ ...day, sunrise: 'n/a' })).toBeNull()
  })
})
