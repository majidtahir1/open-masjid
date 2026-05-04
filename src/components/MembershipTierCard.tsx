/**
 * MembershipTierCard — server component.
 *
 * Renders a single membership tier as a card with:
 *   - tier name
 *   - rich-text description (via the existing <RichText> renderer)
 *   - formatted amount (cents → "$X") + cadence label ("/mo" or "/yr")
 *   - a native HTML <form> that POSTs to /api/membership/checkout
 */

import RichText from '@/components/RichText'

export interface MembershipTier {
  id: string | number
  name: string
  description?: unknown
  amountCents: number
  cadence: 'monthly' | 'yearly'
}

function formatAmount(cents: number): string {
  const dollars = Math.round(cents / 100)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars)
}

interface Props {
  tier: MembershipTier
}

export default function MembershipTierCard({ tier }: Props) {
  const cadenceLabel = tier.cadence === 'yearly' ? '/yr' : '/mo'

  return (
    <div className="flex flex-col rounded-[var(--r-md)] border border-border bg-white p-8 shadow-sh-sm transition-shadow duration-base hover:shadow-sh-md">
      {/* Tier name */}
      <h2 className="mb-2 font-display text-[22px] font-semibold leading-snug text-fg1">
        {tier.name}
      </h2>

      {/* Price */}
      <div className="mb-6 flex items-baseline gap-1">
        <span className="font-display text-[36px] font-medium leading-none text-brand">
          {formatAmount(tier.amountCents)}
        </span>
        <span className="font-body text-fs-sm text-fg3">{cadenceLabel}</span>
      </div>

      {/* Description */}
      {tier.description ? (
        <div className="mb-8 grow">
          <RichText data={tier.description} />
        </div>
      ) : (
        <div className="mb-8 grow" />
      )}

      {/* CTA — native POST form so no "use client" needed */}
      <form action="/api/membership/checkout" method="post">
        <input type="hidden" name="tierId" value={String(tier.id)} />
        <button
          type="submit"
          className="w-full rounded-[var(--r-md)] bg-brand px-8 py-[14px] font-body text-[17px] font-semibold text-white shadow-sh-sm transition-all duration-base ease-out hover:-translate-y-px hover:bg-brand-hover hover:shadow-sh-md"
        >
          Join — {formatAmount(tier.amountCents)}
          {cadenceLabel}
        </button>
      </form>
    </div>
  )
}
