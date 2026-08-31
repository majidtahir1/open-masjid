'use client'

import {
  AyahCard,
  BgOrnament,
  CtaButton,
  FeaturePhotoCard,
  HeroCopy,
  LiveWidget,
  NextIqamahCard,
  PlaceholderImg,
  renderTitle,
} from './parts'
import {
  mediaUrl,
  mediaAlt,
  type HeroLiveData,
  type HeroPhotoPattern,
  type HeroSlideLike,
  type PhotoTone,
} from '../types'

interface VariantProps {
  slide: HeroSlideLike
  nextSlide: HeroSlideLike | null
  active: boolean
  liveData?: HeroLiveData | null
  uid: string
  onJumpToNext: () => void
}

export function HeroOriginal({ slide, active }: VariantProps) {
  const onDark = slide.background === 'brand'
  return (
    <>
      {!onDark && <BgOrnament big />}
      <div className="om-hero-original-inner">
        <HeroCopy slide={slide} active={active} onDark={onDark} />
      </div>
    </>
  )
}

export function HeroSplit({ slide, active, liveData, uid }: VariantProps) {
  const onDark = slide.background === 'brand'
  return (
    <>
      {!onDark && <BgOrnament />}
      <div className="mx-auto w-full max-w-page">
        <div className="om-hero-grid">
          <HeroCopy slide={slide} active={active} onDark={onDark} />
          <div className="om-hero-stack">
            {liveData?.hasSchedule !== false && (
              <NextIqamahCard data={liveData?.nextIqamah ?? null} />
            )}
            <FeaturePhotoCard slide={slide} uid={uid} />
          </div>
        </div>
      </div>
    </>
  )
}

export function HeroLive({ slide, active, liveData }: VariantProps) {
  const onDark = slide.background === 'brand'
  return (
    <>
      {!onDark && <BgOrnament />}
      <div className="mx-auto w-full max-w-page">
        <div className="om-hero-grid">
          <HeroCopy slide={slide} active={active} onDark={onDark} />
          <LiveWidget liveData={liveData} />
        </div>
      </div>
    </>
  )
}

/**
 * Showcase — copy on the left, a flush full-height photo bleeding to the
 * right viewport edge with a soft --bg fade melting it into the copy area.
 * No cards or widgets; just the two-tone headline, ornamental divider,
 * body paragraphs, and CTAs. Always a light (page-background) variant.
 */
export function HeroShowcase({ slide, active, uid }: VariantProps) {
  const f = slide.splitFields
  const url = mediaUrl(f?.image)
  const alt = mediaAlt(f?.image, f?.photoLabel ?? slide.title ?? '')
  const tone = (f?.photoTone ?? 'brand') as PhotoTone
  const customColor = f?.customColor ?? null
  const paragraphs = (slide.body ?? '')
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean)
  return (
    <div className="om-hero-showcase">
      {/* Head and rest are separate grid areas so the mobile layout can
          interleave the photo between the headline and the body copy. */}
      <div className="om-hero-showcase-copy om-hero-showcase-head">
        {slide.eyebrow && <div className="om-hero-eyebrow">{slide.eyebrow}</div>}
        <h1 className="om-hero-title om-hero-showcase-title">
          {renderTitle(slide.title)}
        </h1>
        <div className="om-hero-showcase-divider" aria-hidden="true">
          <span />
        </div>
      </div>
      <div className="om-hero-showcase-copy om-hero-showcase-rest">
        {paragraphs.map((p, i) => (
          <p key={i} className="om-hero-showcase-p">
            {p}
          </p>
        ))}
        {slide.ctas && slide.ctas.length > 0 && (
          <div className="om-hero-ctas">
            {slide.ctas.map((cta, j) => (
              <CtaButton key={j} cta={cta} tabIndex={active ? 0 : -1} />
            ))}
          </div>
        )}
      </div>
      <div className="om-hero-showcase-media">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={alt} />
        ) : (
          <PlaceholderImg
            label={f?.photoLabel ?? null}
            tone={tone}
            customColor={customColor}
            full
            uid={`showcase-${uid}`}
          />
        )}
        <div className="om-hero-showcase-fade" aria-hidden="true" />
      </div>
    </div>
  )
}

export function HeroPhoto({ slide, active, liveData, uid }: VariantProps) {
  const f = slide.photoFields
  const url = mediaUrl(f?.image)
  const alt = mediaAlt(f?.image, f?.photoLabel ?? slide.title ?? '')
  const tone = (f?.photoTone ?? 'brand') as PhotoTone
  const customColor = f?.customColor ?? null
  const pattern = (f?.photoPattern ?? 'arch') as HeroPhotoPattern
  return (
    <div className="om-hero-photo-bg">
      <div className="om-hero-photo-bg-media">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={alt} />
        ) : (
          <PlaceholderImg
            label={f?.photoLabel ?? null}
            tone={tone}
            customColor={customColor}
            pattern={pattern}
            full
            uid={`photo-${uid}`}
          />
        )}
      </div>
      <div className="om-hero-photo-bg-shade" aria-hidden="true" />
      <div className="mx-auto w-full max-w-page">
        <div className="om-hero-photo-bg-inner">
          <HeroCopy slide={slide} active={active} onDark />
          <div className="om-hero-photo-bg-side">
            {liveData?.hasSchedule !== false && (
              <NextIqamahCard data={liveData?.nextIqamah ?? null} />
            )}
            <AyahCard slide={slide} />
          </div>
        </div>
      </div>
    </div>
  )
}
