/**
 * KiosksListBanner
 *
 * Rendered above the Kiosks list view via `admin.components.beforeListTable`.
 * Server component that tallies kiosk counts by status for the current tenant
 * (platform-wide for platformOwner) and shows them as a row of stat cards in
 * the same visual language as the admin dashboard.
 */

import Link from 'next/link'
import { Monitor, Wifi, WifiOff, Wrench, KeySquare } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getAdminUser } from '@/lib/admin-context'

type Status = 'ONLINE' | 'OFFLINE' | 'UNPAIRED' | 'MAINTENANCE'

const META: Record<
  Status,
  {
    label: string
    Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
    tone: string
    iconBg: string
  }
> = {
  ONLINE: {
    label: 'Online',
    Icon: Wifi,
    tone: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
  },
  OFFLINE: {
    label: 'Offline',
    Icon: WifiOff,
    tone: 'text-rose-600',
    iconBg: 'bg-rose-100',
  },
  UNPAIRED: {
    label: 'Unpaired',
    Icon: KeySquare,
    tone: 'text-muted-foreground',
    iconBg: 'bg-muted',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    Icon: Wrench,
    tone: 'text-amber-600',
    iconBg: 'bg-amber-100',
  },
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
        return payload.count({ collection: 'kiosks', where, overrideAccess: true })
      }),
    )

    const total = counts.reduce((a, b) => a + b.totalDocs, 0)

    if (total === 0) {
      return (
        <Card className="mb-6 border-dashed">
          <CardContent className="flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div className="flex items-start gap-4">
              <span className="grid size-12 place-items-center rounded-xl bg-secondary/10 text-secondary">
                <Monitor className="size-6" aria-hidden />
              </span>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-foreground">No kiosks paired yet</p>
                <p className="text-sm text-muted-foreground max-w-md">
                  Add a Kiosk record, then open <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/kiosk</code>{' '}
                  on a TV / Fire Stick / Raspberry Pi and type its 6-character code here to pair.
                </p>
              </div>
            </div>
            <Button asChild>
              <Link href="/admin/collections/kiosks/create">Add Kiosk</Link>
            </Button>
          </CardContent>
        </Card>
      )
    }

    return (
      <section className="mb-6 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fleet status
          </h2>
          <Badge variant="secondary" className="text-xs">
            {total} total
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {statuses.map((s, i) => {
            const n = counts[i].totalDocs
            const m = META[s]
            const Icon = m.Icon
            return (
              <Card key={s} className="overflow-hidden">
                <CardContent className="flex items-center gap-3 p-4">
                  <span className={`grid size-10 place-items-center rounded-lg ${m.iconBg} ${m.tone}`}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-foreground leading-none">{n}</p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {m.label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>
    )
  } catch {
    return null
  }
}
