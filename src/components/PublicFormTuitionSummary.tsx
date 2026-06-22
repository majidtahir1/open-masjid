/**
 * PublicFormTuitionSummary — read-only tuition breakdown shown on the last step
 * of a paid registration form, in place of the legacy donation block.
 *
 * It mirrors the server's pricing (src/lib/tuition-pricing.ts) so the figure the
 * guardian sees matches what Stripe will charge. The authoritative amount is
 * still recomputed server-side at submit; this is display only.
 */
import {
  computeSiblingDiscount,
  participantPricesCents,
  type DiscountTier,
  type PricingContext,
} from '@/lib/tuition-pricing'
import { formatCents } from '@/lib/money'

export interface SummaryParticipant {
  /** Display name, e.g. the child's first+last name (falls back to "Child 1"). */
  label: string
  /** Selected class id for per-class pricing; null/undefined for per-program. */
  classId?: string | null
}

interface Props {
  paymentModel: 'monthly' | 'one-time'
  pricingModel: 'per-program' | 'per-class'
  programTuitionCents: number
  classPrices: Record<string, number>
  tiers: DiscountTier[]
  participants: SummaryParticipant[]
  currency?: string
}

export function PublicFormTuitionSummary({
  paymentModel,
  pricingModel,
  programTuitionCents,
  classPrices,
  tiers,
  participants,
  currency = 'usd',
}: Props) {
  const ctx: PricingContext = { pricingModel, programTuitionCents, classPrices }
  const base = participantPricesCents(
    participants.map((p) => ({ class: p.classId })),
    ctx,
  )
  const discounted = computeSiblingDiscount(base, tiers)
  const total = discounted.reduce((sum, c) => sum + c, 0)

  const suffix = paymentModel === 'monthly' ? '/mo' : ''
  const periodLabel = paymentModel === 'monthly' ? 'Billed monthly' : 'One-time payment'

  return (
    <div className="om-pf-tuition" aria-live="polite">
      <div className="om-pf-tuition-head">
        <span className="om-pf-tuition-title">Tuition summary</span>
        <span className="om-pf-tuition-period">{periodLabel}</span>
      </div>

      <ul className="om-pf-tuition-lines">
        {participants.map((p, i) => {
          const full = base[i]
          const net = discounted[i]
          const hasDiscount = net < full
          return (
            <li key={i} className="om-pf-tuition-line">
              <span className="om-pf-tuition-line-label">
                {p.label}
                {hasDiscount && <span className="om-pf-tuition-badge">sibling discount</span>}
              </span>
              <span className="om-pf-tuition-line-amount">
                {hasDiscount && (
                  <span className="om-pf-tuition-strike">{formatCents(full, currency)}</span>
                )}
                <span>
                  {formatCents(net, currency)}
                  {suffix}
                </span>
              </span>
            </li>
          )
        })}
      </ul>

      <div className="om-pf-tuition-total">
        <span>Total</span>
        <span>
          {formatCents(total, currency)}
          {suffix}
        </span>
      </div>

      <p className="om-pf-tuition-note">
        You&apos;ll be taken to <strong>Stripe</strong> to complete payment. Your registration is
        held until payment succeeds.
      </p>
    </div>
  )
}
