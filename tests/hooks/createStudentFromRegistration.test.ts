import { describe, it, expect, vi } from 'vitest'
import {
  createStudentFromRegistration,
  materializeStudentsFromSubmission,
} from '@/hooks/createStudentFromRegistration'

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

describe('materializeStudentsFromSubmission — class enrollment', () => {
  function makeMatPayload(form: Record<string, unknown>, classes: { id: number }[]) {
    const findByID = vi.fn(async () => form)
    const find = vi.fn(async (a: any) =>
      a?.collection === 'school-classes' ? { docs: classes } : { docs: [] },
    )
    let nextStudentId = 100
    const create = vi.fn(async (a: any) => ({
      id: a.collection === 'students' ? nextStudentId++ : 1,
      ...a.data,
    }))
    const logger = { error: vi.fn() }
    return { findByID, find, create, logger } as any
  }

  const childForm = {
    schoolRegistration: true,
    registrationProgram: 77,
    registration: { participantModel: 'children' },
    title: 'Sunday School',
    // class-select field deliberately NOT named "class" to prove resolution is by type.
    schema: {
      steps: [
        {
          fields: [
            {
              type: 'repeatable-group',
              name: 'participants',
              label: 'Children',
              fields: [
                { type: 'short-text', name: 'student_first_name', label: 'First' },
                { type: 'short-text', name: 'student_last_name', label: 'Last' },
                { type: 'class-select', name: 'classroom', label: 'Class' },
              ],
            },
          ],
        },
      ],
    },
  }

  const enrollClasses = (payload: any): unknown[] =>
    payload.create.mock.calls
      .filter((c: any[]) => c[0]?.collection === 'enrollments')
      .map((c: any[]) => c[0].data.class)

  it('enrolls each child in their CHOSEN class for a multi-class program', async () => {
    const payload = makeMatPayload(childForm, [{ id: 10 }, { id: 20 }, { id: 30 }])
    const submission = {
      id: 5,
      form: 42,
      tenant: 9,
      data: {
        participants: [
          { student_first_name: 'A', student_last_name: 'K', classroom: '20' },
          { student_first_name: 'B', student_last_name: 'K', classroom: '30' },
        ],
      },
    }
    await materializeStudentsFromSubmission(payload, submission, {})
    expect(enrollClasses(payload)).toEqual([20, 30])
  })

  it('does NOT enroll when the chosen class is foreign/invalid', async () => {
    const payload = makeMatPayload(childForm, [{ id: 10 }, { id: 20 }])
    const submission = {
      id: 5,
      form: 42,
      tenant: 9,
      data: { participants: [{ student_first_name: 'A', student_last_name: 'K', classroom: '999' }] },
    }
    await materializeStudentsFromSubmission(payload, submission, {})
    expect(enrollClasses(payload)).toHaveLength(0)
  })

  it('snapshots registration details without stringifying the participant group', async () => {
    const payload = makeMatPayload(childForm, [{ id: 10 }])
    const submission = {
      id: 5,
      form: 42,
      tenant: 9,
      data: { participants: [{ student_first_name: 'A', student_last_name: 'K' }] },
    }
    await materializeStudentsFromSubmission(payload, submission, {})
    const studentCreate = payload.create.mock.calls.find((c: any[]) => c[0]?.collection === 'students')
    expect(JSON.stringify(studentCreate![0].data.registrationDetails)).not.toContain('[object Object]')
  })
})
