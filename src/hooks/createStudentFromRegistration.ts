import type { CollectionAfterChangeHook } from 'payload'

import {
  mapParticipantToStudent,
  participantsFromSubmission,
  resolveAutoEnrollClassId,
} from '../lib/school-enroll'
import { classSelectFieldName } from '../lib/registration-fields'
import { toWriteId as relId } from '../lib/relationship-id'

const humanize = (s: string): string =>
  s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const formatValue = (raw: unknown): string => {
  if (raw == null) return ''
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No'
  if (Array.isArray(raw))
    // Skip non-primitive entries — a repeatable-group's value is an array of
    // item objects, which would otherwise stringify to "[object Object]".
    return raw.filter((x) => x != null && typeof x !== 'object' && String(x).trim()).join(', ')
  // Structural/group values (objects) are not rendered in the flat details panel.
  if (typeof raw === 'object') return ''
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
      // Skip structural fields — they carry no flat answer of their own.
      if (f?.type === 'page-break' || f?.type === 'section' || f?.type === 'repeatable-group' || !f?.name)
        continue
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
  // The participant may have chosen a class on the form (class-select field).
  // Resolve that field by type and validate the chosen id against the program's
  // active classes — this both honors multi-class selections and rejects any
  // foreign/cross-tenant class id smuggled into a public submission.
  const classKey = classSelectFieldName(form.schema)
  const activeClassSet = new Set(activeClassIds.map((id) => String(id)))

  for (const p of participants) {
    const studentData = mapParticipantToStudent(p, submissionData, tenantId, programId)
    if (!studentData) continue

    // Chosen class wins (when valid); else fall back to the single auto-enroll
    // class (only set when the program has exactly one active class).
    let enrollClassId: string | number | null = autoClassId
    if (classKey) {
      const chosen = p[classKey]
      if (chosen != null && activeClassSet.has(String(chosen))) enrollClassId = relId(chosen as string | number)
    }

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
      if (enrollClassId != null) {
        await payload.create({
          collection: 'enrollments',
          overrideAccess: true,
          data: { tenant: tenantId, student: relId(student.id), class: relId(enrollClassId), status: 'active' },
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

  // Pricing/cadence live on the bound program now. Paid programs
  // (one-time | monthly) defer student creation to the payment webhook —
  // students are materialized only after payment succeeds. Free (or unset)
  // programs materialize immediately at submit.
  const progRaw = form.registrationProgram
  const programId =
    progRaw == null ? null : typeof progRaw === 'object' ? (progRaw as { id: string | number }).id : (progRaw as string | number)
  let paymentModel: string | undefined
  if (programId != null) {
    const program = await req.payload
      .findByID({ collection: 'terms', id: programId, overrideAccess: true, req })
      .catch(() => null)
    paymentModel = (program as { paymentModel?: string } | null)?.paymentModel
  }
  if (paymentModel === 'one-time' || paymentModel === 'monthly') return doc

  await materializeStudentsFromSubmission(req.payload, doc, { req })
  return doc
}
