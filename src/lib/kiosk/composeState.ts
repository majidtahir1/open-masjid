import type { Payload } from 'payload'
import { PRAYER_CONTENT_SEEDS, type ContentEntry } from './prayerContentSeeds'

export type SlideType = 'carousel' | 'sponsor' | 'weekly-events'

export interface NormalizedSlide {
  id: string
  type: SlideType
  active: boolean
  priority: number
  startDate: string | null
  endDate: string | null
  updatedAt: string
  durationMs: number
  payload: Record<string, unknown>
}

export function filterAndSortSlides(
  slides: NormalizedSlide[],
  now: Date,
  overrideIds: string[] | null,
): NormalizedSlide[] {
  const ms = now.getTime()
  const overrideSet = overrideIds ? new Set(overrideIds) : null
  return slides
    .filter((s) => s.active)
    .filter((s) => !s.startDate || new Date(s.startDate).getTime() <= ms)
    .filter((s) => !s.endDate || new Date(s.endDate).getTime() >= ms)
    .filter((s) => !overrideSet || overrideSet.has(s.id))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    })
}

export interface KioskState {
  tenant: { id: string; name: string; logo: string | null; timezone: string }
  prayerTimes: Record<string, unknown> | null
  slides: NormalizedSlide[]
  version: string
  pollIntervalMs: number
}

export function resolveContentPool(docs: any[]): ContentEntry[] {
  const active = docs
    .filter((d) => d?.active)
    .map((d) => ({
      id: String(d.id),
      kind: d.kind,
      arabic: d.arabic ?? '',
      english: d.english ?? '',
      citation: d.citation ?? '',
    })) as ContentEntry[]
  return active.length > 0 ? active : PRAYER_CONTENT_SEEDS
}

export async function composeKioskState(args: {
  payload: Payload
  tenantId: string
  now: Date
  overrideIds: string[] | null
  broadcastAt: string | null
  pushAt: string | null
}): Promise<{
  slides: NormalizedSlide[]
  tenant: KioskState['tenant']
  contentPool: ContentEntry[]
  contentUpdatedAts: string[]
}> {
  const { payload, tenantId, now, overrideIds } = args

  const [carousel, sponsors, weekly, tenantDoc, content] = await Promise.all([
    payload.find({
      collection: 'carousel-slides',
      where: { tenant: { equals: tenantId } },
      limit: 200,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'sponsor-slides',
      where: { tenant: { equals: tenantId } },
      limit: 200,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'weekly-events-slides',
      where: { tenant: { equals: tenantId } },
      limit: 50,
      overrideAccess: true,
    }),
    payload.findByID({ collection: 'tenants', id: tenantId, overrideAccess: true }),
    payload.find({
      collection: 'prayer-display-content',
      where: { tenant: { equals: tenantId } },
      limit: 200,
      overrideAccess: true,
    }),
  ])

  const normalize =
    (type: SlideType) =>
    (doc: any): NormalizedSlide => ({
      id: String(doc.id),
      type,
      active: Boolean(doc.active),
      priority: Number(doc.priority ?? 5),
      startDate: doc.startDate ?? null,
      endDate: doc.endDate ?? null,
      updatedAt: doc.updatedAt ?? new Date(0).toISOString(),
      durationMs: Number(doc.displayDurationMs ?? 10000),
      payload: doc,
    })

  const all: NormalizedSlide[] = [
    ...carousel.docs.map(normalize('carousel')),
    ...sponsors.docs.map(normalize('sponsor')),
    ...weekly.docs.map(normalize('weekly-events')),
  ]

  const slides = filterAndSortSlides(all, now, overrideIds)

  const t = tenantDoc as any
  const tenant: KioskState['tenant'] = {
    id: String(t.id),
    name: t.name ?? '',
    logo: t.logo ?? null,
    timezone: t.timezone ?? 'UTC',
  }

  const contentPool = resolveContentPool(content.docs)
  const contentUpdatedAts = content.docs.map((d: any) => d.updatedAt ?? '')

  return { slides, tenant, contentPool, contentUpdatedAts }
}
