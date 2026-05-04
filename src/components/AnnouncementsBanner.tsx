import Link from 'next/link'
import { Megaphone, ArrowRight } from 'lucide-react'

import type { AnnouncementLike } from './types'

/**
 * Compact banner shown above the homepage hero when there are active
 * announcements. Surfaces the most-recent (or first high-priority)
 * announcement and links to the full /announcements list when more exist.
 *
 * Returns null when given an empty list so the homepage degrades cleanly.
 */
export interface AnnouncementsBannerProps {
  announcements: AnnouncementLike[]
}

export default function AnnouncementsBanner({
  announcements,
}: AnnouncementsBannerProps) {
  if (!announcements || announcements.length === 0) return null

  // Promote the first high-priority announcement if there is one; otherwise
  // fall back to the newest announcement (the list is already sorted desc).
  const featured =
    announcements.find((a) => a.priority === 'high') ?? announcements[0]
  const remaining = announcements.length - 1
  const isHigh = featured.priority === 'high'

  const wrapClass = isHigh
    ? 'border-y border-brand/40 bg-brand-soft'
    : 'border-y border-border bg-bg-alt'

  return (
    <aside
      role="region"
      aria-label="Announcements"
      className={`w-full ${wrapClass}`}
    >
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
        <div className="flex flex-1 items-start gap-3 min-w-0">
          <Megaphone
            size={18}
            strokeWidth={1.75}
            className={`mt-[2px] flex-shrink-0 ${
              isHigh ? 'text-brand' : 'text-fg2'
            }`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <span
              className={`font-body text-fs-xs font-semibold uppercase tracking-caps ${
                isHigh ? 'text-brand' : 'text-fg2'
              }`}
            >
              {isHigh ? 'Important' : 'Announcement'}
            </span>
            <p className="m-0 truncate font-body text-fs-sm font-medium text-fg1">
              {featured.title}
            </p>
          </div>
        </div>
        <Link
          href="/announcements"
          className="inline-flex flex-shrink-0 items-center gap-1.5 font-body text-fs-sm font-semibold text-brand hover:text-brand-hover"
        >
          {remaining > 0 ? `View all (${announcements.length})` : 'View details'}
          <ArrowRight size={14} strokeWidth={1.75} />
        </Link>
      </div>
    </aside>
  )
}
