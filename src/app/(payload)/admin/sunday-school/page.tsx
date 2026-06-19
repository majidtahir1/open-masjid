import { redirect } from 'next/navigation'
import {
  createLocalReq,
  getPayload,
  isEntityHidden,
  type SanitizedPermissions,
  type VisibleEntities,
} from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import config from '@payload-config'
import { getAdminUser } from '@/lib/admin-context'
import { loginUrl } from '@/lib/login-redirect'
import { selectedProgramId } from '@/lib/program-context.server'
import { importMap } from '../importMap'
import DashboardClient, { type DashboardData } from '@/admin/school/dashboard/DashboardClient'
import TeacherDashboard from '@/admin/school/dashboard/TeacherDashboard'
import { attendanceTrend, rateByClass, statusBreakdown, enrollmentByClass, dashboardKpis } from '@/lib/school-reports'
import { unplacedForProgram } from '@/lib/school-setup'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const HUB_ROLES = new Set(['platformOwner', 'admin', 'school_admin', 'teacher'])

const idOf = (v: unknown): string | number | null =>
  v == null ? null : typeof v === 'object' && 'id' in v ? (v as { id: string | number }).id : (v as string | number)

export default async function SundaySchoolHubPage({ searchParams }: { searchParams: Promise<{ program?: string }> }) {
  const sp = await searchParams
  const { user, permissions } = await getAdminUser()
  if (!user) redirect(loginUrl('/admin/sunday-school'))

  const role = (user as { role?: string }).role
  if (!role || !HUB_ROLES.has(role)) redirect('/admin')

  const payload = await getPayload({ config, importMap })
  const req = await createLocalReq({ user }, payload)

  const visibleEntities: VisibleEntities = {
    collections: payload.config.collections
      .filter(({ admin }) => !isEntityHidden({ hidden: admin?.hidden, user }))
      .map(({ slug }) => slug),
    globals: payload.config.globals
      .filter(({ admin }) => !isEntityHidden({ hidden: admin?.hidden, user }))
      .map(({ slug }) => slug),
  }

  const tenantId = idOf((user as { tenant?: unknown }).tenant)

  const programsRes = await payload.find({
    collection: 'terms',
    where: { ...(tenantId ? { tenant: { equals: tenantId } } : {}) },
    sort: '-startDate',
    limit: 1000,
    depth: 0,
    req,
  })
  const selectedId = await selectedProgramId(sp.program, programsRes.docs as any)
  const term = selectedId != null ? (programsRes.docs.find((p: any) => String(p.id) === String(selectedId)) ?? null) : null

  const today = new Date().toISOString().slice(0, 10)

  // Teacher: trimmed view of their own classes (no analytics/CRUD).
  if (role === 'teacher') {
    const myClasses = term
      ? (await payload.find({ collection: 'school-classes', where: { term: { equals: term.id }, status: { equals: 'active' } }, limit: 1000, depth: 0, req })).docs
      : []
    return (
      <DefaultTemplate i18n={req.i18n} params={{}} payload={payload} permissions={permissions as SanitizedPermissions} req={req} searchParams={{}} user={user} visibleEntities={visibleEntities}>
        <TeacherDashboard termName={term?.name ?? null} classes={myClasses.map((c: any) => ({ id: c.id, name: c.name }))} />
      </DefaultTemplate>
    )
  }

  let dashboard: DashboardData = {
    term: null,
    kpis: { students: 0, activeClasses: 0, avgAttendanceRate: 0, sessionsHeld: 0, sessionsUpcoming: 0 },
    trend: [], rateByClass: [], statusBreakdown: { present: 0, absent: 0, late: 0, excused: 0 }, enrollmentByClass: [],
    attention: { teacherlessClasses: 0, unplacedStudents: 0 },
  }

  if (term) {
    const classes = (await payload.find({ collection: 'school-classes', where: { term: { equals: term.id }, status: { equals: 'active' } }, limit: 1000, depth: 0, req })).docs
    const classIds = classes.map((c: any) => c.id)
    const sessions = classIds.length ? (await payload.find({ collection: 'class-sessions', where: { class: { in: classIds } }, limit: 10000, depth: 0, req })).docs : []
    const sessionIds = sessions.map((s: any) => s.id)
    const records = sessionIds.length ? (await payload.find({ collection: 'attendance-records', where: { session: { in: sessionIds } }, limit: 50000, depth: 0, req })).docs : []
    const enrollments = classIds.length ? (await payload.find({ collection: 'enrollments', where: { class: { in: classIds } }, limit: 10000, depth: 0, req })).docs : []
    const students = (await payload.find({ collection: 'students', where: { status: { equals: 'active' } }, limit: 10000, depth: 0, req })).docs

    const classDocs = classes.map((c: any) => ({ id: c.id, name: c.name }))
    const sessDocs = sessions.map((s: any) => ({ id: s.id, class: s.class, date: s.date }))
    const recDocs = records.map((r: any) => ({ session: r.session, status: r.status }))
    const teacherless = classes.filter((c: any) => !c.teachers || c.teachers.length === 0).length
    const unplaced = unplacedForProgram(students as any, enrollments.map((e: any) => ({ student: e.student, status: e.status })), term.id).length

    dashboard = {
      term: { name: term.name, startDate: term.startDate, endDate: term.endDate, meetingDays: ((term as any).meetingDays ?? []), holidays: ((term as any).holidays ?? []).map((h: any) => String(h.date).slice(0, 10)) },
      kpis: dashboardKpis({ students, classes: classDocs, sessions: sessDocs, records: recDocs, today }),
      trend: attendanceTrend(sessDocs, recDocs),
      rateByClass: rateByClass(classDocs, sessDocs, recDocs),
      statusBreakdown: statusBreakdown(recDocs),
      enrollmentByClass: enrollmentByClass(classDocs, enrollments.map((e: any) => ({ class: e.class, status: e.status }))),
      attention: { teacherlessClasses: teacherless, unplacedStudents: unplaced },
    }
  }

  return (
    <DefaultTemplate
      i18n={req.i18n}
      params={{}}
      payload={payload}
      permissions={permissions as SanitizedPermissions}
      req={req}
      searchParams={{}}
      user={user}
      visibleEntities={visibleEntities}
    >
      <DashboardClient data={dashboard} />
    </DefaultTemplate>
  )
}
