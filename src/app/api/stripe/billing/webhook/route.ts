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
  const payload = await getPayload({ config })
  let event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret)
  } catch (err) {
    payload.logger.warn(
      `billing-webhook: signature verification failed: ${(err as Error).message}`,
    )
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  const update = mapStripeEventToTenantUpdate(event)
  if (!update) return NextResponse.json({ received: true, ignored: event.type })

  const found = await payload.find({
    collection: 'tenants',
    where: { stripeCustomerId: { equals: update.stripeCustomerId } },
    limit: 1,
    overrideAccess: true,
  })
  const tenant = found.docs[0] as unknown as { id: string | number; status?: string } | undefined
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
  // Translate the Stripe price id from the event into our plan enum.
  // Done here (not in the mapper) so the mapper stays env-free and pure.
  const data: Record<string, unknown> = { ...update.data }
  if (update.priceId) {
    if (update.priceId === process.env.STRIPE_PRICE_MONTHLY) data.subscriptionPlan = 'monthly'
    else if (update.priceId === process.env.STRIPE_PRICE_ANNUAL) data.subscriptionPlan = 'annual'
  }
  await payload.update({
    collection: 'tenants',
    id: tenant.id,
    data,
    overrideAccess: true,
  })
  return NextResponse.json({ received: true })
}
