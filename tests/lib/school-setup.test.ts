import { describe, it, expect } from 'vitest'
import { firstIncompleteStep, buildHubSummary, unplacedForProgram } from '@/lib/school-setup'

describe('firstIncompleteStep', () => {
  it('no active term → step 1', () => {
    expect(firstIncompleteStep({ term: null, classCount: 0, teacherlessCount: 0, placedCount: 0, unplacedCount: 0 })).toBe(1)
  })
  it('term but no classes → step 2', () => {
    expect(firstIncompleteStep({ term: { id: 1 }, classCount: 0, teacherlessCount: 0, placedCount: 0, unplacedCount: 0 } as any)).toBe(2)
  })
  it('classes but unplaced students remain → step 4', () => {
    expect(firstIncompleteStep({ term: { id: 1 }, classCount: 2, teacherlessCount: 0, placedCount: 1, unplacedCount: 3 } as any)).toBe(4)
  })
  it('classes and nothing unplaced → done (5)', () => {
    expect(firstIncompleteStep({ term: { id: 1 }, classCount: 2, teacherlessCount: 1, placedCount: 4, unplacedCount: 0 } as any)).toBe(5)
  })
  it('never auto-lands on the skippable Teachers step (3)', () => {
    for (const unplaced of [0, 2]) {
      expect(firstIncompleteStep({ term: { id: 1 }, classCount: 1, teacherlessCount: 1, placedCount: 0, unplacedCount: unplaced } as any)).not.toBe(3)
    }
  })
})

describe('buildHubSummary', () => {
  it('counts classes, teacherless classes, placed and unplaced students', () => {
    const term = { id: 1, name: 'Fall 2026', startDate: '2026-09-06', endDate: '2026-11-29', meetingDays: ['sunday'] }
    const classes = [
      { id: 11, teachers: [{ id: 9 }] },
      { id: 12, teachers: [] },
      { id: 13 },
    ]
    const enrollments = [
      { student: 201, status: 'active' },
      { student: { id: 202 }, status: 'active' },
      { student: 203, status: 'withdrawn' },
    ]
    const students = [{ id: 201 }, { id: 202 }, { id: 203 }, { id: 204 }]
    const summary = buildHubSummary({ term, classes, enrollments, students, sessionsPerClass: 12 })
    expect(summary.classCount).toBe(3)
    expect(summary.teacherlessCount).toBe(2)
    expect(summary.placedCount).toBe(2)
    expect(summary.unplacedCount).toBe(2)
    expect(summary.term?.name).toBe('Fall 2026')
    expect(summary.term?.sessionsPerClass).toBe(12)
  })
  it('null term yields zero counts', () => {
    const s = buildHubSummary({ term: null, classes: [], enrollments: [], students: [], sessionsPerClass: 0 })
    expect(s).toEqual({ term: null, classCount: 0, teacherlessCount: 0, placedCount: 0, unplacedCount: 0 })
  })
})

import { formatDays } from '@/lib/school-setup'

describe('unplacedForProgram', () => {
  const students = [
    { id: 1, registeredProgram: 10 },
    { id: 2, registeredProgram: 10 },
    { id: 3, registeredProgram: 20 },
    { id: 4, registeredProgram: null },
  ]
  const enrollments = [{ student: 1, status: 'active' }]
  it('returns this program\'s registrants who are not placed', () => {
    expect(unplacedForProgram(students, enrollments, 10).map((s) => s.id)).toEqual([2])
  })
  it('ignores other programs and placed students', () => {
    expect(unplacedForProgram(students, [], 20).map((s) => s.id)).toEqual([3])
  })
  it('handles populated relationship objects', () => {
    const s = [{ id: 5, registeredProgram: { id: 10 } }]
    expect(unplacedForProgram(s as any, [], 10).map((x) => x.id)).toEqual([5])
  })
})

describe('formatDays', () => {
  it('one day → plural', () => { expect(formatDays(['sunday'])).toBe('Sundays') })
  it('weekend pair', () => { expect(formatDays(['saturday', 'sunday'])).toBe('Saturdays & Sundays') })
  it('the five weekdays → Weekdays', () => {
    expect(formatDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])).toBe('Weekdays')
  })
  it('all seven → Every day', () => {
    expect(formatDays(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])).toBe('Every day')
  })
  it('arbitrary set joins in week order', () => {
    expect(formatDays(['friday', 'monday', 'wednesday'])).toBe('Mondays, Wednesdays & Fridays')
  })
  it('empty → dash', () => { expect(formatDays([])).toBe('—') })
})
