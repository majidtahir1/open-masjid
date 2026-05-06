import { getStripe } from './stripe'
import type { Payload } from 'payload'

interface Args {
  payload: Payload
  tenant: {
    id: string | number
    stripeAccountId?: string | null
    slug?: string | null
    customDomains?: Array<{ domain: string }> | null
  }
  form: { id: string | number; title: string; slug: string; payment?: any }
  submission: { id: string | number }
  amountCents: number
}

export async function createFormCheckoutSession(args: Args) {
  const { tenant, form, submission, amountCents } = args
  const stripe = getStripe()
  const accountId = tenant.stripeAccountId
  if (!accountId) throw new Error('Tenant has no connected Stripe account')

  const origin = pickTenantOrigin(tenant)
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: form.payment?.currency || 'usd',
            unit_amount: amountCents,
            product_data: {
              name: form.title,
              description: form.payment?.description || undefined,
            },
          },
        },
      ],
      metadata: {
        kind: 'form-submission',
        submissionId: String(submission.id),
        formId: String(form.id),
        tenantId: String(tenant.id),
      },
      success_url: `${origin}/api/forms/${form.slug}/checkout-success?sid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/forms/${form.slug}?cancelled=${submission.id}`,
    },
    { stripeAccount: accountId },
  )
  return session
}

function pickTenantOrigin(t: Args['tenant']): string {
  const cd = t.customDomains?.[0]?.domain
  if (cd) return `https://${cd}`
  return `https://${t.slug}.openmasjid.app`
}
