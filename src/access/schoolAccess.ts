import type { Access, PayloadRequest } from 'payload'
import { relId as idOf } from '@/lib/relationship-id'

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

// ---- program-scoped school_admin helpers ----

/** Program (term) ids a school_admin manages — read straight off the user. */
export function managedProgramIds(user: unknown): (string | number)[] {
  const mp = (user as { managedPrograms?: unknown[] } | null | undefined)?.managedPrograms ?? []
  return mp.map((p) => idOf(p)).filter((id): id is string | number => id != null)
}

/** Class ids belonging to a school_admin's managed programs (empty if none). */
async function schoolAdminClassIds(req: PayloadRequest): Promise<(string | number)[]> {
  const programIds = managedProgramIds(req.user)
  if (programIds.length === 0) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (req.payload as any).find({
    collection: 'school-classes', where: { term: { in: programIds } }, limit: 5000, depth: 0, overrideAccess: true, req,
  })
  return (res.docs as { id: string | number }[]).map((d) => d.id)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Resolve = (req: PayloadRequest) => Promise<any>

// Teacher resolvers (plain Resolve form, reusing teacherClassIds) so collections
// can compose them via readByRole/writeByRole instead of the teacherOr wrappers.
export const teacherClassesResolve: Resolve = async (req) => ({ id: { in: await teacherClassIds(req) } })
export const teacherSessionsResolve: Resolve = async (req) => ({ class: { in: await teacherClassIds(req) } })
export const teacherEnrollmentsResolve: Resolve = async (req) => ({ class: { in: await teacherClassIds(req) } })
export const teacherStudentsResolve: Resolve = async (req) => {
  const classIds = await teacherClassIds(req)
  let studentIds: (string | number)[] = []
  if (classIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (req.payload as any).find({
      collection: 'enrollments', where: { class: { in: classIds }, status: { equals: 'active' } }, limit: 5000, depth: 0, overrideAccess: true, req,
    })
    studentIds = (res.docs as { student: unknown }[]).map((d) => idOf(d.student)).filter((id): id is string | number => id != null)
  }
  return { id: { in: studentIds } }
}
export const teacherAttendanceResolve: Resolve = async (req) => {
  const classIds = await teacherClassIds(req)
  let sessionIds: (string | number)[] = []
  if (classIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (req.payload as any).find({
      collection: 'class-sessions', where: { class: { in: classIds } }, limit: 5000, depth: 0, overrideAccess: true, req,
    })
    sessionIds = (res.docs as { id: string | number }[]).map((d) => d.id)
  }
  return { session: { in: sessionIds } }
}

export const schoolAdminTermsRead: Resolve = async (req) => ({ id: { in: managedProgramIds(req.user) } })
export const schoolAdminClassesRead: Resolve = async (req) => ({ term: { in: managedProgramIds(req.user) } })
export const schoolAdminSessionsRead: Resolve = async (req) => ({ class: { in: await schoolAdminClassIds(req) } })
export const schoolAdminEnrollmentsRead: Resolve = async (req) => ({ class: { in: await schoolAdminClassIds(req) } })

export const schoolAdminStudentsRead: Resolve = async (req) => {
  const programIds = managedProgramIds(req.user)
  const classIds = await schoolAdminClassIds(req)
  let studentIds: (string | number)[] = []
  if (classIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (req.payload as any).find({
      collection: 'enrollments', where: { class: { in: classIds }, status: { equals: 'active' } }, limit: 5000, depth: 0, overrideAccess: true, req,
    })
    studentIds = (res.docs as { student: unknown }[]).map((d) => idOf(d.student)).filter((id): id is string | number => id != null)
  }
  return { or: [{ id: { in: studentIds } }, { registeredProgram: { in: programIds } }] }
}

export const schoolAdminAttendanceRead: Resolve = async (req) => {
  const classIds = await schoolAdminClassIds(req)
  let sessionIds: (string | number)[] = []
  if (classIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (req.payload as any).find({
      collection: 'class-sessions', where: { class: { in: classIds } }, limit: 5000, depth: 0, overrideAccess: true, req,
    })
    sessionIds = (res.docs as { id: string | number }[]).map((d) => d.id)
  }
  return { session: { in: sessionIds } }
}

/** Compose read access: platformOwner all; teacher/school_admin via resolvers; admin/staff tenant read. */
export function readByRole(opts: { teacher?: Resolve; schoolAdmin?: Resolve }): Access {
  return async (args) => {
    const role = roleOf(args.req.user)
    if (role === 'platformOwner') return true
    if (role === 'teacher') return opts.teacher && tenantOf(args.req.user) ? opts.teacher(args.req as PayloadRequest) : false
    if (role === 'school_admin') return opts.schoolAdmin && tenantOf(args.req.user) ? opts.schoolAdmin(args.req as PayloadRequest) : false
    return schoolTenantRead(args)
  }
}

/** Compose write access (update/delete): teacher/school_admin via resolvers; admin tenant; staff/none denied. */
export function writeByRole(opts: { teacher?: Resolve; schoolAdmin?: Resolve }): Access {
  return async (args) => {
    const role = roleOf(args.req.user)
    if (role === 'platformOwner') return true
    if (role === 'teacher') return opts.teacher && tenantOf(args.req.user) ? opts.teacher(args.req as PayloadRequest) : false
    if (role === 'school_admin') return opts.schoolAdmin && tenantOf(args.req.user) ? opts.schoolAdmin(args.req as PayloadRequest) : false
    return schoolTenantWrite(args)
  }
}

/** Create gate for programs (terms): admin/platformOwner only. */
export const adminOnlyCreate: Access = ({ req: { user } }) => {
  if (!user) return false
  if (roleOf(user) === 'platformOwner') return true
  if (roleOf(user) === 'admin') return Boolean(tenantOf(user))
  return false
}

/** Create gate for classes/enrollments/sessions/students: admin or a school_admin who manages ≥1 program. */
export const schoolAdminCreate: Access = ({ req: { user } }) => {
  if (!user) return false
  if (roleOf(user) === 'platformOwner') return true
  if (roleOf(user) === 'admin') return Boolean(tenantOf(user))
  if (roleOf(user) === 'school_admin') return managedProgramIds(user).length > 0
  return false
}
