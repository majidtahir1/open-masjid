import type { DefaultServerCellComponentProps } from 'payload'
import { CheckCircle, Clock, X } from 'lucide-react'

/**
 * List-view cell for `form-submissions.status`.
 * Renders a colored pill with icon for new / reviewed / archived.
 */

const STATUS_CONFIG = {
  new: {
    label: 'New',
    icon: Clock,
    backgroundColor: 'rgba(20, 184, 166, 0.12)',
    color: '#0d9488',
    borderColor: 'rgba(20, 184, 166, 0.25)',
  },
  reviewed: {
    label: 'Reviewed',
    icon: CheckCircle,
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
    color: '#64748b',
    borderColor: 'rgba(100, 116, 139, 0.25)',
  },
  archived: {
    label: 'Archived',
    icon: X,
    backgroundColor: 'rgba(156, 163, 175, 0.10)',
    color: '#9ca3af',
    borderColor: 'rgba(156, 163, 175, 0.20)',
  },
} as const

type StatusValue = keyof typeof STATUS_CONFIG

export default function StatusCell({ cellData }: DefaultServerCellComponentProps) {
  const value = typeof cellData === 'string' ? (cellData as StatusValue) : 'new'
  const config = STATUS_CONFIG[value] ?? STATUS_CONFIG.new
  const Icon = config.icon

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
      <Icon size={10} strokeWidth={2.5} />
      {config.label}
    </span>
  )
}
