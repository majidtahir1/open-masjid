import { describe, it, expect } from 'vitest'
import { buildAttendanceCsv } from '@/lib/attendance-csv'

const students = [{ id: 1, name: 'Aisha Khan' }, { id: 2, name: 'Bilal, Omar' }]
const sessions = [{ id: 10, date: '2026-09-06' }, { id: 11, date: '2026-09-13' }]
const records = [
  { student: 1, session: 10, status: 'present' },
  { student: 1, session: 11, status: 'absent' },
  { student: 2, session: 10, status: 'late' },
]

describe('buildAttendanceCsv', () => {
  it('builds a student × session matrix with a header row', () => {
    const csv = buildAttendanceCsv(students, sessions, records)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Student,2026-09-06,2026-09-13')
    expect(lines[1]).toBe('Aisha Khan,present,absent')
    // a name containing a comma must be quoted
    expect(lines[2]).toBe('"Bilal, Omar",late,')
  })
  it('handles empty input', () => {
    expect(buildAttendanceCsv([], [], [])).toBe('Student')
  })
})
