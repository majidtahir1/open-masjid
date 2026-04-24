import { HandHeart } from 'lucide-react'

import LucideIconByName from './LucideIcon'
import type { ServiceLike } from './types'

export interface ServicesGridProps {
  services: ServiceLike[]
  /** Optional section eyebrow. Default "What we do". */
  eyebrow?: string
  /** Optional section title. Default "Services for our community". */
  title?: string
  /** Optional subtitle below the title. */
  subtitle?: string
}

export default function ServicesGrid({
  services,
  eyebrow = 'What we do',
  title = 'Services for our community',
  subtitle = "From your first week to your last rites — we're here for every part of the journey, Insha'Allah.",
}: ServicesGridProps) {
  const sorted = [...services].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((s) => (
            <article
              key={s.id ?? s.title}
              className={[
                'rounded-[var(--r-md)] border border-border bg-white p-6',
                'shadow-sh-xs transition-all duration-base ease-out',
                'hover:-translate-y-[2px] hover:border-border-teal hover:shadow-sh-md',
              ].join(' ')}
            >
              <div
                className={[
                  'mb-4 grid h-11 w-11 place-items-center rounded-[var(--r-md)]',
                  'bg-brand-soft text-brand',
                ].join(' ')}
              >
                <LucideIconByName
                  name={s.icon}
                  fallback={HandHeart}
                  size={24}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </div>
              <h3 className="mb-[6px] font-display text-[20px] font-semibold text-fg1">
                {s.title}
              </h3>
              {s.description && (
                <p className="m-0 text-fs-sm leading-relaxed text-fg2">
                  {s.description}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
