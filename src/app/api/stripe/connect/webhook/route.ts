import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getStripe } from '@/lib/stripe'
import { mapStripeEventToDonationAction } from '@/lib/donations-webhook'
import { applyDonationAction } from '@/lib/donations-apply'

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
  const action = mapStripeEventToDonationAction(event)
  if (!action) return NextResponse.json({ received: true, ignored: event.type })
  const payload = await getPayload({ config })
  await applyDonationAction(payload, action)
  return NextResponse.json({ received: true })
}
