import { describe, it, expect } from 'vitest'
import { mapRegistrationFields } from './createStudentFromRegistration'

describe('mapRegistrationFields — grade', () => {
  it('maps student_grade to gradeLevel', () => {
    const r = mapRegistrationFields(
      { student_first_name: 'Aisha', student_last_name: 'Abbasi', student_grade: '3' },
      1,
    )
    expect(r?.gradeLevel).toBe('3')
  })

  it('falls back to a `grade` field', () => {
    const r = mapRegistrationFields(
      { student_first_name: 'Yusuf', student_last_name: 'Khan', grade: 'Grade 1' },
      1,
    )
    expect(r?.gradeLevel).toBe('Grade 1')
  })

  it('omits gradeLevel when no grade field present', () => {
    const r = mapRegistrationFields(
      { student_first_name: 'Sara', student_last_name: 'Ali' },
      1,
    )
    expect(r?.gradeLevel).toBeUndefined()
  })
})
