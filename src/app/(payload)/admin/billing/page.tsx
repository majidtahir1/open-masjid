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
import { getAdminUser, getAdminTenant } from '@/lib/admin-context'
import { getTenantBillingState, type BillingTenantFields } from '@/lib/billing'
import { importMap } from '../importMap'
import BillingClient from './BillingClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function BillingPage() {
  const { user, permissions } = await getAdminUser()
  if (!user) redirect('/admin/login')

  // Pass importMap so DefaultTemplate's nested RenderServerComponent calls work.
  const payload = await getPayload({ config, importMap })

  // Build a PayloadRequest so DefaultTemplate has i18n / locale.
  const req = await createLocalReq({ user }, payload)

  const visibleEntities: VisibleEntities = {
    collections: payload.config.collections
      .filter(({ admin }) => !isEntityHidden({ hidden: admin?.hidden, user }))
      .map(({ slug }) => slug),
    globals: payload.config.globals
      .filter(({ admin }) => !isEntityHidden({ hidden: admin?.hidden, user }))
      .map(({ slug }) => slug),
  }

  const tenantId =
    typeof user.tenant === 'object' && user.tenant !== null
      ? (user.tenant as { id: string | number }).id
      : (user.tenant as string | number | undefined)

  let body: React.ReactNode
  if (!tenantId) {
    body = (
      <main className="mx-auto max-w-[880px] px-6 py-10 md:px-10 md:py-12">
        <h1 className="font-display text-3xl md:text-4xl text-[var(--icp-navy-700)] mb-4">
          Billing
        </h1>
        <p className="text-[var(--icp-gray-700)]">
          Platform owners do not have a billing account.
        </p>
      </main>
    )
  } else {
    const tenant = (await getAdminTenant(tenantId)) as unknown as BillingTenantFields & {
      name: string
      subscriptionPlan?: string | null
      currentPeriodEnd?: string | null
      gracePeriodEndsAt?: string | null
    }

    const state = getTenantBillingState(tenant)
    body = (
      <BillingClient
        state={state}
        plan={tenant.subscriptionPlan ?? null}
        subscriptionPlan={tenant.subscriptionPlan ?? null}
        currentPeriodEnd={tenant.currentPeriodEnd ?? null}
        gracePeriodEndsAt={tenant.gracePeriodEndsAt ?? null}
        tenantName={tenant.name}
      />
    )
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
      {body}
    </DefaultTemplate>
  )
}
