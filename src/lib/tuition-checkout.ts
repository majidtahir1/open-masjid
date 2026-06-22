/**
 * Tuition subscription checkout — the recurring-billing counterpart to
 * `membership-checkout.ts` / `membership-stripe.ts`.
 *
 * The Stripe integration shell (`createTuitionCheckout`) is a thin wrapper that
 * mirrors the membership flow: it resolves the per-tenant Connect client, then
 * makes every Stripe call against the connected account via `{ stripeAccount }`.
 *
 * Net-new vs membership: tuition bills a *family* as one Stripe customer
 * (keyed by guardian email), with one recurring Price per child created on the
 * connected account (Checkout subscription mode requires price ids). The
 * per-child amounts are already sibling-discounted by the caller (Tasks 2-3).
 */
import { getStripeForTenant, connectedAccountId } from '@/lib/stripe'

export interface CreateTuitionCheckoutArgs {
  /** Tenant — drives the Connect client (demo vs live) and connected account. */
  tenant: { demoMode?: boolean | null } & Parameters<typeof connectedAccountId>[0]
  /** Guardian email — keys the family's single Stripe Customer. */
  guardianEmail: string
  /** Optional guardian display name for a freshly-created Customer. */
  guardianName?: string
  /** Already sibling-discounted per-child amounts, in the smallest currency unit. */
  discountedCents: number[]
  /**
   * Per-child display labels (student names), parallel to `discountedCents`.
   * Used to name each Stripe line item so checkout reads the way the registrant
   * saw it on the form. Falls back to "child N" when absent/short.
   */
  participantLabels?: string[]
  currency: string
  programName: string
  /** Metadata IDs — carried so the webhook can bind + materialize students. */
  tenantId: string
  submissionId: string
  programId: string
  successUrl: string
  cancelUrl: string
}

/**
 * Stripe integration shell (NOT unit-tested — thin wrapper). Mirrors
 * `membership-checkout.ts` + `membership-stripe.ts`: every call passes
 * `{ stripeAccount }`.
 *
 * Steps:
 *   1. Resolve the per-tenant Connect client + connected account id.
 *   2. Find-or-create the family Customer by guardian email on the connected
 *      account (net-new vs membership, which lets Checkout create the customer).
 *   3. Create one recurring Price per discounted amount on the connected
 *      account (Checkout subscription mode requires price ids).
 *   4. Create a `mode: 'subscription'` Checkout Session with the explicit
 *      customer, one line item per price, `allow_promotion_codes`, and matching
 *      `metadata` + `subscription_data.metadata` = { kind, tenantId, submissionId, programId }.
 *   5. Return the session URL.
 */
export async function createTuitionCheckout(args: CreateTuitionCheckoutArgs): Promise<string | null> {
  const {
    tenant,
    guardianEmail,
    guardianName,
    discountedCents,
    participantLabels,
    currency,
    programName,
    tenantId,
    submissionId,
    programId,
    successUrl,
    cancelUrl,
  } = args

  // 1. Per-tenant Connect client + connected account id (mirrors membership).
  const stripe = getStripeForTenant(tenant)
  const account = connectedAccountId(tenant)
  if (!account) {
    throw new Error('Stripe Connect not enabled for this tenant')
  }

  // 2. One Stripe Customer per guardian email on the connected account:
  //    reuse an existing match or create a new one.
  const found = await stripe.customers.list(
    { email: guardianEmail, limit: 1 },
    { stripeAccount: account },
  )
  const customer =
    found.data[0] ??
    (await stripe.customers.create(
      { email: guardianEmail, name: guardianName },
      { stripeAccount: account },
    ))

  // 3. One recurring Price per child on the connected account — Checkout
  //    subscription mode requires price ids (inline price_data is rejected).
  const priceIds: string[] = []
  for (let i = 0; i < discountedCents.length; i++) {
    const label = participantLabels?.[i]?.trim() || `child ${i + 1}`
    const price = await stripe.prices.create(
      {
        currency,
        unit_amount: discountedCents[i],
        recurring: { interval: 'month' },
        product_data: { name: `${programName} — ${label}` },
      },
      { stripeAccount: account },
    )
    priceIds.push(price.id)
  }

  // 4. Subscription-mode Checkout Session. Metadata is duplicated onto the
  //    subscription so both the session and the subscription carry the binding
  //    + submissionId the webhook needs.
  const sharedMetadata = { kind: 'tuition', tenantId, submissionId, programId }
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      customer: customer.id,
      line_items: priceIds.map((price) => ({ price, quantity: 1 })),
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: sharedMetadata,
      subscription_data: { metadata: sharedMetadata },
    },
    { stripeAccount: account },
  )

  // 5.
  return session.url
}
