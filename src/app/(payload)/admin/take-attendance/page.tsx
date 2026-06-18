/**
 * Custom admin route: Take Attendance
 *
 * A file-system route at `/admin/take-attendance` takes precedence over
 * Payload's `[[...segments]]` catch-all, exactly like `/admin/login`.
 * We wrap the client component in Payload's DefaultTemplate so it renders
 * inside the standard admin shell (nav, header, etc.).
 */

import { redirect } from 'next/navigation'
import { createLocalReq, getPayload, isEntityHidden, type SanitizedPermissions, type VisibleEntities } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import config from '@payload-config'
import { getAdminUser } from '@/lib/admin-context'
import { loginUrl } from '@/lib/login-redirect'
import { selectedProgramId } from '@/lib/program-context.server'
import { importMap } from '../importMap'
import TakeAttendance from '@/admin/school/TakeAttendance'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const idOf = (v: unknown): string | number | null =>
  v == null ? null : typeof v === 'object' && 'id' in v ? (v as { id: string | number }).id : (v as string | number)

export default async function TakeAttendancePage({ searchParams }: { searchParams: Promise<{ program?: string }> }) {
  const sp = await searchParams
  const { user, permissions } = await getAdminUser()
  if (!user) redirect(loginUrl('/admin/take-attendance'))

  const u = user as { role?: string }
  const ALLOWED_ROLES = new Set(['platformOwner', 'admin', 'school_admin', 'teacher'])
  if (!u.role || !ALLOWED_ROLES.has(u.role)) {
    redirect('/admin')
  }

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
      <main style={{ padding: '2rem', maxWidth: 720 }}>
        <h1 style={{ marginBottom: '1.5rem' }}>Take Attendance</h1>
        <TakeAttendance programId={selectedId != null ? String(selectedId) : null} />
      </main>
    </DefaultTemplate>
  )
}
