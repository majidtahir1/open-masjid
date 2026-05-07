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
import { importMap } from '../../importMap'
import OverviewClient from './OverviewClient'
import { computeAggregates, type DonationRow } from '@/lib/donations-aggregates'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface DonationDoc {
  id: string | number
  amount: number
  currency: string
  frequency: 'one_time' | 'monthly'
  status: 'succeeded' | 'refunded' | 'failed'
  stripePaymentIntentId: string
  stripeChargeId?: string | null
  stripeSubscriptionId?: string | null
  stripeAccountId: string
  createdAt: string
  fund: { id: string | number; name?: string | null } | string | number
}

function toRow(d: DonationDoc): DonationRow {
  const fund =
    typeof d.fund === 'object' && d.fund !== null
      ? { id: d.fund.id, name: d.fund.name ?? '' }
      : { id: d.fund as string | number, name: '' }
  return {
    id: d.id,
    amount: d.amount,
    currency: d.currency,
    frequency: d.frequency,
    status: d.status,
    stripePaymentIntentId: d.stripePaymentIntentId,
    stripeChargeId: d.stripeChargeId ?? null,
    stripeSubscriptionId: d.stripeSubscriptionId ?? null,
    stripeAccountId: d.stripeAccountId,
    createdAt: d.createdAt,
    fund,
  }
}

export default async function DonationsOverviewPage() {
  const { user, permissions } = await getAdminUser()
  if (!user) redirect('/admin/login')

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

  const tenantId =
    typeof user.tenant === 'object' && user.tenant !== null
      ? (user.tenant as { id: string | number }).id
      : (user.tenant as string | number | undefined)

  let body: React.ReactNode
  if (!tenantId) {
    body = (
      <main className="mx-auto max-w-[820px] px-6 py-10 md:px-10 md:py-12">
        <h1 className="mb-4 font-display text-[40px] font-medium leading-[1.08] tracking-tight text-fg1">
          Donations
        </h1>
        <p className="font-body text-fs-base text-fg2">
          Platform owners do not have a Stripe Connect account.
        </p>
      </main>
    )
  } else {
    const tenant = (await getAdminTenant(tenantId)) as unknown as {
      name?: string | null
      donationConfig?: { stripeAccountId?: string | null } | null
    }

    const result = (await payload.find({
      collection: 'donations' as never,
      where: { tenant: { equals: tenantId } },
      limit: 1000,
      depth: 1,
      overrideAccess: true,
      sort: '-createdAt',
    } as never)) as unknown as { docs: DonationDoc[] }

    const rows = result.docs.map(toRow)
    const aggregates = computeAggregates(rows, new Date())
    const recent = rows.slice(0, 25)

    body = (
      <OverviewClient
        tenantName={tenant.name ?? 'Masjid'}
        stripeAccountId={tenant.donationConfig?.stripeAccountId ?? null}
        aggregates={aggregates}
        recent={recent}
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
