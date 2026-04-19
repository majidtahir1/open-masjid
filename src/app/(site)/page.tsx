import Hero from '@/components/Hero'
import EventsList from '@/components/EventsList'
import ServicesGrid from '@/components/ServicesGrid'
import DonateCTA from '@/components/DonateCTA'
import type {
  EventLike,
  HeroSlideLike,
  ServiceLike,
  TenantDonationConfig,
} from '@/components/types'
import { getCurrentTenant } from '@/lib/tenant-server'
import {
  fetchEvents,
  fetchHeroSlides,
  fetchServices,
} from '@/lib/data'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HomePage() {
  const tenant = await getCurrentTenant()
  if (!tenant) return null

  const [slides, events, services] = await Promise.all([
    fetchHeroSlides(tenant),
    fetchEvents(tenant, { limit: 4 }),
    fetchServices(tenant),
  ])

  return (
    <>
      <Hero slides={slides as HeroSlideLike[]} />

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
