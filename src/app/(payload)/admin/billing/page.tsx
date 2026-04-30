import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getTenantBillingState, type BillingTenantFields } from '@/lib/billing'
import BillingClient from './BillingClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function BillingPage() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/admin/login')

  const tenantId =
    typeof user.tenant === 'object' && user.tenant !== null
      ? (user.tenant as { id: string | number }).id
      : (user.tenant as string | number | undefined)
  if (!tenantId) {
    return (
      <main className="mx-auto max-w-[880px] px-6 py-10 md:px-10 md:py-12">
        <h1 className="font-display text-3xl md:text-4xl text-[var(--icp-navy-700)] mb-4">
          Billing
        </h1>
        <p className="text-[var(--icp-gray-700)]">
          Platform owners do not have a billing account.
        </p>
      </main>
    )
  }
  const tenant = (await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    overrideAccess: true,
  })) as BillingTenantFields & {
    name: string
    subscriptionPlan?: string | null
    currentPeriodEnd?: string | null
    gracePeriodEndsAt?: string | null
  }

  const state = getTenantBillingState(tenant)
  return (
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
