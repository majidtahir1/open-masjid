import Link from 'next/link'

/**
 * Renders inside the Billing tab on the tenant edit page (Site Settings →
 * Billing). The actual billing UI (plan switching, payment method, invoices,
 * cancel) lives at /admin/billing — this tab is just the access point.
 *
 * All the underlying billing fields on the tenant collection are
 * `admin.hidden: true` (they're internal state synced from Stripe webhooks);
 * the tab would otherwise render empty.
 */
export default function BillingTabIntro() {
  return (
    <div style={{ padding: '12px 0' }}>
      <h3 style={{ margin: 0, marginBottom: 8, fontSize: 18, fontWeight: 600 }}>
        Subscription & billing
      </h3>
      <p
        style={{
          margin: 0,
          marginBottom: 16,
          color: 'var(--theme-elevation-600)',
          fontSize: 14,
          lineHeight: 1.5,
          maxWidth: 560,
        }}
      >
        View your current plan, switch between monthly and annual, update your
        payment method, download invoices, or cancel — all in the dedicated
        billing page.
      </p>
      <Link
        href="/admin/billing"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 16px',
          borderRadius: 4,
          background: 'var(--theme-elevation-800)',
          color: 'var(--theme-elevation-0)',
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Manage billing
        <span aria-hidden>→</span>
      </Link>
    </div>
  )
}
