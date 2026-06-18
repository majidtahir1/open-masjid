import type { CollectionAfterChangeHook } from 'payload'

const str = (data: Record<string, unknown>, key: string): string | undefined => {
  const v = data[key]
  if (v == null) return undefined
  const s = String(v).trim()
  return s.length > 0 ? s : undefined
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

  let form: { schoolRegistration?: boolean } | null = null
  try {
    form = (await req.payload.findByID({
      collection: 'forms',
      id: formId,
      depth: 0,
      overrideAccess: true,
      req,
    })) as { schoolRegistration?: boolean } | null
  } catch {
    return doc
  }

  if (form?.schoolRegistration !== true) return doc

  const submissionData = (doc.data ?? {}) as Record<string, unknown>
  const tenantId = typeof doc.tenant === 'object' ? (doc.tenant as { id: string | number }).id : doc.tenant
  const studentData = mapRegistrationFields(submissionData, tenantId)
  if (!studentData) return doc

  try {
    await (req.payload as any).create({ collection: 'students', data: studentData, overrideAccess: true, req })
  } catch (err) {
    req.payload.logger.error({ err, submissionId: doc.id }, 'createStudentFromRegistration: failed to create student')
  }

  return doc
}
