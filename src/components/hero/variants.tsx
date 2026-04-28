'use client'

import {
  AyahCard,
  BgOrnament,
  FeaturePhotoCard,
  HeroCopy,
  LiveWidget,
  NextIqamahCard,
  PlaceholderImg,
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
  return (
    <>
      <BgOrnament big />
      <div className="om-hero-original-inner">
        <HeroCopy slide={slide} active={active} />
      </div>
    </>
  )
}

export function HeroSplit({ slide, active, liveData, uid }: VariantProps) {
  return (
    <>
      <BgOrnament />
      <div className="mx-auto w-full max-w-page">
        <div className="om-hero-grid">
          <HeroCopy slide={slide} active={active} />
          <div className="om-hero-stack">
            <NextIqamahCard data={liveData?.nextIqamah ?? null} />
            <FeaturePhotoCard slide={slide} uid={uid} />
          </div>
        </div>
      </div>
    </>
  )
}

export function HeroLive({ slide, active, liveData }: VariantProps) {
  return (
    <>
      <BgOrnament />
      <div className="mx-auto w-full max-w-page">
        <div className="om-hero-grid">
          <HeroCopy slide={slide} active={active} />
          <LiveWidget liveData={liveData} />
        </div>
      </div>
    </>
  )
}

export function HeroPhoto({ slide, active, liveData, uid }: VariantProps) {
  const f = slide.photoFields
  const url = mediaUrl(f?.image)
  const alt = mediaAlt(f?.image, f?.photoLabel ?? slide.title ?? '')
  const tone = (f?.photoTone ?? 'navy') as PhotoTone
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
            <NextIqamahCard data={liveData?.nextIqamah ?? null} />
            <AyahCard slide={slide} />
          </div>
        </div>
      </div>
    </div>
  )
}
