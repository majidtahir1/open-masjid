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
import { importMap } from '../importMap'
import HubClient from '@/admin/school/HubClient'
import { buildHubSummary } from '@/lib/school-setup'
import { weeklyDates, holidaySet } from '@/hooks/generateClassSessions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const HUB_ROLES = new Set(['platformOwner', 'admin', 'school_admin', 'teacher'])

const idOf = (v: unknown): string | number | null =>
  v == null ? null : typeof v === 'object' && 'id' in v ? (v as { id: string | number }).id : (v as string | number)

export default async function SundaySchoolHubPage() {
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

  const termRes = await payload.find({
    collection: 'terms',
    where: { status: { equals: 'active' }, ...(tenantId ? { tenant: { equals: tenantId } } : {}) },
    sort: '-startDate',
    limit: 1,
    depth: 0,
    req,
  })
  const term = termRes.docs[0] ?? null

  let classes: any[] = []
  let enrollments: any[] = []
  let students: any[] = []
  let sessionsPerClass = 0
  if (term) {
    classes = (await payload.find({ collection: 'school-classes', where: { term: { equals: term.id } }, limit: 1000, depth: 0, req })).docs
    const classIds = classes.map((c) => c.id)
    if (classIds.length) {
      enrollments = (await payload.find({ collection: 'enrollments', where: { class: { in: classIds } }, limit: 5000, depth: 0, req })).docs
    }
    students = (await payload.find({ collection: 'students', where: { status: { equals: 'active' } }, limit: 5000, depth: 0, req })).docs
    sessionsPerClass =
      term.startDate && term.endDate
        ? weeklyDates(term.startDate, term.endDate, (term as any).meetingDay ?? 'sunday', holidaySet((term as any).holidays)).length
        : 0
  }

  const summary = buildHubSummary({ term, classes, enrollments, students, sessionsPerClass })

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
      <HubClient summary={summary} canSetup={role !== 'teacher'} />
    </DefaultTemplate>
  )
}
