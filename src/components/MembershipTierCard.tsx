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
  const isFree = tier.amountCents === 0

  return (
    <div className="flex flex-col rounded-[var(--r-md)] border border-border bg-white p-8 shadow-sh-sm transition-shadow duration-base hover:shadow-sh-md">
      {/* Tier name */}
      <h2 className="mb-2 font-display text-[22px] font-semibold leading-snug text-fg1">
        {tier.name}
      </h2>

      {/* Price */}
      <div className="mb-6 flex items-baseline gap-1">
        {isFree ? (
          <span className="font-display text-[36px] font-medium leading-none text-brand">
            Free
          </span>
        ) : (
          <>
            <span className="font-display text-[36px] font-medium leading-none text-brand">
              {formatAmount(tier.amountCents)}
            </span>
            <span className="font-body text-fs-sm text-fg3">{cadenceLabel}</span>
          </>
        )}
      </div>

      {/* Description */}
      {tier.description ? (
        <div className="mb-8 grow">
          <RichText data={tier.description} />
        </div>
      ) : (
        <div className="mb-8 grow" />
      )}

      {/* CTA — paid tiers post to Stripe Checkout; free tiers collect
          name/email/phone inline and post to the local signup endpoint. */}
      {isFree ? (
        <form action="/api/membership/signup" method="post" className="flex flex-col gap-3">
          <input type="hidden" name="tierId" value={String(tier.id)} />
          <input
            type="text"
            name="name"
            required
            placeholder="Full name"
            autoComplete="name"
            className="rounded-[var(--r-md)] border border-border bg-white px-4 py-3 font-body text-fs-base text-fg1 placeholder:text-fg3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <input
            type="email"
            name="email"
            required
            placeholder="Email address"
            autoComplete="email"
            className="rounded-[var(--r-md)] border border-border bg-white px-4 py-3 font-body text-fs-base text-fg1 placeholder:text-fg3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <input
            type="tel"
            name="phone"
            placeholder="Phone (optional)"
            autoComplete="tel"
            className="rounded-[var(--r-md)] border border-border bg-white px-4 py-3 font-body text-fs-base text-fg1 placeholder:text-fg3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <button
            type="submit"
            className="mt-1 w-full rounded-[var(--r-md)] bg-brand px-8 py-[14px] font-body text-[17px] font-semibold text-white shadow-sh-sm transition-all duration-base ease-out hover:-translate-y-px hover:bg-brand-hover hover:shadow-sh-md"
          >
            Join for free
          </button>
        </form>
      ) : (
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
      )}
    </div>
  )
}
