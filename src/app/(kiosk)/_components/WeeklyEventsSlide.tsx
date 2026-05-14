'use client'

import React, { useMemo } from 'react'
import QRCodeDisplay from './QRCodeDisplay'
import { getRandomGradient } from '../_lib/constants/gradients'

// Payload collection shape for WeeklyEventsSlide
export type RegularEvent = {
  name: string
  time: string
}

export type WeeklyEventsSlideData = {
  id: string
  featuredEventTitle: string
  featuredEventSubtitle?: string | null
  featuredEventDatetime: string
  regularEvents?: RegularEvent[] | null
  qrCode?:
    | {
        generatedImage?: { url?: string } | string | null
        targetUrl?: string | null
        label?: string | null
      }
    | string
    | null
}

interface WeeklyEventsSlideProps {
  slide: WeeklyEventsSlideData
  gradientKey?: number
}

const WeeklyEventsSlide: React.FC<WeeklyEventsSlideProps> = ({ slide, gradientKey = 0 }) => {
  // Generate a fresh random gradient whenever gradientKey changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currentGradient = useMemo(() => getRandomGradient(), [gradientKey])

  const gradientStyle: React.CSSProperties = {
    background: currentGradient.css,
    transition: 'background 2s ease-in-out',
  }

  // Resolve QR code URL from Payload media relationship
  const qrCodeUrl = useMemo(() => {
    if (!slide.qrCode || typeof slide.qrCode === 'string') return null
    const gi = slide.qrCode.generatedImage
    if (!gi) return null
    if (typeof gi === 'string') return gi
    return gi.url ?? null
  }, [slide.qrCode])

  const regularEvents = slide.regularEvents ?? []

  return (
    <div className="w-full h-full flex flex-col relative" style={gradientStyle}>
      {/* QR Code - Positioned in featured event section */}
      {qrCodeUrl && (
        <div className="absolute top-[22%] right-12 flex flex-col items-center z-10">
          <div className="bg-white p-2 rounded-lg shadow-2xl">
            <QRCodeDisplay url={qrCodeUrl} size="xsmall" />
          </div>
          <p className="font-medium text-white mt-1 drop-shadow-md" style={{ fontSize: 'clamp(0.75rem, 1.8vw, 1.5rem)' }}>
            Register
          </p>
        </div>
      )}

      {/* Main Content Area - Full Height */}
      <div className="flex-1 flex flex-col items-center justify-center px-12 py-8">
        {/* Featured Event Section */}
        <div className="text-center mb-8 max-w-[85%]">
          <h1
            className="font-bold text-white leading-[1.1] mb-4 drop-shadow-lg"
            style={{ fontSize: 'clamp(3rem, 10vw, 12rem)' }}
          >
            {slide.featuredEventTitle}
          </h1>

          {slide.featuredEventSubtitle && (
            <p
              className="text-white/90 leading-snug mb-4 drop-shadow-md"
              style={{ fontSize: 'clamp(1rem, 2.5vw, 3.5rem)' }}
            >
              {slide.featuredEventSubtitle}
            </p>
          )}

          <p
            className="text-white/95 font-semibold leading-snug drop-shadow-md"
            style={{ fontSize: 'clamp(1.5rem, 6vw, 7rem)' }}
          >
            {slide.featuredEventDatetime}
          </p>
        </div>

        {/* Divider */}
        {regularEvents.length > 0 && <div className="w-[60%] h-[2px] bg-white/30 my-6" />}

        {/* Regular Events Section */}
        {regularEvents.length > 0 && (
          <>
            <h2
              className="font-semibold text-white/90 uppercase tracking-wider mb-6 drop-shadow-md"
              style={{ fontSize: 'clamp(0.875rem, 2vw, 2.5rem)' }}
            >
              Weekly Regular Events
            </h2>

            <div className="grid grid-cols-2 gap-x-12 gap-y-4 max-w-[85%]">
              {regularEvents.map((event, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-[2vh] h-[2vh] rounded-full bg-teal-500 flex-shrink-0 mt-2 shadow-lg" />
                  <div className="flex-1">
                    <div
                      className="font-semibold text-white leading-tight mb-1 drop-shadow-md"
                      style={{ fontSize: 'clamp(0.875rem, 3.2vw, 3rem)' }}
                    >
                      {event.name}
                    </div>
                    <div
                      className="text-white/80 leading-tight drop-shadow-sm"
                      style={{ fontSize: 'clamp(0.75rem, 2.8vw, 2.75rem)' }}
                    >
                      {event.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default WeeklyEventsSlide
