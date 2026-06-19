const str = (d: Record<string, unknown>, k: string): string | undefined => {
  const v = d[k]; if (v == null) return undefined; const s = String(v).trim(); return s.length ? s : undefined
}

export function participantsFromSubmission(data: Record<string, unknown>, groupKey: string | null): Record<string, unknown>[] {
  if (groupKey && Array.isArray(data[groupKey])) return data[groupKey] as Record<string, unknown>[]
  return [data] // self model: the submission itself is the single participant
}

export function mapParticipantToStudent(
  p: Record<string, unknown>, guardian: Record<string, unknown>, tenantId: string | number, programId: string | number | null,
): Record<string, unknown> | null {
  const firstName = str(p, 'student_first_name'); const lastName = str(p, 'student_last_name')
  if (!firstName || !lastName) return null
  const result: Record<string, unknown> = { tenant: tenantId, firstName, lastName, status: 'active' }
  const ageRaw = p['student_age']; if (ageRaw != null && !Number.isNaN(Number(ageRaw))) result.age = Number(ageRaw)
  const grade = str(p, 'student_grade') ?? str(p, 'grade'); if (grade) result.gradeLevel = grade
  const allergies = str(p, 'allergies'); if (allergies) result.allergiesNotes = allergies
  const gName = str(guardian, 'guardian_name')
  if (gName) {
    const g: Record<string, unknown> = { name: gName, isPrimary: true }
    const ph = str(guardian, 'guardian_phone'); if (ph) g.phone = ph
    const em = str(guardian, 'guardian_email'); if (em) g.email = em
    result.guardians = [g]
  }
  if (programId != null) result.registeredProgram = programId
  return result
}

/** When a program has exactly one active class, return its id (auto-enroll target); else null. */
export function resolveAutoEnrollClassId(activeClassIds: (string | number)[]): string | number | null {
  return activeClassIds.length === 1 ? activeClassIds[0] : null
}
