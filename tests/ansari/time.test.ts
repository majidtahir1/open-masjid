// tests/ansari/time.test.ts
import { describe, expect, it } from 'vitest'
import {
  addDays,
  endOfNextMonthISO,
  hijriParts,
  isoWeekKey,
  localDateISO,
  localParts,
  tzOffsetMinutes,
} from '@/ansari/time'

const CHI = 'America/Chicago'

describe('localParts / localDateISO', () => {
  it('converts a UTC instant to tenant-local parts', () => {
    // 2026-06-11T03:00Z = 2026-06-10 22:00 in Chicago (CDT, UTC-5)
    const p = localParts(new Date('2026-06-11T03:00:00Z'), CHI)
    expect(p).toMatchObject({ year: 2026, month: 6, day: 10, hour: 22, minute: 0, weekday: 3 })
    expect(localDateISO(new Date('2026-06-11T03:00:00Z'), CHI)).toBe('2026-06-10')
  })
})

describe('tzOffsetMinutes', () => {
  it('returns -300 for Chicago in summer (CDT) and -360 in winter (CST)', () => {
    expect(tzOffsetMinutes(new Date('2026-06-15T12:00:00Z'), CHI)).toBe(-300)
    expect(tzOffsetMinutes(new Date('2026-01-15T12:00:00Z'), CHI)).toBe(-360)
  })
})

describe('hijriParts', () => {
  it('maps a Gregorian date into the islamic-umalqura calendar', () => {
    const h = hijriParts(new Date('2026-06-11T12:00:00Z'), CHI)
    expect(h.year).toBeGreaterThanOrEqual(1447)
    expect(h.month).toBeGreaterThanOrEqual(1)
    expect(h.month).toBeLessThanOrEqual(12)
    expect(h.day).toBeGreaterThanOrEqual(1)
    expect(h.day).toBeLessThanOrEqual(30)
  })

  it('finds 1 Ramadan 1447 in February 2026', () => {
    // Umm al-Qura: Ramadan 1447 begins ~17-18 Feb 2026; scan a window and expect exactly one "day 1"
    let firsts = 0
    for (let i = 0; i < 35; i++) {
      const h = hijriParts(addDays(new Date('2026-02-01T12:00:00Z'), i), CHI)
      if (h.month === 9 && h.day === 1) firsts++
    }
    expect(firsts).toBe(1)
  })
})

describe('isoWeekKey', () => {
  it('is stable within a week and rolls over on Monday (ISO)', () => {
    // 2026-06-11 is a Thursday → ISO week 24
    expect(isoWeekKey(new Date('2026-06-11T12:00:00Z'), CHI)).toBe('2026-W24')
    expect(isoWeekKey(new Date('2026-06-14T12:00:00Z'), CHI)).toBe('2026-W24') // Sunday, same ISO week
    expect(isoWeekKey(new Date('2026-06-15T12:00:00Z'), CHI)).toBe('2026-W25') // Monday
  })
})

describe('addDays / endOfNextMonthISO', () => {
  it('addDays adds exact 24h multiples', () => {
    expect(addDays(new Date('2026-06-11T00:00:00Z'), 3).toISOString()).toBe('2026-06-14T00:00:00.000Z')
  })
  it('endOfNextMonthISO returns the last day of the following local month', () => {
    expect(endOfNextMonthISO(new Date('2026-06-15T12:00:00Z'), CHI)).toBe('2026-07-31')
    expect(endOfNextMonthISO(new Date('2026-12-15T12:00:00Z'), CHI)).toBe('2027-01-31')
  })
})
