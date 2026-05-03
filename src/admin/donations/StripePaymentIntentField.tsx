'use client'

import { useField, FieldLabel } from '@payloadcms/ui'
import { ExternalLink } from 'lucide-react'

/**
 * Detail-view field for `donations.stripePaymentIntentId`. Renders the PI id
 * as a clickable deep-link into the connected account's Stripe dashboard.
 */
export default function StripePaymentIntentField({
  path = 'stripePaymentIntentId',
}: { path?: string }) {
  const { value: pi } = useField<string>({ path })
  const { value: acct } = useField<string>({ path: 'stripeAccountId' })
  const href = pi && acct ? `https://dashboard.stripe.com/${acct}/payments/${pi}` : null
  return (
    <div className="field-type text read-only">
      <FieldLabel label="Stripe Payment Intent ID" path={path} />
      <div
        style={{
          padding: '10px 12px',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 4,
          background: 'var(--theme-elevation-50)',
          color: 'var(--theme-elevation-800)',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span>{pi}</span>
            <ExternalLink size={14} strokeWidth={1.75} />
          </a>
        ) : (
          <span>{pi ?? '—'}</span>
        )}
      </div>
      <p style={{ marginTop: 6, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
        Opens the payment in the connected account&rsquo;s Stripe dashboard, where you
        can see donor identity, refund, or download the receipt.
      </p>
    </div>
  )
}
