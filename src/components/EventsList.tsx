import EventCard from './EventCard'
import type { EventLike } from './types'

export interface EventsListProps {
  events: EventLike[]
  /** Optional cap on the number of events rendered. */
  limit?: number
}

export default function EventsList({ events, limit }: EventsListProps) {
  const items = typeof limit === 'number' ? events.slice(0, limit) : events

  if (!items || items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="m-0 font-body text-fs-md text-fg3">No upcoming events.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
      {items.map((event, i) => (
        <div
          key={event.id ?? event.slug ?? i}
          className={[
            // Staggered offset on the second column for visual rhythm.
            'h-full',
            i % 2 === 1 ? 'md:mt-12' : '',
          ].join(' ')}
        >
          <EventCard event={event} />
        </div>
      ))}
    </div>
  )
}
