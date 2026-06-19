/**
 * Data resolution for the parent check-in kiosk.
 *
 * Check-in is "building level": one tap marks a child present for every class of
 * the bound program that meets today. These helpers resolve the program's
 * classes, today's sessions, and a family's children (matched by guardian phone)
 * along with each child's current in/out status.
 */
import { normalizePhone, tenantDayRangeUtc } from './kiosk'

type Payload = any

const idOf = (v: unknown): string =>
  String(typeof v === 'object' && v !== null && 'id' in v ? (v as any).id : v)

// Postgres uses integer relation ids; Payload's relationship validation rejects
// numeric-looking strings ("94"), so coerce all-digit ids back to numbers for
// writes. Non-numeric ids (e.g. Mongo ObjectIds) pass through unchanged.
const relId = (v: string): string | number => (/^\d+$/.test(v) ? Number(v) : v)

export type ChildStatus = 'none' | 'in' | 'out'

export interface KioskChild {
  id: string
  name: string
  firstName: string
  grade: string | null
  classes: string[]
  /** False when the child is enrolled in the program but no class meets today. */
  hasToday: boolean
  status: ChildStatus
  checkInAt: string | null
  checkOutAt: string | null
}

export interface ProgramContext {
  programId: string
  programName: string
  timezone: string | null
  classIds: string[]
  /** classId -> today's session id (one per class for the local day). */
  sessionByClass: Map<string, string>
}

/** Resolve the bound program's active classes and today's sessions. */
export async function loadProgramContext(
  payload: Payload,
  tenantId: string,
  programId: string,
): Promise<ProgramContext | null> {
  const program = await payload
    .findByID({ collection: 'terms', id: programId, overrideAccess: true })
    .catch(() => null)
  if (!program || idOf(program.tenant) !== String(tenantId)) return null

  const tenant = await payload
    .findByID({ collection: 'tenants', id: tenantId, overrideAccess: true, depth: 0 })
    .catch(() => null)
  const timezone = tenant?.location?.timezone ?? null

  const classes = await payload.find({
    collection: 'school-classes',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { term: { equals: programId } },
        { status: { equals: 'active' } },
      ],
    },
    depth: 0,
    limit: 500,
    overrideAccess: true,
  })
  const classIds = classes.docs.map((c: any) => idOf(c.id))

  const sessionByClass = new Map<string, string>()
  if (classIds.length) {
    const { gte, lte } = tenantDayRangeUtc(timezone)
    const sessions = await payload.find({
      collection: 'class-sessions',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { class: { in: classIds } },
          { date: { greater_than_equal: gte } },
          { date: { less_than_equal: lte } },
          { status: { not_equals: 'cancelled' } },
        ],
      },
      depth: 0,
      limit: 1000,
      overrideAccess: true,
    })
    for (const s of sessions.docs) {
      const cid = idOf(s.class)
      if (!sessionByClass.has(cid)) sessionByClass.set(cid, idOf(s.id))
    }
  }

  return {
    programId: String(programId),
    programName: program.name ?? 'Program',
    timezone,
    classIds,
    sessionByClass,
  }
}

/** Today's session ids for the classes a student is actively enrolled in. */
export async function studentTodaySessions(
  payload: Payload,
  tenantId: string,
  ctx: ProgramContext,
  studentId: string,
): Promise<{ sessionIds: string[]; classNames: string[] }> {
  if (!ctx.classIds.length) return { sessionIds: [], classNames: [] }
  const enrollments = await payload.find({
    collection: 'enrollments',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { student: { equals: studentId } },
        { class: { in: ctx.classIds } },
        { status: { equals: 'active' } },
      ],
    },
    depth: 1,
    limit: 100,
    overrideAccess: true,
  })
  const sessionIds: string[] = []
  const classNames: string[] = []
  for (const e of enrollments.docs) {
    const cid = idOf(e.class)
    const cname = typeof e.class === 'object' && e.class?.name ? e.class.name : null
    if (cname) classNames.push(cname)
    const sid = ctx.sessionByClass.get(cid)
    if (sid && !sessionIds.includes(sid)) sessionIds.push(sid)
  }
  return { sessionIds, classNames }
}

/** Collapse a child's attendance rows for today into one in/out status. */
export async function childStatusFor(
  payload: Payload,
  tenantId: string,
  studentId: string,
  sessionIds: string[],
): Promise<{ status: ChildStatus; checkInAt: string | null; checkOutAt: string | null }> {
  if (!sessionIds.length) return { status: 'none', checkInAt: null, checkOutAt: null }
  const records = await payload.find({
    collection: 'attendance-records',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { student: { equals: studentId } },
        { session: { in: sessionIds } },
      ],
    },
    depth: 0,
    limit: 100,
    overrideAccess: true,
  })
  let checkInAt: string | null = null
  let checkOutAt: string | null = null
  for (const r of records.docs) {
    if (r.checkInAt && (!checkInAt || r.checkInAt < checkInAt)) checkInAt = r.checkInAt
    if (r.checkOutAt && (!checkOutAt || r.checkOutAt > checkOutAt)) checkOutAt = r.checkOutAt
  }
  let status: ChildStatus = 'none'
  if (checkOutAt) status = 'out'
  else if (checkInAt) status = 'in'
  return { status, checkInAt, checkOutAt }
}

/** Find a family's children (by guardian phone) enrolled in the bound program. */
export async function findFamily(
  payload: Payload,
  tenantId: string,
  ctx: ProgramContext,
  rawPhone: string,
): Promise<{ familyName: string; children: KioskChild[] }> {
  const phone = normalizePhone(rawPhone)
  if (phone.length < 10) return { familyName: '', children: [] }

  // Guardian phones may be stored in varied formats — fetch active students and
  // match on the normalized number in JS.
  const students = await payload.find({
    collection: 'students',
    where: { and: [{ tenant: { equals: tenantId } }, { status: { equals: 'active' } }] },
    depth: 0,
    limit: 2000,
    overrideAccess: true,
  })
  const matched = students.docs.filter((s: any) =>
    Array.isArray(s.guardians) && s.guardians.some((g: any) => normalizePhone(g?.phone) === phone),
  )

  const children: KioskChild[] = []
  for (const s of matched) {
    const { sessionIds, classNames } = await studentTodaySessions(payload, tenantId, ctx, idOf(s.id))
    if (!classNames.length) continue // not enrolled in this program at all
    const hasToday = sessionIds.length > 0
    const st = hasToday
      ? await childStatusFor(payload, tenantId, idOf(s.id), sessionIds)
      : { status: 'none' as ChildStatus, checkInAt: null, checkOutAt: null }
    children.push({
      id: idOf(s.id),
      name: s.fullName || [s.firstName, s.lastName].filter(Boolean).join(' '),
      firstName: s.firstName || s.fullName || 'Student',
      grade: s.gradeLevel ?? null,
      classes: Array.from(new Set(classNames)),
      hasToday,
      status: st.status,
      checkInAt: st.checkInAt,
      checkOutAt: st.checkOutAt,
    })
  }

  const lastName = matched[0]?.lastName ? `${matched[0].lastName} family` : 'your family'
  return { familyName: lastName, children }
}

/** Upsert today's attendance rows for one child on check in / out. */
export async function applyCheck(
  payload: Payload,
  tenantId: string,
  ctx: ProgramContext,
  studentId: string,
  action: 'in' | 'out',
): Promise<{ status: ChildStatus; checkInAt: string | null; checkOutAt: string | null }> {
  const { sessionIds } = await studentTodaySessions(payload, tenantId, ctx, studentId)
  const now = new Date().toISOString()

  for (const sessionId of sessionIds) {
    const existing = await payload.find({
      collection: 'attendance-records',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { session: { equals: sessionId } },
          { student: { equals: studentId } },
        ],
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const row = existing.docs[0]
    if (action === 'in') {
      const data = { status: 'present', checkInAt: now, checkOutAt: null, checkInBy: 'kiosk' }
      if (row) await payload.update({ collection: 'attendance-records', id: row.id, data, overrideAccess: true })
      else
        await payload.create({
          collection: 'attendance-records',
          data: { tenant: relId(String(tenantId)), session: relId(sessionId), student: relId(studentId), ...data },
          overrideAccess: true,
        })
    } else {
      // check out — only meaningful if a row exists
      if (row) await payload.update({ collection: 'attendance-records', id: row.id, data: { checkOutAt: now }, overrideAccess: true })
    }
  }

  return childStatusFor(payload, tenantId, studentId, sessionIds)
}
