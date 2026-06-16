import type { CollectionBeforeValidateHook } from 'payload'
import { Forbidden } from 'payload'

/**
 * For teacher writes, verify the target session belongs to a class the teacher
 * is assigned to. Admins/school_admins/platformOwner bypass (tenant access already checked).
 */
export const assertTeacherOwnsSession: CollectionBeforeValidateHook = async ({ data, req }) => {
  const user = req.user as { id?: string | number; role?: string } | null | undefined
  if (!user || user.role !== 'teacher') return data
  const sessionId = typeof data?.session === 'object' ? data?.session?.id : data?.session
  if (!sessionId) return data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (req.payload as any).findByID({
    collection: 'class-sessions',
    id: sessionId,
    depth: 1,
    overrideAccess: true,
    req,
  })
  const classDoc = session?.class as { teachers?: unknown[] } | undefined
  const teacherIds = (classDoc?.teachers ?? []).map((t) =>
    typeof t === 'object' && t !== null && 'id' in t ? (t as { id: unknown }).id : t,
  )
  if (!teacherIds.includes(user.id)) {
    throw new Forbidden(req.t)
  }
  return data
}
