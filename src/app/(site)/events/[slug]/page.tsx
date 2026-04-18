import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowLeft, Calendar, Mail, MapPin } from 'lucide-react'

import Flyer from '@/components/Flyer'
import RichText from '@/components/RichText'
import { mediaAlt, mediaUrl, type EventLike } from '@/components/types'
import { getCurrentTenant } from '@/lib/tenant-server'
import { fetchEventBySlug } from '@/lib/data'

interface EventPageProps {
  params: Promise<{ slug: string }>
}

type EventDoc = EventLike & {
  description?: unknown
  contact?: string | null
}

export default async function EventDetailPage({ params }: EventPageProps) {
  const { slug } = await params
  const tenant = await getCurrentTenant()
  if (!tenant) notFound()

  const event = (await fetchEventBySlug(tenant, slug)) as EventDoc | null
  if (!event) notFound()

  const displayMode = event.displayMode ?? 'text'
  const flyerUrl = mediaUrl(event.flyerImage)

  return (
    <article className="py-16">
      <div className="mx-auto max-w-[880px] px-6">
        <Link
          href="/events"
          className="mb-8 inline-flex items-center gap-2 font-body text-fs-sm font-medium text-brand hover:text-brand-hover"
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
          All events
        </Link>

        <header className="mb-10">
          {event.tag && (
            <div className="mb-4 inline-flex items-center rounded-[var(--r-pill)] bg-brand-soft px-[10px] py-[3px] font-body text-[11px] font-semibold uppercase tracking-caps text-brand">
              {event.tag.replace(/-/g, ' ')}
            </div>
          )}
          <h1 className="mb-4 font-display text-[52px] font-medium leading-[1.08] tracking-tight text-fg1">
            {event.title}
          </h1>
          {event.shortDescription && (
            <p className="m-0 mb-6 max-w-[64ch] text-[18px] leading-relaxed text-fg2">
              {event.shortDescription}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-6 text-fs-sm text-fg3">
            {event.when && (
              <span className="inline-flex items-center gap-2">
                <Calendar size={15} strokeWidth={1.75} />
                {event.when}
              </span>
            )}
            {event.location && (
              <span className="inline-flex items-center gap-2">
                <MapPin size={15} strokeWidth={1.75} />
                {event.location}
              </span>
            )}
          </div>
        </header>

        {displayMode === 'image' && flyerUrl && (
          <div className="relative mb-10 aspect-[16/9] w-full overflow-hidden rounded-[var(--r-md)] border border-border bg-bg-alt">
            <Image
              src={flyerUrl}
              alt={mediaAlt(event.flyerImage, `${event.title} flyer`)}
              fill
              sizes="(max-width: 880px) 100vw, 880px"
              className="object-cover"
              priority
            />
          </div>
        )}

        {displayMode === 'template' && (
          <div className="mb-10">
            <Flyer
              title={event.title}
              subtitle={event.shortDescription ?? undefined}
              meta={event.when ?? undefined}
              variant={event.templateVariant ?? 'default'}
            />
          </div>
        )}

        <RichText data={event.description} className="mb-10 max-w-[68ch]" />

        {(event.address || event.contact) && (
          <aside className="mt-12 grid grid-cols-1 gap-6 rounded-[var(--r-md)] border border-border bg-white p-6 md:grid-cols-2">
            {event.address && (
              <div>
                <div className="mb-2 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
                  Address
                </div>
                <p className="m-0 whitespace-pre-line text-fs-base text-fg1">
                  {event.address}
                </p>
              </div>
            )}
            {event.contact && (
              <div>
                <div className="mb-2 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
                  RSVP / contact
                </div>
                <a
                  href={`mailto:${event.contact}?subject=${encodeURIComponent(`RSVP: ${event.title}`)}`}
                  className="inline-flex items-center gap-2 rounded-[var(--r-md)] bg-brand px-5 py-[10px] font-body text-fs-sm font-semibold text-white hover:bg-brand-hover"
                >
                  <Mail size={15} strokeWidth={1.75} />
                  {event.contact}
                </a>
              </div>
            )}
          </aside>
        )}
      </div>
    </article>
  )
}
