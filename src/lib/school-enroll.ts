import { normalizePhone } from './phone'
import { guardiansGroupName, GUARDIAN_ROLES } from './registration-fields'
import type { FormSchema, Field } from './form-schema'

const str = (d: Record<string, unknown>, k: string): string | undefined => {
  const v = d[k]; if (v == null) return undefined; const s = String(v).trim(); return s.length ? s : undefined
}

export function participantsFromSubmission(data: Record<string, unknown>, groupKey: string | null): Record<string, unknown>[] {
  if (groupKey && Array.isArray(data[groupKey])) return data[groupKey] as Record<string, unknown>[]
  return [data] // self model: the submission itself is the single participant
}

export interface MappedGuardian {
  name: string
  phone?: string
  email?: string
  relationship?: string
  isPrimary: boolean
}

/** Resolve shared (per-submission) guardians from the typed guardians group, by
 *  ROLE (relabel-safe). Phones are normalized to match the kiosk. Returns [] when
 *  the form has no guardians group. The first named guardian is marked primary. */
export function guardiansFromSubmission(schema: FormSchema, data: Record<string, unknown>): MappedGuardian[] {
  const groupName = guardiansGroupName(schema)
  if (!groupName) return []
  let childFields: Field[] = []
  for (const step of schema.steps) {
    for (const f of step.fields) {
      if (f.type === 'repeatable-group' && f.name === groupName) childFields = f.fields as Field[]
    }
  }
  const byRole = (role: string): string | null => {
    const f = childFields.find((c) => 'role' in c && (c as { role?: string }).role === role)
    return f ? (f as { name: string }).name : null
  }
  const nameKey = byRole(GUARDIAN_ROLES.name)
  const phoneKey = byRole(GUARDIAN_ROLES.phone)
  const emailKey = byRole(GUARDIAN_ROLES.email)
  const relKey = byRole(GUARDIAN_ROLES.relationship)

  const items = Array.isArray(data[groupName]) ? (data[groupName] as Record<string, unknown>[]) : []
  const out: MappedGuardian[] = []
  for (const item of items) {
    const name = nameKey ? str(item, nameKey) : undefined
    if (!name) continue
    const g: MappedGuardian = { name, isPrimary: out.length === 0 }
    const phone = phoneKey ? str(item, phoneKey) : undefined
    if (phone) g.phone = normalizePhone(phone)
    const email = emailKey ? str(item, emailKey) : undefined
    if (email) g.email = email
    const rel = relKey ? str(item, relKey) : undefined
    if (rel) g.relationship = rel
    out.push(g)
  }
  return out
}

export function mapParticipantToStudent(
  p: Record<string, unknown>, guardian: Record<string, unknown>, tenantId: string | number, programId: string | number | null,
  guardians?: MappedGuardian[],
): Record<string, unknown> | null {
  const firstName = str(p, 'student_first_name'); const lastName = str(p, 'student_last_name')
  if (!firstName || !lastName) return null
  const result: Record<string, unknown> = { tenant: tenantId, firstName, lastName, status: 'active' }
  const ageRaw = p['student_age']; if (ageRaw != null && !Number.isNaN(Number(ageRaw))) result.age = Number(ageRaw)
  const grade = str(p, 'student_grade') ?? str(p, 'grade'); if (grade) result.gradeLevel = grade
  const allergies = str(p, 'allergies'); if (allergies) result.allergiesNotes = allergies
  if (guardians && guardians.length) {
    // Typed guardians block (shared per submission) — the canonical path.
    result.guardians = guardians
  } else {
    // Legacy fallback: a single guardian by canonical name on the submission.
    const gName = str(guardian, 'guardian_name')
    if (gName) {
      const g: Record<string, unknown> = { name: gName, isPrimary: true }
      const ph = str(guardian, 'guardian_phone'); if (ph) g.phone = normalizePhone(ph)
      const em = str(guardian, 'guardian_email'); if (em) g.email = em
      result.guardians = [g]
    }
  }
  if (programId != null) result.registeredProgram = programId
  return result
}

/** When a program has exactly one active class, return its id (auto-enroll target); else null. */
export function resolveAutoEnrollClassId(activeClassIds: (string | number)[]): string | number | null {
  return activeClassIds.length === 1 ? activeClassIds[0] : null
}
