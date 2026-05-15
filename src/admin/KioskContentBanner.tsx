/**
 * Shared list-view banner for kiosk content collections (CarouselSlides,
 * SponsorSlides, WeeklyEventsSlides, QRCodes). Surfaces an active/inactive
 * tally + a friendly hint about save-driven auto-broadcast.
 *
 * Exports per-collection thin wrappers so each collection's
 * admin.components.beforeListTable points at its own default-exported file.
 */

import { LayoutGrid, ShoppingBag, CalendarClock, QrCode, Sparkles, Plus } from 'lucide-react'
import Link from 'next/link'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getAdminUser } from '@/lib/admin-context'

type CollectionSlug =
  | 'carousel-slides'
  | 'sponsor-slides'
  | 'weekly-events-slides'
  | 'qr-codes'

const META: Record<
  CollectionSlug,
  {
    title: string
    blurb: string
    Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
    accent: string
    iconBg: string
    activeField: 'active' | null
  }
> = {
  'carousel-slides': {
    title: 'Carousel Slides',
    blurb:
      'Rotating slides shown on every kiosk. Drop in an image, a title, or an Islamic-themed background. Saving auto-broadcasts to all displays in seconds.',
    Icon: LayoutGrid,
    accent: 'text-secondary',
    iconBg: 'bg-secondary/10',
    activeField: 'active',
  },
  'sponsor-slides': {
    title: 'Sponsor Slides',
    blurb:
      'Branded sponsor / advertiser slides with four layout templates and brand-color theming. Saving auto-broadcasts.',
    Icon: ShoppingBag,
    accent: 'text-amber-600',
    iconBg: 'bg-amber-100',
    activeField: 'active',
  },
  'weekly-events-slides': {
    title: 'Weekly Events',
    blurb:
      'A recurring weekly schedule grid — Mondays, Tuesdays, Jumuah, etc. One entry per day per class.',
    Icon: CalendarClock,
    accent: 'text-indigo-600',
    iconBg: 'bg-indigo-100',
    activeField: 'active',
  },
  'qr-codes': {
    title: 'QR Codes',
    blurb:
      'Reusable QR-code library. Generate once with a URL + colors, then attach to any carousel or sponsor slide for congregants to scan.',
    Icon: QrCode,
    accent: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
    activeField: null,
  },
}

async function Banner({ slug }: { slug: CollectionSlug }) {
  try {
    const { payload, user } = await getAdminUser()
    if (!user) return null

    const tenantRef = (user as { tenant?: unknown }).tenant
    const tenantId =
      typeof tenantRef === 'object' && tenantRef !== null && 'id' in tenantRef
        ? (tenantRef as { id: string | number }).id
        : (tenantRef as string | number | undefined)

    const meta = META[slug]

    const baseWhere: any = {}
    if (tenantId) baseWhere.tenant = { equals: tenantId }

    const [totalRes, activeRes] = await Promise.all([
      payload.count({ collection: slug as never, where: baseWhere, overrideAccess: true }),
      meta.activeField
        ? payload.count({
            collection: slug as never,
            where: { ...baseWhere, [meta.activeField]: { equals: true } },
            overrideAccess: true,
          })
        : Promise.resolve({ totalDocs: 0 }),
    ])

    const total = totalRes.totalDocs
    const active = activeRes.totalDocs
    const Icon = meta.Icon

    return (
      <Card className="mb-6 overflow-hidden">
        <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="flex items-start gap-4">
            <span className={`grid size-12 place-items-center rounded-xl ${meta.iconBg} ${meta.accent} shrink-0`}>
              <Icon className="size-6" aria-hidden />
            </span>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-foreground">{meta.title}</h2>
                <Badge variant="secondary" className="text-xs font-semibold">
                  {total} total
                </Badge>
                {meta.activeField && (
                  <Badge
                    variant="secondary"
                    className="bg-emerald-100 text-emerald-700 text-xs font-semibold"
                  >
                    {active} active
                  </Badge>
                )}
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">{meta.blurb}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="size-3 text-secondary" aria-hidden />
                Changes auto-broadcast to every paired kiosk on save.
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0 self-start md:self-auto">
            <Link href={`/admin/collections/${slug}/create`}>
              <Plus aria-hidden />
              New {meta.title.replace(/s$/, '')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  } catch {
    return null
  }
}

export async function CarouselSlidesBanner() {
  return <Banner slug="carousel-slides" />
}

export async function SponsorSlidesBanner() {
  return <Banner slug="sponsor-slides" />
}

export async function WeeklyEventsSlidesBanner() {
  return <Banner slug="weekly-events-slides" />
}

export async function QRCodesBanner() {
  return <Banner slug="qr-codes" />
}
