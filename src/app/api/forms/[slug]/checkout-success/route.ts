import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenant } from '@/lib/tenant-server'
import { getStripe } from '@/lib/stripe'
import { relationshipId } from '@/lib/stripe-connect-binding'
import type Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const url = new URL(req.url)
  const sessionId = url.searchParams.get('sid')
  if (!sessionId) return NextResponse.json({ error: 'missing_sid' }, { status: 400 })

  const tenant = await getCurrentTenant()
  const stripeAccountId = typeof tenant?.stripeAccountId === 'string' ? tenant.stripeAccountId : null
  if (!stripeAccountId) return NextResponse.json({ error: 'no_account' }, { status: 404 })

  const stripe = getStripe()
  const requestOptions: Stripe.RequestOptions = { stripeAccount: stripeAccountId }
  const session = await stripe.checkout.sessions.retrieve(sessionId, requestOptions)
  const submissionId = session.metadata?.submissionId
  if (!submissionId) return NextResponse.json({ error: 'missing_metadata' }, { status: 400 })

  const payload = await getPayload({ config })
  const sub = await payload.findByID({
    collection: 'form-submissions',
    id: submissionId,
    overrideAccess: true,
  })
  // The session was retrieved from the current tenant's connected account, but
  // also require the submission itself to belong to this tenant before mutating
  // it — never mark another tenant's submission paid.
  const currentTenantId = relationshipId((tenant as { id?: unknown } | null)?.id ?? null)
  if (currentTenantId === null || relationshipId((sub as { tenant?: unknown }).tenant) !== currentTenantId) {
    return NextResponse.json({ error: 'tenant_mismatch' }, { status: 403 })
  }
  if (sub.paymentStatus === 'pending_payment' && session.payment_status === 'paid') {
    await payload.update({
      collection: 'form-submissions',
      id: submissionId,
      data: {
        paymentStatus: 'paid',
        paidAt: new Date().toISOString(),
        stripePaymentIntentId:
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
        amountCents: session.amount_total ?? sub.amountCents,
        currency: session.currency ?? sub.currency,
      },
      overrideAccess: true,
    })
  }
  return NextResponse.redirect(`${url.origin}/forms/${slug}/thanks?s=${submissionId}`, 303)
}
