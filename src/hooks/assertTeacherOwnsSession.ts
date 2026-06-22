import type { CollectionBeforeValidateHook } from 'payload'
import { Forbidden } from 'payload'
import { relId as idOf } from '@/lib/relationship-id'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Scope attendance writes to the actor's allowed sessions:
 * - teacher: the session's class must list them in `teachers`
 * - school_admin: the session's class's `term` must be in their managedPrograms
 * - admin / platformOwner: bypass (tenant access already checked)
 */
export const assertSessionScope: CollectionBeforeValidateHook = async ({ data, req }) => {
  const user = req.user as { id?: string | number; role?: string; managedPrograms?: unknown[] } | null | undefined
  if (!user || (user.role !== 'teacher' && user.role !== 'school_admin')) return data
  const sessionId = typeof data?.session === 'object' ? (data?.session as any)?.id : data?.session
  if (!sessionId) return data

  const session = await (req.payload as any).findByID({ collection: 'class-sessions', id: sessionId, depth: 1, overrideAccess: true, req })
  const classDoc = session?.class as { teachers?: unknown[]; term?: unknown } | undefined

  if (user.role === 'teacher') {
    const teacherIds = (classDoc?.teachers ?? []).map(idOf).map(String)
    if (!teacherIds.includes(String(user.id))) throw new Forbidden(req.t)
  } else {
    const termId = idOf(classDoc?.term)
    const managed = (user.managedPrograms ?? []).map(idOf)
    if (!managed.map(String).includes(String(termId))) throw new Forbidden(req.t)
  }
  return data
}

/** Back-compat alias (AttendanceRecords imports this name today). */
export const assertTeacherOwnsSession = assertSessionScope
