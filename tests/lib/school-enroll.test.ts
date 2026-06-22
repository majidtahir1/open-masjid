import { describe, it, expect } from 'vitest'
import { participantsFromSubmission, mapParticipantToStudent, resolveAutoEnrollClassId } from '@/lib/school-enroll'

describe('participantsFromSubmission', () => {
  it('returns the participants array for children forms', () => {
    const out = participantsFromSubmission({ guardian_name: 'R', participants: [{ student_first_name: 'A', student_last_name: 'B' }] }, 'participants')
    expect(out.length).toBe(1)
  })
  it('wraps top-level fields as a single participant for self forms (null groupKey)', () => {
    const out = participantsFromSubmission({ student_first_name: 'Adam', student_last_name: 'X' }, null)
    expect(out.length).toBe(1)
    expect(out[0].student_first_name).toBe('Adam')
  })
})

describe('mapParticipantToStudent', () => {
  it('maps a participant + shared guardian into student create data', () => {
    const r = mapParticipantToStudent(
      { student_first_name: 'Aisha', student_last_name: 'Abbasi', student_grade: '3' },
      { guardian_name: 'Mr Abbasi', guardian_phone: '847-555-0190', guardian_email: 'a@b.com' },
      1, 7,
    )
    expect(r).toMatchObject({ tenant: 1, firstName: 'Aisha', lastName: 'Abbasi', gradeLevel: '3', status: 'active', registeredProgram: 7 })
    // Phone is normalized (digits, last 10) so it matches the kiosk lookup.
    expect((r!.guardians as any[])[0]).toMatchObject({ name: 'Mr Abbasi', phone: '8475550190', email: 'a@b.com', isPrimary: true })
  })
  it('returns null without first+last name', () => {
    expect(mapParticipantToStudent({ student_first_name: 'A' }, {}, 1, null)).toBeNull()
  })
  it('falls back to a `grade` field for gradeLevel', () => {
    const r = mapParticipantToStudent(
      { student_first_name: 'Yusuf', student_last_name: 'Khan', grade: 'Grade 1' },
      {}, 1, null,
    )
    expect(r?.gradeLevel).toBe('Grade 1')
  })
  it('omits gradeLevel when no grade field present', () => {
    const r = mapParticipantToStudent({ student_first_name: 'Sara', student_last_name: 'Ali' }, {}, 1, null)
    expect(r?.gradeLevel).toBeUndefined()
  })
})

describe('resolveAutoEnrollClassId', () => {
  it('returns the id when exactly one active class', () => {
    expect(resolveAutoEnrollClassId([42])).toBe(42)
  })
  it('returns null with zero classes', () => {
    expect(resolveAutoEnrollClassId([])).toBeNull()
  })
  it('returns null with two or more classes', () => {
    expect(resolveAutoEnrollClassId([1, 2])).toBeNull()
  })
})

import { guardiansFromSubmission } from '@/lib/school-enroll'
import type { FormSchema } from '@/lib/form-schema'

const schemaWithGuardians: FormSchema = { steps: [{ id: 's1', fields: [
  { type: 'repeatable-group', id: 'g', name: 'guardians', label: 'Guardians', role: 'guardians', min: 1, fields: [
    { type: 'short-text', id: 'n', name: 'g_name', label: 'Name', required: true, role: 'guardian_name' },
    { type: 'phone', id: 'p', name: 'g_phone', label: 'Phone', required: false, role: 'guardian_phone' },
    { type: 'email', id: 'e', name: 'g_email', label: 'Email', required: false, role: 'guardian_email' },
    { type: 'short-text', id: 'r', name: 'g_rel', label: 'Rel', required: false, role: 'guardian_relationship' },
  ]},
]}] }

describe('guardiansFromSubmission', () => {
  it('reads guardians by role, normalizes phone, marks first primary', () => {
    const data = { guardians: [
      { g_name: 'Parent One', g_phone: '(999) 000-0000', g_email: 'a@b.com', g_rel: 'Mother' },
      { g_name: 'Parent Two', g_phone: '111-222-3333' },
    ]}
    expect(guardiansFromSubmission(schemaWithGuardians, data)).toEqual([
      { name: 'Parent One', phone: '9990000000', email: 'a@b.com', relationship: 'Mother', isPrimary: true },
      { name: 'Parent Two', phone: '1112223333', isPrimary: false },
    ])
  })
  it('returns [] when there is no guardians group', () => {
    expect(guardiansFromSubmission({ steps: [{ id: 's1', fields: [] }] }, { guardian_name: 'X' })).toEqual([])
  })
})

describe('mapParticipantToStudent with explicit guardians', () => {
  it('assigns the provided guardians array to the student', () => {
    const guardians = [{ name: 'Parent One', phone: '9990000000', isPrimary: true }]
    const s = mapParticipantToStudent(
      { student_first_name: 'Bob', student_last_name: 'Smith' }, {}, 1, 2, guardians,
    )
    expect(s?.guardians).toEqual(guardians)
  })
})
