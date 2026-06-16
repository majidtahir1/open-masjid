import type { CollectionAfterChangeHook } from 'payload'

/** Title/slug substring that marks a Form as a Sunday-school registration form. */
const REGISTRATION_MARKER = 'sunday-school-registration'

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
 * The real `form-submissions.data` field is a plain Record<string, unknown>
 * (field names as keys), not an array of { field, value } pairs.
 */
export function mapRegistrationFields(
  data: Record<string, unknown>,
  tenantId: string | number,
): Record<string, unknown> | null {
  const firstName = str(data, 'firstName')
  const lastName = str(data, 'lastName')
  if (!firstName || !lastName) return null

  const result: Record<string, unknown> = {
    tenant: tenantId,
    firstName,
    lastName,
    status: 'active',
  }

  const ageRaw = data['age']
  if (ageRaw != null) {
    const ageNum = Number(ageRaw)
    if (!Number.isNaN(ageNum)) result.age = ageNum
  }

  const allergies = str(data, 'allergies')
  if (allergies) result.allergiesNotes = allergies

  const guardianName = str(data, 'guardianName')
  if (guardianName) {
    const guardian: Record<string, unknown> = { name: guardianName, isPrimary: true }
    const phone = str(data, 'guardianPhone')
    if (phone) guardian.phone = phone
    const email = str(data, 'guardianEmail')
    if (email) guardian.email = email
    result.guardians = [guardian]
  }

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

  let form: { slug?: string; title?: string } | null = null
  try {
    form = await req.payload.findByID({
      collection: 'forms',
      id: formId,
      depth: 0,
      overrideAccess: true,
      req,
    }) as { slug?: string; title?: string } | null
  } catch {
    return doc
  }

  const marker = `${form?.slug ?? ''} ${form?.title ?? ''}`.toLowerCase()
  if (!marker.includes(REGISTRATION_MARKER)) return doc

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
