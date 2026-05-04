import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenant } from '@/lib/tenant-server'
import { formatMembersCsv, type MemberExportRow } from '@/lib/members-export'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface MemberDoc {
  name: string
  email: string
  phone?: string | null
  tier?: { id: string | number; name?: string | null } | string | number | null
  status: string
  stripeSubscriptionStatus?: string | null
  joinedAt?: string | null
  currentPeriodEnd?: string | null
  canceledAt?: string | null
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
}

export async function GET() {
  const tenant = await getCurrentTenant()
  if (!tenant) {
    return NextResponse.json({ error: 'no tenant' }, { status: 404 })
  }

  const payload = await getPayload({ config })

  // Fetch all members for this tenant.
  // Limit is intentionally generous (10 000). For tenants with > 10 000 members
  // a paginated export would be needed — flag if this ever becomes a concern.
  const result = (await payload.find({
    collection: 'members' as never,
    where: {
      tenant: { equals: tenant.id },
    },
    limit: 10000,
    depth: 1, // populate tier relationship so we can read tier.name
    overrideAccess: true, // server-side route; we validated via getCurrentTenant
    sort: '-joinedAt',
  } as never)) as unknown as { docs: MemberDoc[] }

  const rows: MemberExportRow[] = result.docs.map((m) => {
    const tierName =
      typeof m.tier === 'object' && m.tier !== null && 'name' in m.tier
        ? (m.tier as { name?: string | null }).name ?? ''
        : ''

    return {
      name: m.name,
      email: m.email,
      phone: m.phone ?? null,
      tierName: tierName || null,
      status: m.status,
      stripeSubscriptionStatus: m.stripeSubscriptionStatus ?? null,
      joinedAt: m.joinedAt ?? null,
      currentPeriodEnd: m.currentPeriodEnd ?? null,
      canceledAt: m.canceledAt ?? null,
      stripeCustomerId: m.stripeCustomerId ?? null,
      stripeSubscriptionId: m.stripeSubscriptionId ?? null,
    }
  })

  const csv = formatMembersCsv(rows)
  const today = new Date().toISOString().slice(0, 10)
  const slug = (tenant as { slug?: string }).slug ?? String(tenant.id)
  const filename = `members-${slug}-${today}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
}
