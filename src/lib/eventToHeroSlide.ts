import type { Accent, EventLike, HeroSlideLike } from '@/components/types'

type FeaturedEvent = EventLike & {
  featured?: boolean | null
  heroAccent?: Accent | null
  slug?: string | null
}

/**
 * Map an Event marked "featured" into the HeroSlide shape so it can be
 * rendered alongside manually-authored hero slides on the homepage carousel.
 */
export function eventToHeroSlide(event: FeaturedEvent): HeroSlideLike {
  const tag = event.tag
    ? event.tag.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Event'
  return {
    id: event.id,
    kind: 'flyer',
    eyebrow: tag,
    title: event.title,
    body: event.shortDescription ?? null,
    meta: event.when ?? null,
    accent: event.heroAccent ?? 'cream',
    style: 'original',
    ctas: event.slug
      ? [
          {
            label: 'Learn more',
            linkType: 'page',
            page: `/events/${event.slug}`,
            primary: true,
          },
        ]
      : null,
  }
}
