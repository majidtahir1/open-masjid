import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Calendar, MapPin } from 'lucide-react'

import Flyer from './Flyer'
import { mediaAlt, mediaUrl, type EventLike } from './types'

export interface EventCardProps {
  event: EventLike
}

const TAG_LABELS: Record<string, string> = {
  'weekly-class': 'Weekly class',
  ramadan: 'Ramadan',
  eid: 'Eid',
  sisters: 'Sisters',
  youth: 'Youth',
  brothers: 'Brothers',
  community: 'Community',
}

const TAG_COLORS: Record<string, string> = {
  ramadan: 'bg-gold-100 text-navy-700',
  eid: 'bg-gold-100 text-navy-700',
  sisters: 'bg-gray-100 text-fg1',
  youth: 'bg-teal-50 text-teal-700',
  brothers: 'bg-brand-soft text-brand',
  community: 'bg-brand-soft text-brand',
  'weekly-class': 'bg-brand-soft text-brand',
}

function tagLabel(tag: string | null | undefined): string | null {
  if (!tag) return null
  return TAG_LABELS[tag] ?? tag
}

function tagColor(tag: string | null | undefined): string {
  if (!tag) return 'bg-brand-soft text-brand'
  return TAG_COLORS[tag] ?? 'bg-brand-soft text-brand'
}

function TagChip({ tag }: { tag: string | null | undefined }) {
  const label = tagLabel(tag)
  if (!label) return null
  return (
    <span
      className={[
        'inline-flex items-center rounded-[var(--r-pill)] px-[10px] py-[3px]',
        'font-body text-[11px] font-semibold uppercase tracking-caps',
        tagColor(tag),
      ].join(' ')}
    >
      {label}
    </span>
  )
}

function Caption({ event }: { event: EventLike }) {
  return (
    <div className="flex flex-1 flex-col p-5">
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <TagChip tag={event.tag} />
        {event.when && (
          <span className="inline-flex items-center gap-[6px] font-body text-fs-sm text-fg3">
            <Calendar size={13} strokeWidth={1.75} aria-hidden="true" />
            {event.when}
          </span>
        )}
      </header>
      <h3 className="mb-[6px] font-display text-[22px] font-semibold leading-snug text-fg1">
        {event.title}
      </h3>
      {event.shortDescription && (
        <p className="m-0 mb-4 text-fs-sm leading-relaxed text-fg2">
          {event.shortDescription}
        </p>
      )}
      <footer className="mt-auto flex items-center justify-between gap-3 pt-2">
        {event.location && (
          <span className="inline-flex items-center gap-[6px] font-body text-fs-sm text-fg3">
            <MapPin size={13} strokeWidth={1.75} aria-hidden="true" />
            {event.location}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-[6px] font-body text-fs-sm font-semibold text-brand transition-colors duration-base ease-out group-hover:text-brand-hover">
          Details
          <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </footer>
    </div>
  )
}

export default function EventCard({ event }: EventCardProps) {
  const href = event.slug ? `/events/${event.slug}` : '#'
  const mode = event.displayMode ?? 'text'

  const shellClasses = [
    'group relative flex flex-col overflow-hidden bg-white',
    'rounded-[var(--r-md)] border border-border shadow-sh-xs',
    'transition-all duration-base ease-out',
    'hover:-translate-y-[2px] hover:border-border-teal hover:shadow-sh-md',
    'focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2',
  ].join(' ')

  if (mode === 'image') {
    const flyerUrl = mediaUrl(event.flyerImage)
    const flyerAltText =
      mediaAlt(event.flyerImage, `${event.title} flyer`) || `${event.title} flyer`
    return (
      <article className={shellClasses}>
        <Link
          href={href}
          aria-label={`${event.title} — view details`}
          className="absolute inset-0 z-10"
        >
          <span className="sr-only">{event.title}</span>
        </Link>
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-bg-alt">
          {flyerUrl ? (
            <Image
              src={flyerUrl}
              alt={flyerAltText}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 560px"
              className="object-cover transition-transform duration-base ease-out group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-fs-sm text-fg3">
              Flyer coming soon
            </div>
          )}
        </div>
        <Caption event={event} />
      </article>
    )
  }

  if (mode === 'template') {
    return (
      <article className={shellClasses}>
        <Link
          href={href}
          aria-label={`${event.title} — view details`}
          className="absolute inset-0 z-10"
        >
          <span className="sr-only">{event.title}</span>
        </Link>
        <div className="w-full">
          <Flyer
            title={event.title}
            subtitle={event.shortDescription ?? undefined}
            meta={event.when ?? undefined}
            variant={event.templateVariant ?? 'default'}
            className="rounded-none shadow-none hover:translate-y-0 hover:shadow-none"
          />
        </div>
        <Caption event={event} />
      </article>
    )
  }

  // text mode — centered text card
  return (
    <article className={[shellClasses, 'items-center text-center'].join(' ')}>
      <Link
        href={href}
        aria-label={`${event.title} — view details`}
        className="absolute inset-0 z-10"
      >
        <span className="sr-only">{event.title}</span>
      </Link>
      <div className="flex flex-1 flex-col items-center p-8">
        <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
          <TagChip tag={event.tag} />
          {event.when && (
            <span className="inline-flex items-center gap-[6px] font-body text-fs-sm text-fg3">
              <Calendar size={13} strokeWidth={1.75} aria-hidden="true" />
              {event.when}
            </span>
          )}
        </div>
        <h3 className="mb-2 font-display text-[24px] font-semibold leading-snug text-fg1">
          {event.title}
        </h3>
        {event.shortDescription && (
          <p className="m-0 mb-5 max-w-[48ch] text-fs-base leading-relaxed text-fg2">
            {event.shortDescription}
          </p>
        )}
        <div className="mt-auto flex flex-col items-center gap-3">
          {event.location && (
            <span className="inline-flex items-center gap-[6px] font-body text-fs-sm text-fg3">
              <MapPin size={13} strokeWidth={1.75} aria-hidden="true" />
              {event.location}
            </span>
          )}
          <span className="inline-flex items-center gap-[6px] font-body text-fs-sm font-semibold text-brand transition-colors duration-base ease-out group-hover:text-brand-hover">
            Details
            <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
          </span>
        </div>
      </div>
    </article>
  )
}
