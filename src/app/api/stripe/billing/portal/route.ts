import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import config from '@payload-config'
import { getStripe } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const tenantId =
    typeof user.tenant === 'object' && user.tenant !== null
      ? (user.tenant as { id: string | number }).id
      : (user.tenant as string | number | undefined)
  if (!tenantId) return NextResponse.json({ error: 'no tenant' }, { status: 400 })

  const tenant = (await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    overrideAccess: true,
  })) as unknown as { stripeCustomerId?: string } | null
  if (!tenant?.stripeCustomerId) {
    return NextResponse.json({ error: 'no stripe customer' }, { status: 400 })
  }

  const returnUrl =
    process.env.STRIPE_BILLING_PORTAL_RETURN_URL ?? 'http://localhost:3000/admin/billing'
  const portal = await getStripe().billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: returnUrl,
  })
  return NextResponse.json({ url: portal.url })
}
