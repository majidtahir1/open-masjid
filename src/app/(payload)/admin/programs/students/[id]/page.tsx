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
import { importMap } from '../../../importMap'
import StudentDetailClient from '@/admin/school/students/StudentDetailClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ROLES = new Set(['platformOwner', 'admin', 'school_admin'])

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, permissions } = await getAdminUser()
  if (!user) redirect(loginUrl(`/admin/programs/students/${id}`))

  const role = (user as { role?: string }).role
  if (!role || !ROLES.has(role)) redirect('/admin/programs')

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
      <StudentDetailClient studentId={id} />
    </DefaultTemplate>
  )
}
