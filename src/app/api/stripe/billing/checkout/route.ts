import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import config from '@payload-config'
import { getStripe, getPriceId } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { plan?: 'monthly' | 'annual' }
  const plan = body.plan === 'annual' ? 'annual' : 'monthly'

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (user.role !== 'admin' && user.role !== 'platformOwner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const tenantId =
    typeof user.tenant === 'object' && user.tenant !== null
      ? (user.tenant as { id: string | number }).id
      : (user.tenant as string | number | undefined)
  if (!tenantId) return NextResponse.json({ error: 'no tenant' }, { status: 400 })

  const tenant = (await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    overrideAccess: true,
  })) as { stripeCustomerId?: string; slug: string; name: string } | null
  if (!tenant?.stripeCustomerId) {
    return NextResponse.json(
      { error: 'no stripe customer; visit /admin/billing to provision' },
      { status: 400 },
    )
  }

  const returnBase =
    process.env.STRIPE_BILLING_PORTAL_RETURN_URL ?? 'http://localhost:3000/admin/billing'
  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer: tenant.stripeCustomerId,
    line_items: [{ price: getPriceId(plan), quantity: 1 }],
    success_url: `${returnBase}?checkout=success`,
    cancel_url: `${returnBase}?checkout=cancel`,
    subscription_data: { metadata: { tenantId: String(tenantId), slug: tenant.slug } },
  })
  return NextResponse.json({ url: session.url })
}
