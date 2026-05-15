/**
 * KiosksListBanner
 *
 * Rendered above the Kiosks list view via `admin.components.beforeListTable`.
 * Server component that tallies kiosk counts by status for the current tenant
 * (or platform-wide for the platformOwner) and shows them as inline stat
 * cards — Online / Offline / Unpaired / Maintenance.
 */

import { getAdminUser } from '@/lib/admin-context'

type Status = 'ONLINE' | 'OFFLINE' | 'UNPAIRED' | 'MAINTENANCE'

const META: Record<
  Status,
  { label: string; dot: string; fg: string; bg: string }
> = {
  ONLINE:      { label: 'Online',      dot: '#16a34a', fg: '#14532d', bg: '#dcfce7' },
  OFFLINE:     { label: 'Offline',     dot: '#dc2626', fg: '#7f1d1d', bg: '#fee2e2' },
  UNPAIRED:    { label: 'Unpaired',    dot: '#6b7280', fg: '#374151', bg: '#f3f4f6' },
  MAINTENANCE: { label: 'Maintenance', dot: '#d97706', fg: '#78350f', bg: '#fef3c7' },
}

export default async function KiosksListBanner() {
  try {
    const { payload, user } = await getAdminUser()
    if (!user) return null

    const tenantRef = (user as { tenant?: unknown }).tenant
    const tenantId =
      typeof tenantRef === 'object' && tenantRef !== null && 'id' in tenantRef
        ? (tenantRef as { id: string | number }).id
        : (tenantRef as string | number | undefined)

    const statuses: Status[] = ['ONLINE', 'OFFLINE', 'UNPAIRED', 'MAINTENANCE']
    const counts = await Promise.all(
      statuses.map((s) => {
        const where: any = { status: { equals: s } }
        if (tenantId) where.tenant = { equals: tenantId }
        return payload.count({
          collection: 'kiosks',
          where,
          overrideAccess: true,
        })
      }),
    )

    const totalCount = counts.reduce((a, b) => a + b.totalDocs, 0)
    if (totalCount === 0) {
      return (
        <div
          role="status"
          style={{
            margin: '0 0 20px 0',
            padding: '16px 20px',
            borderRadius: 10,
            background: '#e0e7ff',
            borderLeft: '5px solid #4f46e5',
            color: '#312e81',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          No kiosks registered yet. Click <strong>Create New</strong> to add a kiosk record, then
          open <code>/kiosk</code> on the display and type its code here.
        </div>
      )
    }

    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          margin: '0 0 20px 0',
        }}
      >
        {statuses.map((s, i) => {
          const n = counts[i].totalDocs
          if (n === 0) return null
          const m = META[s]
          return (
            <div
              key={s}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                borderRadius: 10,
                background: m.bg,
                color: m.fg,
                fontSize: 13,
                fontWeight: 600,
                lineHeight: 1.1,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: m.dot,
                  flex: 'none',
                }}
              />
              <span style={{ fontSize: 18, fontWeight: 700 }}>{n}</span>
              <span style={{ opacity: 0.85 }}>{m.label}</span>
            </div>
          )
        })}
      </div>
    )
  } catch {
    return null
  }
}
