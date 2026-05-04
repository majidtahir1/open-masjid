import RichText from './RichText'
import type { AnnouncementLike } from './types'

/**
 * Vertical list of announcement cards used on the dedicated /announcements
 * page. Renders title, formatted date, optional rich-text body, and a
 * priority pill for high-priority items. Already sorted (newest first) at the
 * data layer — this component only handles presentation.
 */
export interface AnnouncementsListProps {
  announcements: AnnouncementLike[]
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function AnnouncementsList({
  announcements,
}: AnnouncementsListProps) {
  if (!announcements || announcements.length === 0) {
    return (
      <p className="m-0 text-fs-base leading-relaxed text-fg2">
        No announcements right now. Check back soon, in shaa Allah.
      </p>
    )
  }

  return (
    <ul className="m-0 list-none space-y-6 p-0">
      {announcements.map((a) => {
        const isHigh = a.priority === 'high'
        const date = formatDate(a.createdAt)
        return (
          <li
            key={a.id ?? a.title}
            className={`rounded-[var(--r-md)] border p-7 shadow-sh-xs transition-colors ${
              isHigh
                ? 'border-brand/50 bg-brand-soft/40'
                : 'border-border bg-white'
            }`}
          >
            <div className="mb-3 flex flex-wrap items-center gap-3">
              {isHigh && (
                <span className="inline-flex items-center rounded-full bg-brand px-2.5 py-0.5 font-body text-fs-xs font-semibold uppercase tracking-caps text-white">
                  Important
                </span>
              )}
              {date && (
                <time
                  dateTime={a.createdAt ?? undefined}
                  className="font-body text-fs-xs font-semibold uppercase tracking-caps text-fg2"
                >
                  {date}
                </time>
              )}
            </div>
            <h2 className="mb-3 font-display text-[26px] font-semibold leading-snug text-fg1">
              {a.title}
            </h2>
            {a.body ? <RichText data={a.body} /> : null}
          </li>
        )
      })}
    </ul>
  )
}
