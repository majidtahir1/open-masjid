/**
 * Public /membership page.
 *
 * Renders active, Stripe-synced membership tiers in a responsive card grid.
 * Shows a placeholder when Stripe Connect is not yet enabled or no tiers exist.
 */

import { getCurrentTenant } from '@/lib/tenant-server'
import { fetchActiveTiers } from '@/lib/data'
import MembershipTierCard, { type MembershipTier } from '@/components/MembershipTierCard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = { title: 'Membership' }

export default async function MembershipPage() {
  const tenant = await getCurrentTenant()
  if (!tenant) return null

  // stripeChargesEnabled lives under donationConfig per the real Tenant shape.
  // We duck-type both the real shape and flattened test shapes (mirrors the
  // getTenantStripeInfo helper in MembershipTiers.hooks.ts).
  const dc = (tenant as { donationConfig?: { stripeChargesEnabled?: boolean | null } }).donationConfig
  const stripeChargesEnabled =
    (tenant as { stripeChargesEnabled?: boolean | null }).stripeChargesEnabled === true ||
    dc?.stripeChargesEnabled === true

  // Free tiers don't require Stripe Connect, so we always fetch — the
  // public list will include free tiers even if Stripe Connect isn't yet
  // enabled. The fetch helper itself surfaces both paid (synced) and
  // free (amountCents === 0) active tiers.
  const rawTiers = await fetchActiveTiers(tenant)

  function parseTier(doc: unknown): MembershipTier | null {
    const d = doc as {
      id?: unknown
      name?: unknown
      description?: unknown
      amountCents?: unknown
      cadence?: unknown
    }
    if (
      (typeof d.id !== 'string' && typeof d.id !== 'number') ||
      typeof d.name !== 'string' ||
      typeof d.amountCents !== 'number' ||
      (d.cadence !== 'monthly' && d.cadence !== 'yearly')
    ) {
      return null
    }
    const tier: MembershipTier = {
      id: d.id,
      name: d.name,
      amountCents: d.amountCents,
      cadence: d.cadence,
    }
    if (d.description !== undefined) {
      tier.description = d.description
    }
    return tier
  }

  const tiers: MembershipTier[] = rawTiers
    .map(parseTier)
    .filter((t): t is MembershipTier => t !== null)

  return (
    <>
      <section className="py-20">
        <div className="mx-auto max-w-[820px] px-6 text-center">
          <div className="mb-5 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
            Join the community
          </div>
          <h1 className="mb-4 font-display text-[56px] font-medium leading-[1.06] tracking-tight text-fg1">
            Membership
          </h1>
          <p className="m-0 mb-10 text-[18px] leading-relaxed text-fg2">
            Support {tenant.name ?? 'our masjid'} with a recurring membership and
            help sustain programs, services, and the community for everyone.
          </p>
        </div>
      </section>

      <section className="pb-24">
        <div className="mx-auto max-w-[1120px] px-6">
          {tiers.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tiers.map((tier) => (
                <MembershipTierCard key={String(tier.id)} tier={tier} />
              ))}
            </div>
          ) : (
            /* No active tiers (paid or free) — generic placeholder */
            <div className="mx-auto max-w-[480px] rounded-[var(--r-md)] border border-border bg-white p-8 text-center shadow-sh-sm">
              <p className="m-0 font-body text-fs-base text-fg2">
                {stripeChargesEnabled
                  ? 'No membership tiers are configured yet. Check back soon.'
                  : 'Online membership is not yet available. Please contact the masjid directly to become a member.'}
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
