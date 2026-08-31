import { describe, expect, it } from 'vitest'

import { pageToHeroSlide } from '@/lib/pageToHeroSlide'

describe('pageToHeroSlide', () => {
  it('maps a featured page into the hero slide shape', () => {
    const slide = pageToHeroSlide({
      id: 7,
      title: 'Our Story',
      slug: 'our-story',
      heroExcerpt: 'Three decades of serving the community.',
      heroAccent: 'navy',
    })

    expect(slide).toEqual({
      id: 'page-7',
      kind: 'page',
      eyebrow: 'Featured',
      title: 'Our Story',
      body: 'Three decades of serving the community.',
      meta: null,
      accent: 'navy',
      style: 'original',
      ctas: [
        {
          label: 'Learn more',
          linkType: 'page',
          page: '/our-story',
          primary: true,
        },
      ],
    })
  })

  it('falls back to the SEO description when the hero excerpt is missing or blank', () => {
    const seo = { description: 'Governing documents of the masjid.' }
    expect(
      pageToHeroSlide({ id: 2, title: 'Bylaws', slug: 'bylaws', seo }).body,
    ).toBe(seo.description)
    expect(
      pageToHeroSlide({ id: 2, title: 'Bylaws', slug: 'bylaws', heroExcerpt: '   ', seo }).body,
    ).toBe(seo.description)
  })

  it('defaults accent to cream and omits CTAs without a slug', () => {
    const slide = pageToHeroSlide({ id: 3, title: 'Untitled' })
    expect(slide.accent).toBe('cream')
    expect(slide.body).toBeNull()
    expect(slide.ctas).toBeNull()
  })

  it('namespaces the id so it cannot collide with events or hero slides', () => {
    expect(pageToHeroSlide({ id: 5, title: 'A' }).id).toBe('page-5')
  })
})
