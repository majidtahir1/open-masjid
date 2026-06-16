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
import { importMap } from '../importMap'
import TakeAttendance from '@/admin/school/TakeAttendance'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function TakeAttendancePage() {
  const { user, permissions } = await getAdminUser()
  if (!user) redirect(loginUrl('/admin/take-attendance'))

  const u = user as { role?: string }
  if (u.role !== 'school_admin' && u.role !== 'teacher') {
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
        <TakeAttendance />
      </main>
    </DefaultTemplate>
  )
}
