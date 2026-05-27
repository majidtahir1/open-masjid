'use client'
import React, { useMemo } from 'react'
import { getRandomGradient } from '../_lib/constants/gradients'

type Entry = {
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
  time: string
  name: string
  location?: string | null
  audience?: string | null
}

type WeeklyEventsSlideData = {
  id: string
  title?: string | null
  entries?: Entry[] | null
}

interface Props {
  slide: WeeklyEventsSlideData
  gradientKey?: number
}

const DAY_LABEL: Record<Entry['day'], string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
  thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}
const DAY_ORDER: Entry['day'][] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export default function WeeklyEventsSlide({ slide, gradientKey = 0 }: Props) {
  const entries = Array.isArray(slide.entries) ? slide.entries : []

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currentGradient = useMemo(() => getRandomGradient(), [gradientKey])

  const byDay = DAY_ORDER
    .map(day => ({ day, items: entries.filter(e => e.day === day) }))
    .filter(group => group.items.length > 0)

  return (
    <div
      className="w-full h-full flex flex-col relative"
      style={{ background: currentGradient.css, transition: 'background 2s ease-in-out' }}
    >
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col px-12 py-8 overflow-hidden">
        {/* Slide Title */}
        <h1 className="font-display font-bold text-white text-tv-hero leading-tight mb-6 drop-shadow-lg text-center">
          {slide.title || 'This Week at the Masjid'}
        </h1>

        {/* Divider */}
        <div className="w-[60%] mx-auto h-[2px] bg-white/30 mb-6" />

        {/* Events Grid */}
        {byDay.length > 0 && (
          <div className="grid grid-cols-2 gap-x-12 gap-y-4 flex-1 overflow-hidden">
            {byDay.map(({ day, items }) => (
              <div key={day} className="space-y-3">
                {/* Day header */}
                <div className="font-sans font-semibold text-white/90 text-tv-md uppercase tracking-wider drop-shadow-md">
                  {DAY_LABEL[day]}
                </div>
                {items.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    {/* Teal bullet */}
                    <div className="w-[2vh] h-[2vh] rounded-full bg-secondary flex-shrink-0 mt-[0.4em] shadow-lg" />
                    <div className="flex-1">
                      <div className="font-sans font-semibold text-white text-[3.2vh] leading-tight mb-0.5 drop-shadow-md">
                        {item.name}
                      </div>
                      <div className="font-sans text-white/80 text-[2.8vh] leading-tight drop-shadow-sm">
                        {item.time}
                        {(item.location || item.audience) && (
                          <span className="ml-2 text-white/60 text-[2.4vh]">
                            · {[item.location, item.audience].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {byDay.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-sans text-white/70 text-tv-md text-center">No events scheduled this week</p>
          </div>
        )}
      </div>
    </div>
  )
}
