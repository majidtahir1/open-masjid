import type Stripe from 'stripe'
import { bucketFromStripeStatus } from './membership-status'

interface PayloadLike {
  find: (args: any) => Promise<{ docs: any[] }>
  create: (args: any) => Promise<any>
  update: (args: any) => Promise<any>
}

/** Minimal subscription shape required by the webhook handler. */
interface SubscriptionLike {
  id: string
  status: string
  current_period_end: number
  items?: { data: Array<{ price: { id: string } }> }
}

export interface HandleMembershipEventArgs {
  event: Stripe.Event & { account?: string }
  payload: PayloadLike
  /** Parameterised so tests can mock without a real Stripe client. */
  stripeSubscriptionRetrieve?: (id: string, account: string) => Promise<SubscriptionLike>
}

export async function handleMembershipEvent({
  event,
  payload,
  stripeSubscriptionRetrieve,
}: HandleMembershipEventArgs): Promise<void> {
  const account = event.account
  if (!account) return

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const md = (session.metadata ?? {}) as Record<string, string>
      if (md.kind !== 'membership') return

      const tenantId = Number(md.tenantId)
      const tierId = Number(md.tierId)
      if (!tenantId || !tierId) return

      // Extract subscription id — may be a string or an expanded object
      const subId =
        typeof session.subscription === 'string'
          ? session.subscription
          : (session.subscription as Stripe.Subscription | null)?.id ?? null
      if (!subId) return

      // Retrieve subscription to get status + current_period_end
      const sub: SubscriptionLike = stripeSubscriptionRetrieve
        ? await stripeSubscriptionRetrieve(subId, account)
        : { id: subId, status: 'active', current_period_end: Math.floor(Date.now() / 1000) }

      const email =
        session.customer_email ??
        (session.customer_details as { email?: string | null } | null)?.email ??
        ''
      const name =
        (session.customer_details as { name?: string | null } | null)?.name ?? email
      const phone =
        (session.customer_details as { phone?: string | null } | null)?.phone ?? null

      // Find-or-create by (tenant, email)
      const existing = await payload.find({
        collection: 'members',
        where: { tenant: { equals: tenantId }, email: { equals: email } },
        limit: 1,
        overrideAccess: true,
      })

      const data = {
        tenant: tenantId,
        email,
        name,
        phone,
        tier: tierId,
        status: bucketFromStripeStatus(sub.status),
        stripeCustomerId:
          typeof session.customer === 'string'
            ? session.customer
            : (session.customer as Stripe.Customer | Stripe.DeletedCustomer | null)?.id ?? null,
        stripeSubscriptionId: subId,
        stripeSubscriptionStatus: sub.status,
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        // Preserve original joinedAt when updating an existing member
        joinedAt: existing.docs[0]?.joinedAt ?? new Date().toISOString(),
      }

      if (existing.docs[0]) {
        await payload.update({
          collection: 'members',
          id: existing.docs[0].id,
          data,
          overrideAccess: true,
        })
      } else {
        await payload.create({ collection: 'members', data, overrideAccess: true })
      }
      return
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as unknown as SubscriptionLike
      const found = await payload.find({
        collection: 'members',
        where: { stripeSubscriptionId: { equals: sub.id } },
        limit: 1,
        overrideAccess: true,
      })
      const member = found.docs[0]
      if (!member) return

      // Detect Customer Portal upgrade/downgrade: match new Price ID to a tier.
      // The subscription's items.data[0].price.id may match either the current
      // stripePriceId OR an entry in archivedPriceIds on a different tier.
      let newTierId: number | undefined
      const priceId: string | undefined = sub.items?.data?.[0]?.price?.id
      if (priceId) {
        // Try combined query first; fall back to two separate finds if Payload
        // doesn't support nested-array dot-notation for archivedPriceIds.priceId
        let tierDocs: any[] = []
        try {
          const tiers = await payload.find({
            collection: 'membership-tiers',
            where: {
              or: [
                { stripePriceId: { equals: priceId } },
                { 'archivedPriceIds.priceId': { equals: priceId } },
              ],
            },
            limit: 1,
            overrideAccess: true,
          })
          tierDocs = tiers.docs
        } catch {
          // Payload may not support nested array key — fall back to two queries
          const byCurrentPrice = await payload.find({
            collection: 'membership-tiers',
            where: { stripePriceId: { equals: priceId } },
            limit: 1,
            overrideAccess: true,
          })
          tierDocs = byCurrentPrice.docs
          if (tierDocs.length === 0) {
            // Try archived price lookup (not all Payload adapters support this)
            try {
              const byArchived = await payload.find({
                collection: 'membership-tiers',
                where: { 'archivedPriceIds.priceId': { equals: priceId } },
                limit: 1,
                overrideAccess: true,
              })
              tierDocs = byArchived.docs
            } catch {
              // Best-effort — skip tier update if lookup fails
            }
          }
        }
        if (tierDocs[0]) newTierId = tierDocs[0].id
      }

      await payload.update({
        collection: 'members',
        id: member.id,
        data: {
          status: bucketFromStripeStatus(sub.status),
          stripeSubscriptionStatus: sub.status,
          ...(sub.current_period_end
            ? { currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString() }
            : {}),
          ...(newTierId !== undefined ? { tier: newTierId } : {}),
        },
        overrideAccess: true,
      })
      return
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as unknown as SubscriptionLike
      const found = await payload.find({
        collection: 'members',
        where: { stripeSubscriptionId: { equals: sub.id } },
        limit: 1,
        overrideAccess: true,
      })
      const member = found.docs[0]
      if (!member) return

      await payload.update({
        collection: 'members',
        id: member.id,
        data: {
          status: 'inactive',
          stripeSubscriptionStatus: 'canceled',
          canceledAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
      return
    }

    default:
      // All other Stripe events are intentionally ignored.
      return
  }
}
