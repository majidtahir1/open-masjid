import type Stripe from 'stripe'
import { relationshipId, tenantIdForConnectedAccount } from './stripe-connect-binding'
import { materializeStudentsFromSubmission } from '@/hooks/createStudentFromRegistration'

interface PayloadLike {
  find: (args: any) => Promise<{ docs: any[] }>
  findByID: (args: any) => Promise<any>
  create: (args: any) => Promise<any>
  update: (args: any) => Promise<any>
  logger?: { error?: (...a: any[]) => void; warn?: (...a: any[]) => void }
}

/** Minimal subscription shape required by the webhook handler. */
interface SubscriptionLike {
  id: string
  status: string
  current_period_end?: number
}

/**
 * Map a Stripe subscription status to the ProgramSubscriptions `status` enum
 * (active | past_due | canceled). Mirrors the membership status bucketing but
 * uses the tuition collection's three states.
 */
function bucketFromTuitionStatus(stripeStatus: string | null | undefined): 'active' | 'past_due' | 'canceled' {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    default:
      return 'canceled'
  }
}

/**
 * Handle Stripe Connect tuition events on the connected-account layer.
 *
 * Security (mirrors handleMembershipEvent, CWE-639): every write is attributed
 * by the connected account that produced the event (`event.account`) mapped to
 * a tenant via `tenantIdForConnectedAccount`. The attacker-controllable
 * `metadata.tenantId` must MATCH that owner, otherwise the event is dropped
 * with no writes. Idempotency: program-subscriptions are keyed by
 * `stripeSubscriptionId`; a duplicate `checkout.session.completed` only updates
 * the existing row's status and never re-creates students.
 *
 * On `checkout.session.completed`: create the family program-subscription, then
 * materialize the registration's students linked to it. On
 * `customer.subscription.updated|deleted`: update the row's status/period only —
 * enrollment changes are manual per the tuition spec.
 */
export async function handleTuitionEvent(
  event: Stripe.Event & { account?: string },
  payload: PayloadLike,
  /** Parameterised so tests can mock without a real Stripe client. */
  stripeSubscriptionRetrieve?: (id: string, account: string) => Promise<SubscriptionLike>,
): Promise<void> {
  const account = event.account
  if (!account) return

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const md = (session.metadata ?? {}) as Record<string, string>
      if (md.kind !== 'tuition') return

      const tenantId = Number(md.tenantId)
      if (!tenantId || !md.submissionId) return

      // --- Connect attribution binding (CWE-639) ---
      // Attribute by the connected account that produced the event, never by
      // metadata alone. Require: a tenant owns this account AND the metadata
      // tenantId matches that owner.
      const accountTenantId = await tenantIdForConnectedAccount(payload, account)
      if (accountTenantId === null || accountTenantId !== tenantId) {
        payload.logger?.warn?.(
          { account, claimedTenantId: md.tenantId, accountTenantId },
          'handleTuitionEvent: dropping checkout — account/tenant binding mismatch',
        )
        return
      }

      // Extract subscription id — may be a string or an expanded object.
      const subId =
        typeof session.subscription === 'string'
          ? session.subscription
          : (session.subscription as Stripe.Subscription | null)?.id ?? null
      if (!subId) return

      // Idempotency: if a row already exists for this subscription, update its
      // status only and return — never re-create students for a duplicate.
      const existing = await payload.find({
        collection: 'program-subscriptions',
        where: { stripeSubscriptionId: { equals: subId } },
        limit: 1,
        overrideAccess: true,
      })
      if (existing.docs[0]) {
        const sub: SubscriptionLike = stripeSubscriptionRetrieve
          ? await stripeSubscriptionRetrieve(subId, account)
          : { id: subId, status: 'active', current_period_end: Math.floor(Date.now() / 1000) }
        await payload.update({
          collection: 'program-subscriptions',
          id: existing.docs[0].id,
          data: {
            status: bucketFromTuitionStatus(sub.status),
            stripeSubscriptionStatus: sub.status,
            ...(sub.current_period_end
              ? { currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString() }
              : {}),
          },
          overrideAccess: true,
        })
        return
      }

      // Retrieve subscription to get status + current_period_end.
      const sub: SubscriptionLike = stripeSubscriptionRetrieve
        ? await stripeSubscriptionRetrieve(subId, account)
        : { id: subId, status: 'active', current_period_end: Math.floor(Date.now() / 1000) }

      const email =
        session.customer_email ??
        (session.customer_details as { email?: string | null } | null)?.email ??
        ''
      const customerId =
        typeof session.customer === 'string'
          ? session.customer
          : (session.customer as Stripe.Customer | Stripe.DeletedCustomer | null)?.id ?? null

      const programId = md.programId ? Number(md.programId) : null

      const created = await payload.create({
        collection: 'program-subscriptions',
        data: {
          tenant: tenantId,
          guardianEmail: email,
          ...(programId ? { program: programId } : {}),
          stripeCustomerId: customerId,
          stripeSubscriptionId: subId,
          stripeSubscriptionStatus: sub.status,
          status: bucketFromTuitionStatus(sub.status),
          ...(sub.current_period_end
            ? { currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString() }
            : {}),
        },
        overrideAccess: true,
      })

      // Materialize the registration's students now that payment succeeded,
      // linking each to the family subscription.
      let submission: any = null
      try {
        submission = await payload.findByID({
          collection: 'form-submissions',
          id: md.submissionId,
          depth: 0,
          overrideAccess: true,
        })
      } catch {
        submission = null
      }
      if (submission) {
        await materializeStudentsFromSubmission(payload, submission, {
          programSubscriptionId: created.id,
        })
      }
      return
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as unknown as SubscriptionLike
      const found = await payload.find({
        collection: 'program-subscriptions',
        where: { stripeSubscriptionId: { equals: sub.id } },
        limit: 1,
        overrideAccess: true,
      })
      const row = found.docs[0]
      if (!row) return
      // Bind the event's connected account to the row's tenant.
      const updatedAccountTenantId = await tenantIdForConnectedAccount(payload, account)
      if (updatedAccountTenantId === null || relationshipId(row.tenant) !== updatedAccountTenantId) return

      await payload.update({
        collection: 'program-subscriptions',
        id: row.id,
        data: {
          status: bucketFromTuitionStatus(sub.status),
          stripeSubscriptionStatus: sub.status,
          ...(sub.current_period_end
            ? { currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString() }
            : {}),
        },
        overrideAccess: true,
      })
      return
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as unknown as SubscriptionLike
      const found = await payload.find({
        collection: 'program-subscriptions',
        where: { stripeSubscriptionId: { equals: sub.id } },
        limit: 1,
        overrideAccess: true,
      })
      const row = found.docs[0]
      if (!row) return
      // Bind the event's connected account to the row's tenant.
      const deletedAccountTenantId = await tenantIdForConnectedAccount(payload, account)
      if (deletedAccountTenantId === null || relationshipId(row.tenant) !== deletedAccountTenantId) return

      await payload.update({
        collection: 'program-subscriptions',
        id: row.id,
        data: {
          status: 'canceled',
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
