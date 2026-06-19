import { describe, it, expect } from 'vitest'
import {
  attendanceTrend, rateByClass, statusBreakdown, enrollmentByClass, dashboardKpis, canHardDelete,
} from '@/lib/school-reports'

const sessions = [
  { id: 1, class: 10, date: '2026-09-06' },
  { id: 2, class: 10, date: '2026-09-13' },
  { id: 3, class: 11, date: '2026-09-06' },
]
const records = [
  { session: 1, status: 'present' }, { session: 1, status: 'absent' },
  { session: 2, status: 'present' }, { session: 2, status: 'present' }, { session: 2, status: 'late' },
  { session: 3, status: 'present' },
]
const classes = [{ id: 10, name: 'Grade 3' }, { id: 11, name: 'Grade 4' }]
const enrollments = [
  { class: 10, status: 'active' }, { class: 10, status: 'active' }, { class: 10, status: 'withdrawn' },
  { class: 11, status: 'active' },
]

describe('attendanceTrend', () => {
  it('present rate per held session, ordered by date', () => {
    const t = attendanceTrend(sessions, records)
    expect(t).toEqual([
      { date: '2026-09-06', present: 2, marked: 3, presentRate: 2 / 3 },
      { date: '2026-09-13', present: 2, marked: 3, presentRate: 2 / 3 },
    ])
  })
  it('ignores sessions with no records', () => {
    expect(attendanceTrend([{ id: 9, class: 10, date: '2026-10-01' }], [])).toEqual([])
  })
})

describe('rateByClass', () => {
  it('present / marked across each class', () => {
    const r = rateByClass(classes, sessions, records)
    expect(r).toEqual([
      { classId: 10, name: 'Grade 3', rate: 3 / 5, marked: 5 },
      { classId: 11, name: 'Grade 4', rate: 1, marked: 1 },
    ])
  })
  it('rate 0 and marked 0 for a class with no records', () => {
    expect(rateByClass([{ id: 99, name: 'Empty' }], [], [])).toEqual([{ classId: 99, name: 'Empty', rate: 0, marked: 0 }])
  })
})

describe('statusBreakdown', () => {
  it('counts each status', () => {
    expect(statusBreakdown(records)).toEqual({ present: 4, absent: 1, late: 1, excused: 0 })
  })
})

describe('enrollmentByClass', () => {
  it('counts active enrollments per class', () => {
    expect(enrollmentByClass(classes, enrollments)).toEqual([
      { classId: 10, name: 'Grade 3', count: 2 },
      { classId: 11, name: 'Grade 4', count: 1 },
    ])
  })
})

describe('dashboardKpis', () => {
  it('aggregates headline numbers', () => {
    const k = dashboardKpis({ students: [{ id: 1 }, { id: 2 }], classes, sessions, records, today: '2026-09-10' })
    expect(k.students).toBe(2)
    expect(k.activeClasses).toBe(2)
    expect(k.avgAttendanceRate).toBeCloseTo(4 / 6)
    expect(k.sessionsHeld).toBe(3)
    expect(k.sessionsUpcoming).toBe(0)
  })
})

describe('canHardDelete', () => {
  it('true only when no history', () => {
    expect(canHardDelete({ sessionCount: 0, attendanceCount: 0, enrollmentCount: 0 })).toBe(true)
    expect(canHardDelete({ sessionCount: 5, attendanceCount: 0, enrollmentCount: 0 })).toBe(false)
    expect(canHardDelete({ sessionCount: 0, attendanceCount: 0, enrollmentCount: 1 })).toBe(false)
  })
})
