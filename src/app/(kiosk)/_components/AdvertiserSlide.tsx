'use client'

import React, { useMemo } from 'react'
import QRCodeDisplay from './QRCodeDisplay'
import { getRandomGradient } from '../_lib/constants/gradients'

// Payload collection shape for AdvertiserSlide
export type AdvertiserSlideData = {
  id: string
  title: string
  tagline?: string | null
  logo?: { url?: string } | string | null
  brandColorPrimary?: string | null
  brandColorSecondary?: string | null
  backgroundStyle?: 'gradient' | 'solid' | 'brand-primary' | 'brand-secondary' | null
  layoutTemplate?: 'logo-left' | 'logo-top-centered' | 'logo-dominant' | 'split-screen' | null
  details1?: string | null
  details2?: string | null
  details3?: string | null
  contactPhone?: string | null
  contactAddress?: string | null
  contactWebsite?: string | null
  qrCode?:
    | {
        generatedImage?: { url?: string } | string | null
        targetUrl?: string | null
        label?: string | null
      }
    | string
    | null
  ctaText?: string | null
}

interface AdvertiserSlideProps {
  slide: AdvertiserSlideData
  gradientKey?: number
}

const AdvertiserSlide: React.FC<AdvertiserSlideProps> = ({ slide, gradientKey = 0 }) => {
  // Resolve QR code URL from Payload media relationship
  const qrCodeUrl = useMemo(() => {
    if (!slide.qrCode || typeof slide.qrCode === 'string') return undefined
    const gi = slide.qrCode.generatedImage
    if (!gi) return undefined
    if (typeof gi === 'string') return gi
    return gi.url ?? undefined
  }, [slide.qrCode])

  const qrCodeLabel = useMemo(() => {
    if (!slide.qrCode || typeof slide.qrCode === 'string') return undefined
    return slide.qrCode.label ?? undefined
  }, [slide.qrCode])

  // Resolve logo URL from Payload media relationship
  const logoUrl = useMemo(() => {
    if (!slide.logo) return undefined
    if (typeof slide.logo === 'string') return slide.logo
    return slide.logo.url ?? undefined
  }, [slide.logo])

  // Generate background style
  const backgroundStyle: React.CSSProperties = useMemo(() => {
    switch (slide.backgroundStyle) {
      case 'gradient': {
        const gradient = getRandomGradient()
        return { background: gradient.css, transition: 'background 2s ease-in-out' }
      }
      case 'solid':
        return { background: '#f5f5f5', color: '#000000' }
      case 'brand-primary':
        return { background: slide.brandColorPrimary ?? '#1e40af', transition: 'background 1s ease-in-out' }
      case 'brand-secondary':
        if (slide.brandColorPrimary && slide.brandColorSecondary) {
          return {
            background: `linear-gradient(135deg, ${slide.brandColorPrimary} 0%, ${slide.brandColorSecondary} 100%)`,
            transition: 'background 2s ease-in-out',
          }
        }
        return { background: slide.brandColorPrimary ?? '#1e40af', transition: 'background 1s ease-in-out' }
      default: {
        const defaultGradient = getRandomGradient()
        return { background: defaultGradient.css }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.backgroundStyle, slide.brandColorPrimary, slide.brandColorSecondary, gradientKey])

  const textColor = slide.backgroundStyle === 'solid' ? 'text-gray-900' : 'text-white'
  const textOpacity = slide.backgroundStyle === 'solid' ? 'opacity-80' : 'opacity-90'

  const sharedProps = { slide, logoUrl, backgroundStyle, textColor, textOpacity, qrCodeUrl, qrCodeLabel }

  switch (slide.layoutTemplate) {
    case 'logo-left':
      return <LogoLeftLayout {...sharedProps} />
    case 'logo-top-centered':
      return <LogoTopCenteredLayout {...sharedProps} />
    case 'logo-dominant':
      return <LogoDominantLayout {...sharedProps} />
    case 'split-screen':
      return <SplitScreenLayout {...sharedProps} />
    default:
      return <LogoLeftLayout {...sharedProps} />
  }
}

interface LayoutProps {
  slide: AdvertiserSlideData
  logoUrl?: string
  backgroundStyle: React.CSSProperties
  textColor: string
  textOpacity: string
  qrCodeUrl?: string
  qrCodeLabel?: string
}

const LogoLeftLayout: React.FC<LayoutProps> = ({ slide, logoUrl, backgroundStyle, textColor, textOpacity, qrCodeUrl, qrCodeLabel }) => (
  <div className="w-full h-full flex items-center justify-center p-12" style={backgroundStyle}>
    <div className="w-full max-w-[90%] flex items-center gap-12">
      {logoUrl && (
        <div className="flex-shrink-0 w-[25%] flex items-center justify-center">
          <img src={logoUrl} alt={slide.title} className="max-w-full max-h-[400px] object-contain drop-shadow-2xl" />
        </div>
      )}
      <div className="flex-1 space-y-6">
        <h1 className={`font-display font-bold ${textColor} text-tv-xl leading-tight`}>
          {slide.title}
        </h1>
        {slide.tagline && (
          <p className={`font-sans ${textColor} ${textOpacity} text-tv-lg leading-snug`}>
            {slide.tagline}
          </p>
        )}
        <div className="space-y-3">
          {slide.details1 && <p className={`font-sans ${textColor} ${textOpacity} text-tv-md`}>{slide.details1}</p>}
          {slide.details2 && <p className={`font-sans ${textColor} ${textOpacity} text-tv-md`}>{slide.details2}</p>}
          {slide.details3 && <p className={`font-sans ${textColor} ${textOpacity} text-tv-md`}>{slide.details3}</p>}
        </div>
        {(slide.contactPhone || slide.contactAddress || slide.contactWebsite) && (
          <div className="space-y-2 pt-4 border-t-2 border-current border-opacity-20">
            {slide.contactPhone && <p className={`font-sans ${textColor} text-tv-base font-semibold`}>📞 {slide.contactPhone}</p>}
            {slide.contactAddress && <p className={`font-sans ${textColor} ${textOpacity} text-tv-sm`}>📍 {slide.contactAddress}</p>}
            {slide.contactWebsite && <p className={`font-sans ${textColor} ${textOpacity} text-tv-sm`}>🌐 {slide.contactWebsite}</p>}
          </div>
        )}
        <div className="flex items-center gap-6 pt-4">
          {slide.ctaText && (
            <div className={`px-8 py-4 rounded-lg font-display font-bold text-tv-md ${textColor === 'text-white' ? 'bg-white/20 text-white' : 'bg-gray-800 text-white'}`}>
              {slide.ctaText}
            </div>
          )}
          {qrCodeUrl && (
            <div className="flex flex-col items-center">
              <QRCodeDisplay url={qrCodeUrl} size="small" />
              <p className={`font-sans ${textColor} ${textOpacity} text-tv-sm mt-2`}>{qrCodeLabel ?? 'Scan for more information'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
)

const LogoTopCenteredLayout: React.FC<LayoutProps> = ({ slide, logoUrl, backgroundStyle, textColor, textOpacity, qrCodeUrl, qrCodeLabel }) => (
  <div className="w-full h-full flex flex-col items-center justify-center p-12" style={backgroundStyle}>
    <div className="w-full max-w-[85%] flex flex-col" style={{ height: '90%' }}>
      <div className="text-center space-y-6 pb-8 border-b-4 border-white/20">
        {logoUrl && (
          <div className="flex justify-center">
            <img src={logoUrl} alt={slide.title} className="max-w-[350px] max-h-[250px] object-contain drop-shadow-2xl" />
          </div>
        )}
        <div className="space-y-3">
          <h1 className={`font-display font-bold ${textColor} text-tv-xl leading-tight`}>{slide.title}</h1>
          {slide.tagline && <p className={`font-sans ${textColor} ${textOpacity} text-tv-lg`}>{slide.tagline}</p>}
        </div>
      </div>
      <div className="flex-1 py-8">
        {(slide.details1 || slide.details2 || slide.details3) ? (
          <div className="grid grid-cols-2 gap-12 h-full">
            <div className="space-y-4 flex flex-col justify-center">
              {slide.details1 && <p className={`font-sans ${textColor} ${textOpacity} text-tv-md leading-relaxed`}>• {slide.details1}</p>}
              {slide.details2 && <p className={`font-sans ${textColor} ${textOpacity} text-tv-md leading-relaxed`}>• {slide.details2}</p>}
              {slide.details3 && <p className={`font-sans ${textColor} ${textOpacity} text-tv-md leading-relaxed`}>• {slide.details3}</p>}
            </div>
            <div className="space-y-4 flex flex-col justify-center">
              {slide.contactPhone && <p className={`font-sans ${textColor} text-tv-base font-semibold`}>📞 {slide.contactPhone}</p>}
              {slide.contactAddress && <p className={`font-sans ${textColor} ${textOpacity} text-tv-sm leading-relaxed`}>📍 {slide.contactAddress}</p>}
              {slide.contactWebsite && <p className={`font-sans ${textColor} ${textOpacity} text-tv-base`}>🌐 {slide.contactWebsite}</p>}
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-center items-center space-y-6 h-full">
            {slide.contactPhone && <p className={`font-sans ${textColor} text-tv-lg font-semibold`}>📞 {slide.contactPhone}</p>}
            {slide.contactAddress && <p className={`font-sans ${textColor} ${textOpacity} text-tv-md leading-relaxed text-center`}>📍 {slide.contactAddress}</p>}
            {slide.contactWebsite && <p className={`font-sans ${textColor} text-tv-lg`}>🌐 {slide.contactWebsite}</p>}
          </div>
        )}
      </div>
      <div className={`pt-6 border-t-4 border-current border-opacity-20 flex items-center ${qrCodeUrl && slide.ctaText ? 'justify-between' : 'justify-center'}`}>
        {slide.ctaText && <p className={`font-display font-bold ${textColor} text-tv-xl`}>{slide.ctaText}</p>}
        {qrCodeUrl && (
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center">
              <QRCodeDisplay url={qrCodeUrl} size="medium" />
              <p className={`font-sans ${textColor} ${textOpacity} text-tv-sm mt-2`}>{qrCodeLabel ?? 'Scan for more information'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
)

const LogoDominantLayout: React.FC<LayoutProps> = ({ slide, logoUrl, backgroundStyle, textColor, textOpacity, qrCodeUrl, qrCodeLabel }) => (
  <div className="w-full h-full flex flex-col items-center justify-center p-12" style={backgroundStyle}>
    <div className="w-full max-w-[80%] text-center space-y-12">
      {logoUrl && (
        <div className="flex justify-center">
          <img src={logoUrl} alt={slide.title} className="max-w-[600px] max-h-[500px] object-contain drop-shadow-2xl" />
        </div>
      )}
      <h1 className={`font-display font-bold ${textColor} text-[8vh] leading-tight`}>{slide.title}</h1>
      {(slide.tagline || slide.ctaText) && (
        <p className={`font-sans ${textColor} text-tv-xl font-semibold`}>{slide.ctaText ?? slide.tagline}</p>
      )}
      <div className="flex items-center justify-center gap-12 pt-8">
        <div className="text-left space-y-2">
          {slide.contactPhone && <p className={`font-sans ${textColor} text-tv-lg font-semibold`}>📞 {slide.contactPhone}</p>}
          {slide.contactWebsite && <p className={`font-sans ${textColor} ${textOpacity} text-tv-base`}>🌐 {slide.contactWebsite}</p>}
        </div>
        {qrCodeUrl && (
          <div className="flex flex-col items-center">
            <QRCodeDisplay url={qrCodeUrl} size="large" />
            <p className={`font-sans ${textColor} ${textOpacity} text-tv-base mt-2`}>{qrCodeLabel ?? 'Scan for more information'}</p>
          </div>
        )}
      </div>
    </div>
  </div>
)

const SplitScreenLayout: React.FC<LayoutProps> = ({ slide, logoUrl, backgroundStyle, textColor, textOpacity, qrCodeUrl, qrCodeLabel }) => (
  <div className="w-full h-full flex" style={backgroundStyle}>
    <div className="w-1/2 flex items-center justify-center p-12 border-r-4 border-white/20">
      {logoUrl ? (
        <img src={logoUrl} alt={slide.title} className="max-w-[80%] max-h-[70%] object-contain drop-shadow-2xl" />
      ) : (
        <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center">
          <span className={`${textColor} text-4xl font-bold`}>{slide.title.charAt(0)}</span>
        </div>
      )}
    </div>
    <div className="w-1/2 flex flex-col justify-center p-12 space-y-6">
      <h1 className={`font-display font-bold ${textColor} text-tv-xl leading-tight`}>{slide.title}</h1>
      {slide.tagline && <p className={`font-sans ${textColor} text-tv-lg`}>{slide.tagline}</p>}
      <div className="space-y-3">
        {slide.details1 && <p className={`font-sans ${textColor} ${textOpacity} text-tv-md`}>{slide.details1}</p>}
        {slide.details2 && <p className={`font-sans ${textColor} ${textOpacity} text-tv-md`}>{slide.details2}</p>}
        {slide.details3 && <p className={`font-sans ${textColor} ${textOpacity} text-tv-md`}>{slide.details3}</p>}
      </div>
      <div className={`space-y-2 pt-6 border-t-2 ${textColor} border-opacity-20`}>
        {slide.contactPhone && <p className={`font-sans ${textColor} text-tv-base font-semibold`}>📞 {slide.contactPhone}</p>}
        {slide.contactAddress && <p className={`font-sans ${textColor} ${textOpacity} text-tv-sm`}>📍 {slide.contactAddress}</p>}
        {slide.contactWebsite && <p className={`font-sans ${textColor} ${textOpacity} text-tv-sm`}>🌐 {slide.contactWebsite}</p>}
      </div>
      <div className="pt-6 space-y-4">
        {slide.ctaText && (
          <div className={`inline-block px-8 py-4 rounded-lg font-display font-bold text-tv-md ${textColor === 'text-white' ? 'bg-white/20 text-white' : 'bg-gray-800 text-white'}`}>
            {slide.ctaText}
          </div>
        )}
        {qrCodeUrl && (
          <div className="flex items-center gap-4">
            <QRCodeDisplay url={qrCodeUrl} size="small" />
            <p className={`font-sans ${textColor} ${textOpacity} text-tv-sm`}>{qrCodeLabel ?? 'Scan for more information'}</p>
          </div>
        )}
      </div>
    </div>
  </div>
)

export default AdvertiserSlide
