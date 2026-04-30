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
      <main style={{ padding: 32 }}>
        <h1>Billing</h1>
        <p>Platform owners do not have a billing account.</p>
      </main>
    )
  }
  const tenant = (await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    overrideAccess: true,
  })) as BillingTenantFields & { name: string; subscriptionPlan?: string }

  const state = getTenantBillingState(tenant)
  return (
    <main style={{ padding: 32, maxWidth: 720 }}>
      <h1 style={{ marginBottom: 8 }}>Billing — {tenant.name}</h1>
      <BillingClient state={state} plan={tenant.subscriptionPlan ?? null} />
    </main>
  )
}
