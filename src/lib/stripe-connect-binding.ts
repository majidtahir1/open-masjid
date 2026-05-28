/**
 * Shared authorization binding for Stripe Connect webhooks.
 *
 * Connect events carry `event.account` — the connected account that actually
 * produced the event. That value is trustworthy (Stripe signs the event with
 * the platform Connect secret and sets `account` itself). The `metadata`
 * tenant/fund/tier ids, by contrast, are attacker-controllable: any connected
 * account can create a Stripe object in its OWN account carrying another
 * tenant's ids. So a webhook must attribute writes by mapping `event.account`
 * back to the tenant that configured it — never by trusting metadata alone.
 */

interface PayloadFindLike {
  // Loosely typed so both the real Payload client and lightweight test mocks
  // satisfy it (Payload's `find` is a generic overload keyed on collection slug).
  find: (args: any) => Promise<{ docs: any[] }>
}

/**
 * Extract a relationship's numeric id whether it's stored as a scalar id
 * (string/number) or a populated `{ id }` object. Returns null if absent or
 * non-numeric.
 */
export function relationshipId(rel: unknown): number | null {
  if (rel == null) return null
  if (typeof rel === 'number') return Number.isFinite(rel) ? rel : null
  if (typeof rel === 'string') {
    const n = Number(rel)
    return Number.isFinite(n) ? n : null
  }
  if (typeof rel === 'object' && 'id' in rel) {
    const n = Number((rel as { id: unknown }).id)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Resolve the tenant that owns a Stripe Connect account id, or null if no
 * tenant has that account configured. This is the authoritative mapping from
 * `event.account` → tenant for Connect webhook attribution.
 */
export async function tenantIdForConnectedAccount(
  payload: PayloadFindLike,
  account: string | null | undefined,
): Promise<number | null> {
  if (!account) return null
  const { docs } = await payload.find({
    collection: 'tenants',
    where: { 'donationConfig.stripeAccountId': { equals: account } },
    limit: 1,
    overrideAccess: true,
  })
  return docs[0] ? Number(docs[0].id) : null
}
