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
  fetchHeroSlides,
  fetchServices,
} from '@/lib/data'
import { eventToHeroSlide } from '@/lib/eventToHeroSlide'
import { getHeroLiveData } from '@/lib/getHeroLiveData'
import { getActiveSchedule } from '@/lib/prayer-schedule'
import { getRequestOrigin } from '@/lib/seo'
import MosqueJsonLd from './_components/MosqueJsonLd'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HomePage() {
  const tenant = await getCurrentTenant()
  if (!tenant) return null

  const [slides, featuredEvents, events, services, liveData, announcements, schedule, requestOrigin] =
    await Promise.all([
      fetchHeroSlides(tenant),
      fetchFeaturedEvents(tenant),
      fetchEvents(tenant, { limit: 4, upcomingOnly: true }),
      fetchServices(tenant),
      getHeroLiveData(
        tenant.id,
        (tenant as { location?: { timezone?: string | null } }).location?.timezone ?? null,
      ),
      fetchAnnouncements(tenant),
      getActiveSchedule(tenant.id),
      getRequestOrigin(tenant),
    ])

  // Interleave manually-authored hero slides with featured events so both
  // appear in the homepage carousel — slides first, then events.
  const allSlides: HeroSlideLike[] = [
    ...(slides as HeroSlideLike[]),
    ...((featuredEvents as Parameters<typeof eventToHeroSlide>[0][]).map(eventToHeroSlide)),
  ]

  return (
    <>
      <MosqueJsonLd tenant={tenant} origin={requestOrigin.origin} schedule={schedule} />
      <AnnouncementsBanner announcements={announcements as AnnouncementLike[]} />
      <Hero slides={allSlides} liveData={liveData} />

      <section className="bg-bg py-24">
        <div className="mx-auto max-w-page px-6">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-[640px]">
              <div className="mb-4 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
                What&rsquo;s happening
              </div>
              <h2 className="mb-3 font-display text-[44px] font-medium leading-[1.15] tracking-tight text-fg1">
                Upcoming events
              </h2>
              <p className="m-0 text-[17px] leading-relaxed text-fg2">
                Classes, programs, and gatherings for the whole community.
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

      <ServicesGrid services={services as ServiceLike[]} />

      <DonateCTA
        donationConfig={
          tenant.donationConfig as TenantDonationConfig | null | undefined
        }
      />
    </>
  )
}
