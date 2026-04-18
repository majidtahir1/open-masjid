import EventsList from '@/components/EventsList'
import type { EventLike } from '@/components/types'
import { getCurrentTenant } from '@/lib/tenant-server'
import { fetchEvents } from '@/lib/data'

export const metadata = {
  title: 'Events',
}

export default async function EventsPage() {
  const tenant = await getCurrentTenant()
  if (!tenant) return null

  const events = await fetchEvents(tenant, { limit: 100 })

  return (
    <section className="py-20">
      <div className="mx-auto max-w-page px-6">
        <header className="mb-14 max-w-[720px]">
          <div className="mb-4 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
            Community calendar
          </div>
          <h1 className="mb-4 font-display text-[52px] font-medium leading-[1.08] tracking-tight text-fg1">
            Events
          </h1>
          <p className="m-0 text-[17px] leading-relaxed text-fg2">
            Weekly classes, Ramadan programs, youth nights, and the community
            gatherings that knit us together. Everyone is welcome.
          </p>
        </header>

        <EventsList events={events as EventLike[]} />
      </div>
    </section>
  )
}
