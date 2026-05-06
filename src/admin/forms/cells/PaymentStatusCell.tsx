import type { DefaultServerCellComponentProps } from 'payload'
import { CheckCircle, Clock, X } from 'lucide-react'

/**
 * List-view cell for `form-submissions.paymentStatus`.
 * Renders a colored pill with icon for na / pending_payment / paid / expired.
 */

const PAYMENT_CONFIG = {
  na: {
    label: '—',
    icon: null,
    backgroundColor: 'transparent',
    color: 'var(--theme-elevation-400)',
    borderColor: 'transparent',
  },
  pending_payment: {
    label: 'Pending',
    icon: Clock,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    color: '#d97706',
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  paid: {
    label: 'Paid',
    icon: CheckCircle,
    backgroundColor: 'rgba(20, 184, 166, 0.12)',
    color: '#0d9488',
    borderColor: 'rgba(20, 184, 166, 0.25)',
  },
  expired: {
    label: 'Expired',
    icon: X,
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    color: '#ef4444',
    borderColor: 'rgba(239, 68, 68, 0.20)',
  },
} as const

type PaymentStatusValue = keyof typeof PAYMENT_CONFIG

export default function PaymentStatusCell({ cellData }: DefaultServerCellComponentProps) {
  const value = typeof cellData === 'string' ? (cellData as PaymentStatusValue) : 'na'
  const config = PAYMENT_CONFIG[value] ?? PAYMENT_CONFIG.na

  if (value === 'na') {
    return <span style={{ color: 'var(--theme-elevation-400)' }}>—</span>
  }

  const Icon = config.icon as React.ElementType | null

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        borderRadius: 10,
        padding: '3px 8px',
        whiteSpace: 'nowrap',
        backgroundColor: config.backgroundColor,
        color: config.color,
        border: `1px solid ${config.borderColor}`,
      }}
    >
      {Icon && <Icon size={10} strokeWidth={2.5} />}
      {config.label}
    </span>
  )
}
