import { headers } from 'next/headers'
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
import { importMap } from '../../importMap'
import OverviewClient from './OverviewClient'
import { buildAggregates, type MemberRow, type TierRow } from '@/lib/membership-aggregates'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface MemberDoc {
  id: string | number
  tier: { id: string | number; name?: string | null; amountCents?: number | null; cadence?: string | null } | string | number
  status: 'active' | 'grace' | 'inactive'
}

interface TierDoc {
  id: string | number
  name: string
  amountCents: number
  cadence: 'monthly' | 'yearly'
}

function toMemberRow(d: MemberDoc): MemberRow {
  const tier =
    typeof d.tier === 'object' && d.tier !== null
      ? d.tier.id
      : (d.tier as string | number)
  return {
    id: d.id,
    tier,
    status: d.status,
  }
}

function toTierRow(d: TierDoc): TierRow {
  return {
    id: d.id,
    name: d.name,
    amountCents: d.amountCents,
    cadence: d.cadence,
  }
}

export default async function MembershipOverviewPage() {
  const payload = await getPayload({ config, importMap })
  const reqHeaders = await headers()
  const { user, permissions } = await payload.auth({ headers: reqHeaders })
  if (!user) redirect('/admin/login')

  // Staff are blocked — only admin and platformOwner may view this page
  if (user.role !== 'admin' && user.role !== 'platformOwner') {
    redirect('/admin')
  }

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
  if (!tenantId && user.role !== 'platformOwner') {
    body = (
      <main className="mx-auto max-w-[820px] px-6 py-10 md:px-10 md:py-12">
        <h1 className="mb-4 font-display text-[40px] font-medium leading-[1.08] tracking-tight text-fg1">
          Membership
        </h1>
        <p className="font-body text-fs-base text-fg2">No tenant assigned to this account.</p>
      </main>
    )
  } else if (!tenantId && user.role === 'platformOwner') {
    body = (
      <main className="mx-auto max-w-[820px] px-6 py-10 md:px-10 md:py-12">
        <h1 className="mb-4 font-display text-[40px] font-medium leading-[1.08] tracking-tight text-fg1">
          Membership
        </h1>
        <p className="font-body text-fs-base text-fg2">
          Platform owners do not belong to a tenant. Select a tenant to view their membership overview.
        </p>
      </main>
    )
  } else {
    const tenant = (await payload.findByID({
      collection: 'tenants',
      id: tenantId!,
      overrideAccess: true,
    })) as unknown as { name?: string | null }

    const membersResult = (await payload.find({
      collection: 'members' as never,
      where: { tenant: { equals: tenantId } },
      limit: 10000,
      depth: 0,
      overrideAccess: true,
    } as never)) as unknown as { docs: MemberDoc[] }

    const tiersResult = (await payload.find({
      collection: 'membership-tiers' as never,
      where: { tenant: { equals: tenantId } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    } as never)) as unknown as { docs: TierDoc[] }

    const memberRows = membersResult.docs.map(toMemberRow)
    const tierRows = tiersResult.docs.map(toTierRow)
    const aggregates = buildAggregates(memberRows, tierRows)

    body = (
      <OverviewClient
        tenantName={tenant.name ?? 'Masjid'}
        aggregates={aggregates}
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
