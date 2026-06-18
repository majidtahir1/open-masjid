import type { CollectionBeforeValidateHook } from 'payload'
import { Forbidden } from 'payload'

/* eslint-disable @typescript-eslint/no-explicit-any */
const idOf = (v: unknown) => (typeof v === 'object' && v !== null && 'id' in v ? (v as { id: unknown }).id : v)

/**
 * For a school_admin creating/updating a class, require `data.term` ∈ managedPrograms.
 * teacher/admin/platformOwner unaffected (their access already gates them).
 */
export const assertClassProgramScope: CollectionBeforeValidateHook = ({ data, req }) => {
  const user = req.user as { role?: string; managedPrograms?: unknown[] } | null | undefined
  if (user?.role !== 'school_admin') return data
  if (data?.term == null) return data
  const managed = (user.managedPrograms ?? []).map(idOf).map(String)
  if (!managed.includes(String(idOf(data.term)))) throw new Forbidden(req.t)
  return data
}

/**
 * For a school_admin creating/updating an enrollment, resolve the class's term and
 * require it ∈ managedPrograms.
 */
export const assertEnrollmentProgramScope: CollectionBeforeValidateHook = async ({ data, req }) => {
  const user = req.user as { role?: string; managedPrograms?: unknown[] } | null | undefined
  if (user?.role !== 'school_admin') return data
  const classId = idOf(data?.class)
  if (classId == null) return data
  const klass = await (req.payload as any).findByID({ collection: 'school-classes', id: classId, depth: 0, overrideAccess: true, req })
  const managed = (user.managedPrograms ?? []).map(idOf).map(String)
  if (!managed.includes(String(idOf(klass?.term)))) throw new Forbidden(req.t)
  return data
}
