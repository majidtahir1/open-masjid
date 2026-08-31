import type { Accent, HeroSlideLike } from '@/components/types'

export type FeaturedPage = {
  id: string | number
  title: string
  slug?: string | null
  featured?: boolean | null
  heroExcerpt?: string | null
  heroAccent?: Accent | null
  seo?: { description?: string | null } | null
}

/**
 * Map a Page marked "featured" into the HeroSlide shape so it can be
 * rendered alongside manually-authored hero slides and featured events
 * on the homepage carousel.
 */
export function pageToHeroSlide(page: FeaturedPage): HeroSlideLike {
  return {
    // Namespaced so ids never collide with hero-slides or events in the
    // merged carousel (ids are used as React keys / uids).
    id: `page-${page.id}`,
    kind: 'page',
    eyebrow: 'Featured',
    title: page.title,
    body: page.heroExcerpt?.trim() || page.seo?.description?.trim() || null,
    meta: null,
    accent: page.heroAccent ?? 'cream',
    style: 'original',
    ctas: page.slug
      ? [
          {
            label: 'Learn more',
            linkType: 'page',
            page: `/${page.slug}`,
            primary: true,
          },
        ]
      : null,
  }
}
