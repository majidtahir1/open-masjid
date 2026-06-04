import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { verifyConnectEvent } from './verify'
import { mapStripeEventToDonationAction } from '@/lib/donations-webhook'
import { applyDonationAction } from '@/lib/donations-apply'
import { handleMembershipEvent } from '@/lib/membership-webhook'
import { handleFormSubmissionEvent } from '@/lib/form-submissions-webhook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'missing signature' }, { status: 400 })
  }
  const raw = await req.text()
  const verified = verifyConnectEvent(raw, sig, {
    liveSecret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
    testSecret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET_TEST,
  })
  if (!verified) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }
  const { event, stripe } = verified

  const payload = await getPayload({ config })

  // Dispatch to all handlers; each one filters by metadata.kind internally.
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
    handleFormSubmissionEvent({ event, payload }),
  ])

  if (!action) return NextResponse.json({ received: true, ignored: event.type })
  await applyDonationAction(payload, action)
  return NextResponse.json({ received: true })
}
