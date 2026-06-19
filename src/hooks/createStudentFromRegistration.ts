import type { CollectionAfterChangeHook } from 'payload'

import {
  mapParticipantToStudent,
  participantsFromSubmission,
  resolveAutoEnrollClassId,
} from '../lib/school-enroll'

// Postgres relationship ids are integers; numeric-looking strings ("94") are
// rejected on create, so coerce all-digit ids back to numbers.
const relId = (v: string | number): string | number =>
  typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v

const str = (data: Record<string, unknown>, key: string): string | undefined => {
  const v = data[key]
  if (v == null) return undefined
  const s = String(v).trim()
  return s.length > 0 ? s : undefined
}

const humanize = (s: string): string =>
  s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const formatValue = (raw: unknown): string => {
  if (raw == null) return ''
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No'
  if (Array.isArray(raw)) return raw.filter((x) => x != null && String(x).trim()).join(', ')
  return String(raw).trim()
}

/**
 * Build a label→value snapshot of every answered field in the submission, using
 * the form's own field labels where available. This keeps the student's
 * "Registration details" panel generic — any field the form collects shows up,
 * with no need to pre-map specific field names.
 */
function buildRegistrationDetails(
  submissionData: Record<string, unknown>,
  schema: { steps?: { fields?: { name?: string; label?: string; type?: string }[] }[] } | null | undefined,
  formName: string | null,
): { formName: string | null; fields: { label: string; value: string }[] } {
  const labelByName: Record<string, string> = {}
  const order: string[] = []
  for (const step of schema?.steps ?? []) {
    for (const f of step.fields ?? []) {
      if (f?.type === 'page-break' || !f?.name) continue
      if (f.label) labelByName[f.name] = f.label
      order.push(f.name)
    }
  }
  // Schema order first, then any submission keys not in the schema.
  const names = [...order, ...Object.keys(submissionData).filter((n) => !order.includes(n))]
  const seen = new Set<string>()
  const fields: { label: string; value: string }[] = []
  for (const name of names) {
    if (seen.has(name)) continue
    seen.add(name)
    const value = formatValue(submissionData[name])
    if (!value) continue
    fields.push({ label: labelByName[name] ?? humanize(name), value })
  }
  return { formName, fields }
}

/**
 * Map a flat submission data object (keyed by form field name) to Student
 * create data, or null if the required name fields are absent.
 *
 * Field names follow the snake_case convention injected by the registration
 * form builder (student_first_name, student_last_name, etc.).
 */
export function mapRegistrationFields(
  data: Record<string, unknown>,
  tenantId: string | number,
  registeredProgram?: string | number | null,
): Record<string, unknown> | null {
  const firstName = str(data, 'student_first_name')
  const lastName = str(data, 'student_last_name')
  if (!firstName || !lastName) return null

  const result: Record<string, unknown> = { tenant: tenantId, firstName, lastName, status: 'active' }

  const ageRaw = data['student_age']
  if (ageRaw != null) {
    const ageNum = Number(ageRaw)
    if (!Number.isNaN(ageNum)) result.age = ageNum
  }

  // Grade (e.g. Sunday school): parents supply it at registration; admins place by it.
  const grade = str(data, 'student_grade') ?? str(data, 'grade')
  if (grade) result.gradeLevel = grade

  const allergies = str(data, 'allergies')
  if (allergies) result.allergiesNotes = allergies

  const guardianName = str(data, 'guardian_name')
  if (guardianName) {
    const guardian: Record<string, unknown> = { name: guardianName, isPrimary: true }
    const phone = str(data, 'guardian_phone')
    if (phone) guardian.phone = phone
    const email = str(data, 'guardian_email')
    if (email) guardian.email = email
    result.guardians = [guardian]
  }

  if (registeredProgram != null) result.registeredProgram = registeredProgram
  return result
}

type FormSchemaShape = {
  steps?: { fields?: { name?: string; label?: string; type?: string }[] }[]
}

type RegForm = {
  schoolRegistration?: boolean
  registrationProgram?: unknown
  registration?: { participantModel?: string }
  schema?: FormSchemaShape
  title?: string
  name?: string
  payment?: { paymentModel?: string }
}

/** Return the repeatable-group fields declared in the form schema. */
function schemaGroups(schema: FormSchemaShape | null | undefined): { name?: string }[] {
  const groups: { name?: string }[] = []
  for (const step of schema?.steps ?? []) {
    for (const f of step.fields ?? []) {
      if (f?.type === 'repeatable-group') groups.push(f)
    }
  }
  return groups
}

/** Load + verify the school-registration form for a submission, or null. */
async function loadRegistrationForm(
  payload: any,
  formId: string | number,
  req?: unknown,
): Promise<RegForm | null> {
  try {
    return (await payload.findByID({
      collection: 'forms',
      id: formId,
      depth: 0,
      overrideAccess: true,
      ...(req ? { req } : {}),
    })) as unknown as RegForm
  } catch {
    return null
  }
}

export interface MaterializeStudentsOpts {
  /** When set, each created student is linked to this family tuition subscription. */
  programSubscriptionId?: string | number
  /** Payload request (transaction context) — passed when called from a hook. */
  req?: unknown
}

/**
 * Create the N students (one per participant) for a confirmed registration
 * submission: resolves the program's active classes (creating a default class
 * when none exist), auto-enrolls when the program has exactly one class, and
 * snapshots each participant's registration answers. Optionally links each
 * student to a family tuition `programSubscription`.
 *
 * Shared by the afterChange hook (free programs, at submit) and the tuition
 * webhook (paid programs, after payment). Returns the created student ids.
 */
export async function materializeStudentsFromSubmission(
  payloadArg: any,
  submission: { id?: string | number; form?: unknown; data?: unknown; tenant?: unknown },
  opts: MaterializeStudentsOpts = {},
): Promise<(string | number)[]> {
  // Payload's create/find data is strictly typed per slug; our data uses coerced
  // relation ids and a generic shape, so route through an untyped handle.
  const payload = payloadArg as any
  const req = opts.req
  const reqArg = req ? { req } : {}
  const createdIds: (string | number)[] = []

  const formId = typeof submission.form === 'object'
    ? (submission.form as { id?: string | number })?.id
    : (submission.form as string | number)
  if (!formId) return createdIds

  const form = await loadRegistrationForm(payload, formId, req)
  if (form?.schoolRegistration !== true) return createdIds

  const programIdRaw =
    form.registrationProgram == null
      ? null
      : typeof form.registrationProgram === 'object'
        ? (form.registrationProgram as { id: string | number }).id
        : (form.registrationProgram as string | number)
  const programId = programIdRaw == null ? null : relId(programIdRaw)

  const submissionData = (submission.data ?? {}) as Record<string, unknown>
  const tenantRaw =
    typeof submission.tenant === 'object'
      ? (submission.tenant as { id: string | number }).id
      : (submission.tenant as string | number)
  const tenantId = relId(tenantRaw)

  // children model: the single repeatable-group's name is the participant key.
  const groupKey =
    form.registration?.participantModel === 'children'
      ? (schemaGroups(form.schema)[0]?.name ?? null)
      : null
  const participants = participantsFromSubmission(submissionData, groupKey)

  // Resolve the program's ACTIVE classes once (single-class auto-enroll / default class).
  let activeClassIds: (string | number)[] = []
  if (programId != null) {
    try {
      const res = await payload.find({
        collection: 'school-classes',
        where: { and: [{ tenant: { equals: tenantId } }, { term: { equals: programId } }, { status: { equals: 'active' } }] },
        depth: 0,
        overrideAccess: true,
        limit: 0,
        ...reqArg,
      })
      activeClassIds = res.docs.map((c: { id: string | number }) => c.id)
    } catch (err) {
      payload.logger?.error?.({ err, submissionId: submission.id }, 'materializeStudentsFromSubmission: failed to load active classes')
    }

    // No classes yet: create a single default class so registrants land somewhere.
    if (activeClassIds.length === 0) {
      try {
        const def = await payload.create({
          collection: 'school-classes',
          overrideAccess: true,
          data: { tenant: tenantId, term: programId, name: form.title ?? 'General', status: 'active' },
          ...reqArg,
        })
        activeClassIds = [def.id]
      } catch (err) {
        payload.logger?.error?.({ err, submissionId: submission.id }, 'materializeStudentsFromSubmission: failed to create default class')
      }
    }
  }

  const autoClassId = resolveAutoEnrollClassId(activeClassIds)

  for (const p of participants) {
    const studentData = mapParticipantToStudent(p, submissionData, tenantId, programId)
    if (!studentData) continue

    // Snapshot every registration answer (shared + per-participant) onto the
    // student for the read-only "Registration details" panel.
    studentData.registrationDetails = buildRegistrationDetails(
      { ...submissionData, ...p },
      form.schema,
      form.title ?? form.name ?? null,
    )

    if (opts.programSubscriptionId != null) {
      studentData.programSubscription = relId(opts.programSubscriptionId)
    }

    try {
      const student = await payload.create({
        collection: 'students',
        data: studentData,
        overrideAccess: true,
        ...reqArg,
      })
      createdIds.push(student.id)
      if (autoClassId != null) {
        await payload.create({
          collection: 'enrollments',
          overrideAccess: true,
          data: { tenant: tenantId, student: relId(student.id), class: relId(autoClassId), status: 'active' },
          ...reqArg,
        })
      }
    } catch (err) {
      payload.logger?.error?.({ err, submissionId: submission.id }, 'materializeStudentsFromSubmission: failed to create student')
    }
  }

  return createdIds
}

export const createStudentFromRegistration: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc

  const formId = typeof doc.form === 'object' ? doc.form?.id : doc.form
  if (!formId) return doc

  const form = await loadRegistrationForm(req.payload, formId, req)
  if (form?.schoolRegistration !== true) return doc

  // Paid programs (one-time | monthly) defer student creation to the payment
  // webhook — students are materialized only after payment succeeds. Free (or
  // unset) programs materialize immediately at submit.
  const paymentModel = form.payment?.paymentModel
  if (paymentModel === 'one-time' || paymentModel === 'monthly') return doc

  await materializeStudentsFromSubmission(req.payload, doc, { req })
  return doc
}
