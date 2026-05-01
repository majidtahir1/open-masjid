import type { DefaultServerCellComponentProps } from 'payload'
import { ExternalLink } from 'lucide-react'

/**
 * List-view cell for `donations.stripePaymentIntentId`. Renders the PI id as a
 * deep-link into the connected account's Stripe dashboard so the admin can
 * see donor identity, refund, etc.
 */
export default function StripePaymentIntentCell({
  cellData,
  rowData,
}: DefaultServerCellComponentProps) {
  const pi = typeof cellData === 'string' ? cellData : null
  const acct = (rowData as { stripeAccountId?: string })?.stripeAccountId
  if (!pi || !acct) return <span>{pi ?? '—'}</span>
  const href = `https://dashboard.stripe.com/${acct}/payments/${pi}`
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
    >
      <span>{pi}</span>
      <ExternalLink size={12} strokeWidth={1.75} />
    </a>
  )
}
