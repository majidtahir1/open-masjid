import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import LucideIconByName from './LucideIcon'
import { resolveServiceLink } from '@/lib/serviceLink'
import type { ServiceLike } from './types'

export interface ServicesGridProps {
  services: ServiceLike[]
  /** Optional section eyebrow. Default "What we do". */
  eyebrow?: string
  /** Optional section title. Default "Services for our community". */
  title?: string
  /** Optional subtitle below the title. */
  subtitle?: string
  /**
   * Card layout. 'cards' (default) is the classic 3-up grid; 'compact'
   * renders a tighter strip of smaller cards with more columns.
   */
  layout?: 'cards' | 'compact'
}

export default function ServicesGrid({
  services,
  eyebrow = 'What we do',
  title = 'Services for our community',
  subtitle = "From your first week to your last rites — we're here for every part of the journey, Insha'Allah.",
  layout = 'cards',
}: ServicesGridProps) {
  const sorted = [...services].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const compact = layout === 'compact'

  return (
    <section className="py-24">
      <div className="mx-auto max-w-page px-6">
        <div className="mb-12 max-w-[640px]">
          <div className="mb-4 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
            {eyebrow}
          </div>
          <h2 className="mb-3 font-display text-[44px] font-medium leading-[1.15] tracking-tight text-fg1">
            {title}
          </h2>
          {subtitle && (
            <p className="m-0 text-[17px] leading-relaxed text-fg2">{subtitle}</p>
          )}
        </div>

        <div
          className={
            compact
              ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5'
              : 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'
          }
        >
          {sorted.map((s) => (
            <ServiceCard key={s.id ?? s.title} service={s} compact={compact} />
          ))}
        </div>
      </div>
    </section>
  )
}

function ServiceCard({
  service: s,
  compact,
}: {
  service: ServiceLike
  compact: boolean
}) {
  const link = resolveServiceLink(s)

  const cardClasses = [
    'rounded-[var(--r-md)] border border-border bg-white',
    compact ? 'p-4' : 'p-6',
    'shadow-sh-xs transition-all duration-base ease-out',
    'hover:-translate-y-[2px] hover:border-border-teal hover:shadow-sh-md',
    link
      ? 'block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'
      : '',
  ].join(' ')

  const body = (
    <>
      <div
        className={[
          compact
            ? 'mb-3 grid h-9 w-9 place-items-center rounded-[var(--r-md)]'
            : 'mb-4 grid h-11 w-11 place-items-center rounded-[var(--r-md)]',
          'bg-brand-soft text-brand',
        ].join(' ')}
      >
        <LucideIconByName
          name={s.icon}
          fallbackName="hand-heart"
          size={compact ? 20 : 24}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </div>
      <h3
        className={
          compact
            ? 'mb-1 font-display text-[17px] font-semibold text-fg1'
            : 'mb-[6px] font-display text-[20px] font-semibold text-fg1'
        }
      >
        {s.title}
      </h3>
      {s.description && (
        <p
          className={
            compact
              ? 'm-0 text-fs-xs leading-relaxed text-fg2'
              : 'm-0 text-fs-sm leading-relaxed text-fg2'
          }
        >
          {s.description}
        </p>
      )}
      {link && (
        <span
          className={[
            'inline-flex items-center gap-1 font-body font-semibold text-brand',
            compact ? 'mt-2 text-fs-xs' : 'mt-3 text-fs-sm',
          ].join(' ')}
        >
          {s.linkLabel?.trim() || 'Learn more'}
          <ArrowRight size={compact ? 12 : 14} strokeWidth={1.75} aria-hidden="true" />
        </span>
      )}
    </>
  )

  if (!link) {
    return <article className={cardClasses}>{body}</article>
  }

  if (link.external) {
    return (
      <a
        href={link.href}
        className={cardClasses}
        target="_blank"
        rel="noopener noreferrer"
      >
        {body}
      </a>
    )
  }

  return (
    <Link href={link.href} className={cardClasses}>
      {body}
    </Link>
  )
}
