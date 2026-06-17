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
import { importMap } from '../../importMap'
import ClassesClient from '@/admin/school/classes/ClassesClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ROLES = new Set(['platformOwner', 'admin', 'school_admin'])

const idOf = (v: unknown): string | number | null =>
  v == null ? null : typeof v === 'object' && 'id' in v ? (v as { id: string | number }).id : (v as string | number)

export default async function ClassesPage() {
  const { user, permissions } = await getAdminUser()
  if (!user) redirect(loginUrl('/admin/sunday-school/classes'))

  const role = (user as { role?: string }).role
  if (!role || !ROLES.has(role)) redirect('/admin/sunday-school')

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
      <ClassesClient termId={term ? String(term.id) : null} termName={term?.name ?? null} />
    </DefaultTemplate>
  )
}
