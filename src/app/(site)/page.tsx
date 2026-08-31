import Hero from '@/components/Hero'
import EventsList from '@/components/EventsList'
import ServicesGrid from '@/components/ServicesGrid'
import DonateCTA from '@/components/DonateCTA'
import AnnouncementsBanner from '@/components/AnnouncementsBanner'
import type {
  AnnouncementLike,
  EventLike,
  HeroSlideLike,
  ServiceLike,
  TenantDonationConfig,
} from '@/components/types'
import { getCurrentTenant } from '@/lib/tenant-server'
import {
  fetchAnnouncements,
  fetchEvents,
  fetchFeaturedEvents,
  fetchFeaturedPages,
  fetchHeroSlides,
  fetchServices,
} from '@/lib/data'
import { eventToHeroSlide } from '@/lib/eventToHeroSlide'
import { pageToHeroSlide } from '@/lib/pageToHeroSlide'
import { getHeroLiveData } from '@/lib/getHeroLiveData'
import { getActiveSchedule } from '@/lib/prayer-schedule'
import { getRequestOrigin } from '@/lib/seo'
import MosqueJsonLd from './_components/MosqueJsonLd'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { Tenant } from '@/payload-types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type HomepageCopy = NonNullable<Tenant['homepageCopy']>

/** A tenant override counts only when it has visible characters. */
function nonBlank(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export default async function HomePage() {
  const tenant = await getCurrentTenant()
  if (!tenant) return null

  const [slides, featuredEvents, featuredPages, events, services, liveData, announcements, schedule, requestOrigin] =
    await Promise.all([
      fetchHeroSlides(tenant),
      fetchFeaturedEvents(tenant),
      fetchFeaturedPages(tenant),
      fetchEvents(tenant, { limit: 4, upcomingOnly: true }),
      fetchServices(tenant),
      getHeroLiveData(
        tenant.id,
        (tenant as { location?: { timezone?: string | null } }).location?.timezone ?? null,
      ),
      fetchAnnouncements(tenant),
      getActiveSchedule(
        tenant.id,
        new Date(),
        (tenant as { location?: { timezone?: string | null } }).location?.timezone ??
          undefined,
      ),
      getRequestOrigin(tenant),
    ])

  const copy: HomepageCopy =
    (tenant as { homepageCopy?: HomepageCopy | null }).homepageCopy ?? {}

  const donateQuote = nonBlank(copy.donateQuote)
  // Citation semantics: with a custom quote, a blank citation means "no
  // citation" — never show the default hadith attribution under a tenant's
  // own words. The default citation applies only under the default quote.
  const donateCitation = donateQuote
    ? nonBlank(copy.donateCitation) ?? ''
    : nonBlank(copy.donateCitation)

  // Interleave manually-authored hero slides with featured events and pages
  // so all three appear in the homepage carousel — slides, then events, then pages.
  const allSlides: HeroSlideLike[] = [
    ...(slides as HeroSlideLike[]),
    ...((featuredEvents as Parameters<typeof eventToHeroSlide>[0][]).map(eventToHeroSlide)),
    ...((featuredPages as Parameters<typeof pageToHeroSlide>[0][]).map(pageToHeroSlide)),
  ]

  return (
    <>
      <MosqueJsonLd tenant={tenant} origin={requestOrigin.origin} schedule={schedule} />
      <AnnouncementsBanner announcements={announcements as AnnouncementLike[]} />
      <Hero slides={allSlides} liveData={liveData} />

      {/* Hidden entirely until the tenant has at least one upcoming event. */}
      {(events as EventLike[]).length > 0 && (
      <section className="bg-bg py-24">
        <div className="mx-auto max-w-page px-6">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-[640px]">
              <div className="mb-4 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
                {nonBlank(copy.eventsEyebrow) ?? 'What’s happening'}
              </div>
              <h2 className="mb-3 font-display text-[44px] font-medium leading-[1.15] tracking-tight text-fg1">
                {nonBlank(copy.eventsHeading) ?? 'Upcoming events'}
              </h2>
              <p className="m-0 text-[17px] leading-relaxed text-fg2">
                {nonBlank(copy.eventsSubcopy) ??
                  'Classes, programs, and gatherings for the whole community.'}
              </p>
            </div>
            <Link
              href="/events"
              className="inline-flex items-center gap-2 font-body text-fs-base font-semibold text-brand hover:text-brand-hover"
            >
              All events
              <ArrowRight size={16} strokeWidth={1.75} />
            </Link>
          </div>
          <EventsList events={events as EventLike[]} limit={4} />
        </div>
      </section>
      )}

      <ServicesGrid
        services={services as ServiceLike[]}
        eyebrow={nonBlank(copy.servicesEyebrow)}
        title={nonBlank(copy.servicesHeading)}
        subtitle={nonBlank(copy.servicesSubcopy)}
        layout={copy.servicesLayout ?? 'cards'}
      />

      <DonateCTA
        donationConfig={
          tenant.donationConfig as TenantDonationConfig | null | undefined
        }
        eyebrow={nonBlank(copy.donateEyebrow)}
        hadith={donateQuote}
        citation={donateCitation}
        buttonLabel={nonBlank(copy.donateButtonLabel)}
      />
    </>
  )
}
