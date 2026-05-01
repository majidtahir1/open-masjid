import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { getCurrentTenant } from '@/lib/tenant-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Body {
  fundId: string | number
  amountCents: number
  frequency: 'one_time' | 'monthly'
}

export async function POST(req: Request) {
  const tenant = await getCurrentTenant()
  if (!tenant) {
    return NextResponse.json({ error: 'no tenant' }, { status: 404 })
  }

  const dc = ((tenant as { donationConfig?: Record<string, unknown> }).donationConfig ?? {}) as {
    mode?: string | null
    stripeAccountId?: string | null
    stripeChargesEnabled?: boolean | null
  }

  if (dc.mode !== 'connect' || !dc.stripeAccountId || !dc.stripeChargesEnabled) {
    return NextResponse.json({ error: 'donations not enabled' }, { status: 409 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const { fundId, amountCents, frequency } = body
  if (!fundId || !Number.isInteger(amountCents) || amountCents < 100) {
    return NextResponse.json({ error: 'invalid amount' }, { status: 400 })
  }
  if (frequency !== 'one_time' && frequency !== 'monthly') {
    return NextResponse.json({ error: 'invalid frequency' }, { status: 400 })
  }

  const payload = await getPayload({ config })
  const fund = await payload
    .findByID({
      collection: 'donation-funds' as never,
      id: fundId as never,
      overrideAccess: true,
    })
    .catch(() => null)

  const fundRec = fund as
    | { id: string | number; tenant?: unknown; active?: boolean | null; name?: string | null }
    | null
  const fundTenantId =
    fundRec && typeof fundRec.tenant === 'object' && fundRec.tenant !== null
      ? (fundRec.tenant as { id: string | number }).id
      : (fundRec?.tenant as string | number | undefined)

  if (!fundRec || String(fundTenantId) !== String(tenant.id) || !fundRec.active) {
    return NextResponse.json({ error: 'fund not found' }, { status: 404 })
  }

  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const host = h.get('host')
  const origin = `${proto}://${host}`

  const metadata = {
    tenantId: String(tenant.id),
    fundId: String(fundRec.id),
    frequency,
  }

  const tenantName = (tenant as { name?: string | null }).name ?? 'Masjid'
  const fundName = fundRec.name ?? 'Donation'

  const stripe = getStripe()
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: frequency === 'monthly' ? 'subscription' : 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: `${tenantName} — ${fundName}` },
          unit_amount: amountCents,
          ...(frequency === 'monthly' ? { recurring: { interval: 'month' as const } } : {}),
        },
        quantity: 1,
      },
    ],
    metadata,
    payment_intent_data: frequency === 'one_time' ? { metadata } : undefined,
    subscription_data: frequency === 'monthly' ? { metadata } : undefined,
    success_url: `${origin}/donate/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/donate`,
  }
  const requestOptions: Stripe.RequestOptions = { stripeAccount: dc.stripeAccountId }
  const session = await stripe.checkout.sessions.create(params, requestOptions)

  return NextResponse.json({ url: session.url })
}
