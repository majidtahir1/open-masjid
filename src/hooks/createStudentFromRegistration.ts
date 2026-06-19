import type { CollectionAfterChangeHook } from 'payload'

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

export const createStudentFromRegistration: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc

  const formId = typeof doc.form === 'object' ? doc.form?.id : doc.form
  if (!formId) return doc

  type RegForm = {
    schoolRegistration?: boolean
    registrationProgram?: unknown
    schema?: { steps?: { fields?: { name?: string; label?: string; type?: string }[] }[] }
    title?: string
    name?: string
  }
  let form: RegForm | null = null
  try {
    form = (await req.payload.findByID({
      collection: 'forms',
      id: formId,
      depth: 0,
      overrideAccess: true,
      req,
    })) as unknown as RegForm
  } catch {
    return doc
  }

  if (form?.schoolRegistration !== true) return doc

  const programId =
    form.registrationProgram == null
      ? null
      : typeof form.registrationProgram === 'object'
        ? (form.registrationProgram as { id: string | number }).id
        : (form.registrationProgram as string | number)

  const submissionData = (doc.data ?? {}) as Record<string, unknown>
  const tenantId = typeof doc.tenant === 'object' ? (doc.tenant as { id: string | number }).id : doc.tenant
  const studentData = mapRegistrationFields(submissionData, tenantId, programId)
  if (!studentData) return doc

  // Snapshot every registration answer onto the student for the read-only
  // "Registration details" panel — generic, so any form field is captured.
  studentData.registrationDetails = buildRegistrationDetails(
    submissionData,
    form.schema,
    form.title ?? form.name ?? null,
  )

  try {
    await (req.payload as any).create({ collection: 'students', data: studentData, overrideAccess: true, req })
  } catch (err) {
    req.payload.logger.error({ err, submissionId: doc.id }, 'createStudentFromRegistration: failed to create student')
  }

  return doc
}
