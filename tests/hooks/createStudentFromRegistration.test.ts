import { describe, it, expect, vi } from 'vitest'
import { createStudentFromRegistration, mapRegistrationFields } from '@/hooks/createStudentFromRegistration'

/**
 * Mock payload for the afterChange hook. `findByID` dispatches by collection:
 * 'terms' returns the program (whose paymentModel drives deferral), everything
 * else returns the form. find/create are spies so we can assert whether
 * students were created.
 */
function makePayload(form: Record<string, unknown>, program: Record<string, unknown> = {}) {
  const findByID = vi.fn(async (args: any) => (args?.collection === 'terms' ? program : form))
  const find = vi.fn(async () => ({ docs: [] }))
  const create = vi.fn(async (a: any) => ({ id: 1, ...a.data }))
  const logger = { error: vi.fn() }
  return { findByID, find, create, logger } as any
}

const baseSubmissionDoc = {
  id: 5,
  form: 42,
  tenant: 9,
  data: { student_first_name: 'Aisha', student_last_name: 'Khan', guardian_email: 'sara@example.com' },
}

async function runHook(payload: any, doc: any = baseSubmissionDoc) {
  await createStudentFromRegistration({ doc, operation: 'create', req: { payload } } as any)
}

describe('createStudentFromRegistration afterChange', () => {
  it('does NOT create students for a monthly (paid) program — deferred to webhook', async () => {
    const payload = makePayload(
      { schoolRegistration: true, registration: { participantModel: 'self' }, registrationProgram: 77 },
      { paymentModel: 'monthly' },
    )
    await runHook(payload)
    const studentCreates = payload.create.mock.calls.filter((c: any[]) => c[0]?.collection === 'students')
    expect(studentCreates).toHaveLength(0)
  })

  it('does NOT create students for a one-time (paid) program — deferred to webhook', async () => {
    const payload = makePayload(
      { schoolRegistration: true, registration: { participantModel: 'self' }, registrationProgram: 77 },
      { paymentModel: 'one-time' },
    )
    await runHook(payload)
    const studentCreates = payload.create.mock.calls.filter((c: any[]) => c[0]?.collection === 'students')
    expect(studentCreates).toHaveLength(0)
  })

  it('DOES create students for a free program at submit', async () => {
    const payload = makePayload(
      { schoolRegistration: true, registration: { participantModel: 'self' }, registrationProgram: 77 },
      { paymentModel: 'free' },
    )
    await runHook(payload)
    const studentCreates = payload.create.mock.calls.filter((c: any[]) => c[0]?.collection === 'students')
    expect(studentCreates).toHaveLength(1)
  })

  it('DOES create students when no program is bound (no paymentModel → free)', async () => {
    const payload = makePayload({
      schoolRegistration: true,
      registration: { participantModel: 'self' },
    })
    await runHook(payload)
    const studentCreates = payload.create.mock.calls.filter((c: any[]) => c[0]?.collection === 'students')
    expect(studentCreates).toHaveLength(1)
  })
})

describe('mapRegistrationFields', () => {
  it('maps snake_case fields to Student data', () => {
    const data = {
      student_first_name: 'Aisha',
      student_last_name: 'Khan',
      student_age: '7',
      guardian_name: 'Sara Khan',
      guardian_phone: '555-1212',
      guardian_email: 'sara@example.com',
      allergies: 'peanuts',
    }
    expect(mapRegistrationFields(data, 9)).toEqual({
      tenant: 9,
      firstName: 'Aisha',
      lastName: 'Khan',
      age: 7,
      allergiesNotes: 'peanuts',
      status: 'active',
      guardians: [{ name: 'Sara Khan', phone: '555-1212', email: 'sara@example.com', isPrimary: true }],
    })
  })
  it('requires both student name fields', () => {
    expect(mapRegistrationFields({ student_first_name: 'Aisha' }, 9)).toBeNull()
    expect(mapRegistrationFields({ student_last_name: 'Khan' }, 9)).toBeNull()
  })
  it('omits optional fields when absent', () => {
    const result = mapRegistrationFields({ student_first_name: 'Ali', student_last_name: 'Hassan' }, 9)
    expect(result).toMatchObject({ firstName: 'Ali', lastName: 'Hassan', tenant: 9, status: 'active' })
    expect(result).not.toHaveProperty('age')
    expect(result).not.toHaveProperty('allergiesNotes')
    expect(result).not.toHaveProperty('guardians')
  })
  it('includes registeredProgram when provided', () => {
    const r = mapRegistrationFields({ student_first_name: 'Ali', student_last_name: 'Hassan' }, 9, 55)
    expect(r).toMatchObject({ firstName: 'Ali', lastName: 'Hassan', registeredProgram: 55 })
  })
  it('omits registeredProgram when not provided', () => {
    const r = mapRegistrationFields({ student_first_name: 'Ali', student_last_name: 'Hassan' }, 9)
    expect(r).not.toHaveProperty('registeredProgram')
  })
})
