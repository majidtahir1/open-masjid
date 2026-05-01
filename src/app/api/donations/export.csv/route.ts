import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenant } from '@/lib/tenant-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface DonationDoc {
  createdAt: string
  fund: { id: string | number; name?: string | null } | string | number
  amount: number
  currency: string
  frequency: string
  status: string
  stripePaymentIntentId: string
  stripeSubscriptionId?: string | null
}

const COLUMNS = [
  'created_at',
  'fund',
  'amount_cents',
  'currency',
  'frequency',
  'status',
  'stripe_payment_intent_id',
  'stripe_subscription_id',
]

function csvEscape(value: string): string {
  if (value === '') return ''
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET() {
  const tenant = await getCurrentTenant()
  if (!tenant) {
    return NextResponse.json({ error: 'no tenant' }, { status: 404 })
  }

  const payload = await getPayload({ config })
  const result = (await payload.find({
    collection: 'donations' as never,
    where: {
      tenant: { equals: tenant.id },
      status: { in: ['succeeded', 'refunded'] },
    },
    limit: 10000,
    depth: 1,
    overrideAccess: true,
    sort: '-createdAt',
  } as never)) as unknown as { docs: DonationDoc[] }

  const lines: string[] = [COLUMNS.join(',')]
  for (const d of result.docs) {
    const fundName =
      typeof d.fund === 'object' && d.fund !== null ? d.fund.name ?? '' : String(d.fund ?? '')
    const created = new Date(d.createdAt).toISOString()
    const row = [
      created,
      fundName,
      String(d.amount),
      d.currency ?? '',
      d.frequency ?? '',
      d.status ?? '',
      d.stripePaymentIntentId ?? '',
      d.stripeSubscriptionId ?? '',
    ].map(csvEscape)
    lines.push(row.join(','))
  }

  const csv = lines.join('\n') + '\n'
  const today = new Date().toISOString().slice(0, 10)
  const slug = (tenant as { slug?: string }).slug ?? String(tenant.id)
  const filename = `donations-${slug}-${today}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
}
