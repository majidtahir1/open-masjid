import type Stripe from 'stripe'
import type { Payload } from 'payload'
import { sendFormNotifications } from './form-notifications'

interface Args {
  event: Stripe.Event
  payload: Payload
}

export async function handleFormSubmissionEvent({ event, payload }: Args) {
  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.expired')
    return
  const session = event.data.object as Stripe.Checkout.Session
  if (session.metadata?.kind !== 'form-submission') return
  const submissionId = session.metadata.submissionId
  if (!submissionId) return

  if (event.type === 'checkout.session.expired') {
    await payload
      .update({
        collection: 'form-submissions',
        id: submissionId,
        data: { paymentStatus: 'expired' },
        overrideAccess: true,
      })
      .catch(() => null)
    return
  }

  const sub = await payload.findByID({
    collection: 'form-submissions',
    id: submissionId,
    overrideAccess: true,
  })
  if (sub.paymentStatus === 'paid') return // idempotent

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

  const formId =
    typeof sub.form === 'object' && sub.form !== null && 'id' in sub.form
      ? (sub.form as { id: string | number }).id
      : (sub.form as string | number)
  const form = await payload.findByID({
    collection: 'forms',
    id: formId,
    overrideAccess: true,
  })
  const fresh = await payload.findByID({
    collection: 'form-submissions',
    id: submissionId,
    overrideAccess: true,
  })
  await sendFormNotifications({ form: form as any, submission: fresh as any })
}
