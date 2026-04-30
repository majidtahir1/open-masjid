import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getStripe } from '@/lib/stripe'
import { mapStripeEventToTenantUpdate } from '@/lib/billing-webhook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !secret) {
    return NextResponse.json({ error: 'missing signature or secret' }, { status: 400 })
  }
  const raw = await req.text()
  const stripe = getStripe()
  let event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret)
  } catch (err) {
    return NextResponse.json(
      { error: `signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    )
  }

  const update = mapStripeEventToTenantUpdate(event)
  if (!update) return NextResponse.json({ received: true, ignored: event.type })

  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: 'tenants',
    where: { stripeCustomerId: { equals: update.stripeCustomerId } },
    limit: 1,
    overrideAccess: true,
  })
  const tenant = found.docs[0] as { id: string | number; status?: string } | undefined
  if (!tenant) {
    payload.logger.warn(
      `billing-webhook: no tenant for stripeCustomerId=${update.stripeCustomerId}`,
    )
    return NextResponse.json({ received: true, unknown_customer: true })
  }
  // Defense in depth: never let a webhook downgrade a grandfathered tenant.
  if (tenant.status === 'grandfathered') {
    return NextResponse.json({ received: true, skipped: 'grandfathered' })
  }
  await payload.update({
    collection: 'tenants',
    id: tenant.id,
    data: update.data,
    overrideAccess: true,
  })
  return NextResponse.json({ received: true })
}
