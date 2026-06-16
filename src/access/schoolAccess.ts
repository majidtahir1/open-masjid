import type { Access, PayloadRequest } from 'payload'

/** Extract a tenant id from a user's tenant field (object or primitive). */
const getTenantId = (tenant: unknown): string | number | null => {
  if (!tenant) return null
  if (typeof tenant === 'object' && tenant !== null && 'id' in tenant) {
    return (tenant as { id: string | number }).id
  }
  return tenant as string | number
}

const roleOf = (user: unknown): string | undefined =>
  (user as { role?: string } | null | undefined)?.role

const tenantOf = (user: unknown) =>
  getTenantId((user as { tenant?: unknown } | null | undefined)?.tenant)

/** Roles that may create/update/delete school records across their tenant. */
const WRITE_ROLES = ['admin', 'school_admin']

/**
 * Read: platformOwner sees all; admin/school_admin/staff are tenant-scoped.
 * (Teacher read is handled per-collection by the async helpers added later.)
 */
export const schoolTenantRead: Access = ({ req: { user } }) => {
  if (!user) return false
  if (roleOf(user) === 'platformOwner') return true
  const tenantId = tenantOf(user)
  if (!tenantId) return false
  if (WRITE_ROLES.includes(roleOf(user)!) || roleOf(user) === 'staff') {
    return { tenant: { equals: tenantId } }
  }
  return false
}

/** Create/update/delete: platformOwner all; admin/school_admin tenant-scoped; others denied. */
export const schoolTenantWrite: Access = ({ req: { user } }) => {
  if (!user) return false
  if (roleOf(user) === 'platformOwner') return true
  const tenantId = tenantOf(user)
  if (!tenantId) return false
  if (WRITE_ROLES.includes(roleOf(user)!)) return { tenant: { equals: tenantId } }
  return false
}

/** Create needs a boolean (no `where`): platformOwner / admin / school_admin within a tenant. */
export const schoolTenantCreate: Access = ({ req: { user } }) => {
  if (!user) return false
  if (roleOf(user) === 'platformOwner') return true
  if (!tenantOf(user)) return false
  return WRITE_ROLES.includes(roleOf(user)!)
}

// ---- shared internals reused by the async teacher helpers (added later) ----
export { getTenantId, roleOf, tenantOf, WRITE_ROLES }
export type { PayloadRequest }

// ---- async teacher-scoped access helpers ----

const idOf = (v: unknown): string | number =>
  typeof v === 'object' && v !== null && 'id' in v ? (v as { id: string | number }).id : (v as string | number)

/** Class ids the teacher is assigned to (empty array if none). */
async function teacherClassIds(req: PayloadRequest): Promise<(string | number)[]> {
  const userId = (req.user as { id: string | number }).id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (req.payload as any).find({
    collection: 'school-classes',
    where: { teachers: { in: [userId] } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return (res.docs as { id: string | number }[]).map((d) => d.id)
}

/** Wrap an async teacher resolver so non-teachers fall through to schoolTenantRead. */
const teacherOr =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (resolve: (req: PayloadRequest) => Promise<any>): Access =>
  async (args) => {
    if (roleOf(args.req.user) !== 'teacher') return schoolTenantRead(args)
    if (!tenantOf(args.req.user)) return false
    return resolve(args.req as PayloadRequest)
  }

export const teacherClassesRead: Access = teacherOr(async (req) => ({
  id: { in: await teacherClassIds(req) },
}))

export const teacherSessionsRead: Access = teacherOr(async (req) => ({
  class: { in: await teacherClassIds(req) },
}))

export const teacherEnrollmentsRead: Access = teacherOr(async (req) => ({
  class: { in: await teacherClassIds(req) },
}))

export const teacherStudentsRead: Access = teacherOr(async (req) => {
  const classIds = await teacherClassIds(req)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (req.payload as any).find({
    collection: 'enrollments',
    where: { class: { in: classIds }, status: { equals: 'active' } },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const studentIds = (res.docs as { student: unknown }[]).map((d) => idOf(d.student))
  return { id: { in: studentIds } }
})

export const teacherAttendanceRead: Access = teacherOr(async (req) => {
  const classIds = await teacherClassIds(req)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (req.payload as any).find({
    collection: 'class-sessions',
    where: { class: { in: classIds } },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const sessionIds = (res.docs as { id: string | number }[]).map((d) => d.id)
  return { session: { in: sessionIds } }
})
