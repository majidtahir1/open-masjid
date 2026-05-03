import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

/**
 * Back-link used at the top of donation-funds and donations admin views.
 * Provides explicit navigation back to the Donations Overview hub since
 * those collections are intentionally absent from the sidebar.
 */
export default function BackToOverview() {
  return (
    <div style={{ marginBottom: 16 }}>
      <Link
        href="/admin/donations/overview"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 13,
          color: 'var(--theme-elevation-600)',
          textDecoration: 'none',
        }}
      >
        <ChevronLeft size={14} strokeWidth={1.75} />
        <span>Back to Donations Overview</span>
      </Link>
    </div>
  )
}
