import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getStripe } from '@/lib/stripe'
import { mapStripeEventToDonationAction } from '@/lib/donations-webhook'
import { applyDonationAction } from '@/lib/donations-apply'
import { handleMembershipEvent } from '@/lib/membership-webhook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
  if (!sig || !secret) {
    return NextResponse.json({ error: 'missing signature or secret' }, { status: 400 })
  }
  const raw = await req.text()
  const stripe = getStripe()
  let event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret)
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  // Dispatch to both handlers; each one filters by metadata.kind internally.
  const [action] = await Promise.all([
    mapStripeEventToDonationAction(event, (subId, acctId) =>
      stripe.subscriptions
        .retrieve(subId, { stripeAccount: acctId })
        .then((s) => (s.metadata ?? {}) as Record<string, string>),
    ),
    handleMembershipEvent({
      event,
      payload,
      stripeSubscriptionRetrieve: (id, account) =>
        stripe.subscriptions.retrieve(id, { stripeAccount: account }),
    }),
  ])

  if (!action) return NextResponse.json({ received: true, ignored: event.type })
  await applyDonationAction(payload, action)
  return NextResponse.json({ received: true })
}
